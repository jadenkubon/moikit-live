import type { APIRoute } from "astro";
import Stripe from "stripe";
import postgres from "postgres";
import { kitBySlug } from "../../data/kits";

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

function dbUrl(env: any): string | null {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  const connString = dbUrl(env);
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

  const shippingCents = Number(md.shipping_cents ?? 0) || 0;
  const amountCharged = session.amount_total ?? Number(md.deposit_cents ?? 0);
  const cust = session.customer_details;
  const ship = (session as any).shipping_details ?? null;
  const addr = ship?.address ?? cust?.address ?? null;

  // Supabase pooler requires TLS; postgres.js defaults ssl off. fetch_types/max
  // tuned for the transaction pooler + short-lived Worker invocations.
  const sql = postgres(connString, { prepare: false, ssl: "require", fetch_types: false, max: 1 });
  try {
    await sql.begin(async (tx) => {
      // Idempotent on Stripe retries via the unique `stamp`.
      const inserted = await tx`
        insert into orders (
          stamp, tier, payment_status,
          stripe_payment_intent_id, stripe_checkout_session_id,
          amount_charged_cents, shipping_cents, currency,
          customer_name, customer_email, customer_phone,
          address_line, address_postal, address_city, paid_at
        ) values (
          ${stamp}, ${tier}, 'ok',
          ${(session.payment_intent as string | null) ?? null}, ${session.id},
          ${amountCharged}, ${shippingCents}, ${(session.currency ?? "eur").toUpperCase()},
          ${ship?.name ?? cust?.name ?? null}, ${cust?.email ?? null}, ${cust?.phone ?? null},
          ${addr?.line1 ?? null}, ${addr?.postal_code ?? null}, ${addr?.city ?? null}, now()
        )
        on conflict (stamp) do nothing
        returning id
      `;
      if (inserted.length === 0) return; // already processed
      const orderId = inserted[0].id;
      for (const l of lines) {
        await tx`
          insert into order_items
            (order_id, sku, item_name, section, unit_price_cents, quantity, line_total_cents)
          values
            (${orderId}, ${l.sku}, ${l.name}, ${l.section}, ${l.unit}, ${l.quantity}, ${l.unit * l.quantity})
        `;
      }
    });
  } catch (err) {
    console.error("webhook db write failed", err);
    // TEMP: surface the real error in the response so we can diagnose from Stripe's delivery log.
    return new Response("db error: " + ((err as any)?.message ?? String(err)), { status: 500 });
  } finally {
    await sql.end();
  }

  return new Response("ok", { status: 200 });
};
