import type { APIRoute } from "astro";
import Stripe from "stripe";
import postgres from "postgres";
import { kitBySlug } from "../../data/kits";
import { notifyNewOrder } from "../../lib/notify";

export const prerender = false;

// -----------------------------------------------------------------------------
// POST /api/stripe-webhook  — the ONLY thing that writes an order.
//
// Invoked server-to-server by Stripe and rejected unless the Stripe signature
// verifies. On `checkout.session.completed` it writes the order + itemized lines
// to the DB, connecting as the least-privilege `moikit_writer` role (INSERT only
// — it cannot read orders/PII). Item names + prices are resolved from kits.ts and
// snapshotted, so the record is immutable regardless of later catalog changes.
//
// Env (Cloudflare):
//   STRIPE_SECRET_KEY       – secret
//   STRIPE_WEBHOOK_SECRET   – webhook signing secret (secret)
//   DB connection           – Hyperdrive binding (env.HYPERDRIVE.connectionString)
//                             or a DATABASE_URL secret, using moikit_writer creds
// -----------------------------------------------------------------------------

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  const usingHyperdrive = !!env.HYPERDRIVE?.connectionString;
  const connString = usingHyperdrive ? env.HYPERDRIVE.connectionString : (env.DATABASE_URL ?? null);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !connString) {
    return new Response("not configured", { status: 503 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Verify the signature over the RAW body.
  const sig = request.headers.get("stripe-signature") ?? "";
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const md = session.metadata ?? {};
  const tier = String(md.tier ?? "");
  const stamp = String(md.stamp ?? "");
  const cart = String(md.cart ?? "");
  if (!tier || !stamp || !cart) return new Response("missing metadata", { status: 200 });

  // Resolve the cart back to authoritative order lines from kits.ts.
  const kit = kitBySlug(tier);
  const lines = cart
    .split(",")
    .map((pair) => {
      const [key, qStr] = pair.split(":");
      const dash = key.lastIndexOf("-");
      const section = key.slice(0, dash);
      const idx = Number(key.slice(dash + 1));
      const item = kit.rooms[section]?.[idx];
      const quantity = Number(qStr);
      if (!item || !(quantity > 0)) return null;
      const unit = Math.round(item.eur * 100);
      return { sku: `${tier}-${section}-${idx}`, name: item.item, section, unit, quantity };
    })
    .filter(Boolean) as { sku: string; name: string; section: string; unit: number; quantity: number }[];

  // Terms acceptance, written in the same INSERT as the order it belongs to.
  // Format is "<version>@<ISO timestamp>" (see /api/checkout). Split on the
  // FIRST "@" only — the timestamp contains none, but a future version string
  // might, and a mangled record is worse than a null one. Anything unparseable
  // stays null rather than becoming a fabricated acceptance.
  const tosRaw = String(md.tos ?? "");
  const at = tosRaw.indexOf("@");
  const termsVersion = at > 0 ? tosRaw.slice(0, at) : null;
  const termsAcceptedAtRaw = at > 0 ? tosRaw.slice(at + 1) : "";
  const termsAcceptedAt = Number.isFinite(Date.parse(termsAcceptedAtRaw))
    ? termsAcceptedAtRaw
    : null;

  const shippingCents = Number(md.shipping_cents ?? 0) || 0;
  const amountCharged = session.amount_total ?? Number(md.deposit_cents ?? 0);
  const cust = session.customer_details;
  const ship = (session as any).shipping_details ?? null;
  const addr = ship?.address ?? cust?.address ?? null;

  // Requested delivery date from the Checkout custom field. The dropdown only
  // offers valid dates (earliest tomorrow), so the value is a trusted ISO date.
  const deliveryField = (session.custom_fields ?? []).find((f) => f.key === "delivery_date");
  const deliveryRaw = (deliveryField as any)?.dropdown?.value || "";
  // Stored as "YYYYMMDD" (Stripe values are alphanumeric-only) → expand to ISO.
  const deliveryDate = /^\d{8}$/.test(deliveryRaw)
    ? `${deliveryRaw.slice(0, 4)}-${deliveryRaw.slice(4, 6)}-${deliveryRaw.slice(6, 8)}`
    : null;

  // Preferred delivery time window: value is the 2-digit start hour → "HH:00–HH:00".
  const timeField = (session.custom_fields ?? []).find((f) => f.key === "delivery_time");
  const th = parseInt((timeField as any)?.dropdown?.value ?? "", 10);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const deliveryWindow =
    Number.isInteger(th) && th >= 0 && th < 24 ? `${pad2(th)}:00–${pad2(th + 1)}:00` : null;

  // Through Hyperdrive the Worker talks to a local endpoint (Hyperdrive owns the
  // origin TLS) — forcing client SSL there would break it. Only require SSL on a
  // direct Supabase connection.
  const sql = postgres(connString, {
    prepare: false,
    fetch_types: false,
    max: 1,
    ...(usingHyperdrive ? {} : { ssl: "require" as const }),
  });
  let isNewOrder = false;
  try {
    // ONE round-trip. Cloudflare caps outbound subrequests per invocation, so a
    // per-item INSERT loop blows the limit. Single CTE: insert the order, then
    // expand the items from a JSON param and insert them all at once. Idempotent
    // on `stamp` — a duplicate leaves new_order empty, so zero items are written.
    // Item lines expand from a single jsonb parameter. postgres.js's sql.json()
    // serializes the array itself and binds it as a typed jsonb value (OID 3802),
    // sidestepping the driver's unreliable array/JSON-string encoding under
    // prepare:false + fetch_types:false (which broke the earlier ::jsonb-cast and
    // unnest attempts). The function must be jsonb_to_recordset to match that type.
    const itemsArr = lines.map((l) => ({
      sku: l.sku, name: l.name, section: l.section, unit: l.unit, qty: l.quantity,
    }));
    const wrote = await sql`
      with new_order as (
        insert into orders (
          stamp, tier, payment_status,
          stripe_payment_intent_id, stripe_checkout_session_id,
          amount_charged_cents, shipping_cents, currency,
          customer_name, customer_email, customer_phone,
          address_line, address_postal, address_city, delivery_date, delivery_window, paid_at,
          terms_version, terms_accepted_at
        ) values (
          ${stamp}, ${tier}, 'ok',
          ${(session.payment_intent as string | null) ?? null}, ${session.id},
          ${amountCharged}, ${shippingCents}, ${(session.currency ?? "eur").toUpperCase()},
          ${ship?.name ?? cust?.name ?? null}, ${cust?.email ?? null}, ${cust?.phone ?? null},
          ${addr?.line1 ?? null}, ${addr?.postal_code ?? null}, ${addr?.city ?? null}, ${deliveryDate}, ${deliveryWindow}, now(),
          ${termsVersion}, ${termsAcceptedAt}
        )
        on conflict (stamp) do nothing
        returning id
      ), new_items as (
        insert into order_items (order_id, sku, item_name, section, unit_price_cents, quantity, line_total_cents)
        select no.id, x.sku, x.name, x.section, x.unit, x.qty, x.unit * x.qty
        from new_order no
        cross join jsonb_to_recordset(${sql.json(itemsArr)})
          as x(sku text, name text, section text, unit int, qty int)
      )
      select id from new_order
    `;
    // Empty means `on conflict do nothing` fired: Stripe redelivered an event we
    // already stored. The row is intact — just don't email the customer twice.
    isNewOrder = wrote.length > 0;
  } catch (err) {
    // Log server-side for Worker tails; never leak internals to Stripe's delivery log.
    // Log ONLY the driver's code + message. A postgres.js error can carry the
    // failed query AND its bound parameters — which in this INSERT are the
    // customer's name, email, phone and full address. Those must never reach
    // the Worker log sink (observability is on), and the privacy notice says
    // technical logs hold request metadata, not customer PII.
    console.error(
      "webhook db write failed",
      (err as any)?.code ?? "",
      (err as any)?.message ?? String(err),
    );
    return new Response("db error", { status: 500 });
  } finally {
    await sql.end();
  }

  // Notify only on a genuinely new order, and only after the row is committed —
  // a failure in here is logged, never surfaced, so Stripe still sees 200.
  if (isNewOrder) {
    await notifyNewOrder(env, {
      ref: stamp.slice(0, 8).toUpperCase(),
      tier,
      kitName: kit.name,
      lines: lines.map((l) => ({ name: l.name, quantity: l.quantity, unit: l.unit })),
      subtotalCents: Number(md.items_subtotal_cents ?? 0) || 0,
      shippingCents,
      depositCents: amountCharged,
      customerName: ship?.name ?? cust?.name ?? null,
      customerEmail: cust?.email ?? null,
      customerPhone: cust?.phone ?? null,
      addressLine: addr?.line1 ?? null,
      addressPostal: addr?.postal_code ?? null,
      addressCity: addr?.city ?? null,
      deliveryDate,
      deliveryWindow,
    });
  }

  return new Response("ok", { status: 200 });
};
