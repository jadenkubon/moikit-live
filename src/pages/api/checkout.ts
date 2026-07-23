import type { APIRoute } from "astro";
import Stripe from "stripe";
import { kitBySlug, SHIPPING_EUR } from "../../data/kits";

// Server-rendered on the Worker (not prerendered).
export const prerender = false;

// -----------------------------------------------------------------------------
// POST /api/checkout  — the PUBLIC checkout path.
//
// Does NOT touch the database and holds no order credential. It:
//   1. prices + validates the cart server-side against kits.ts (source of truth),
//   2. creates a Stripe Checkout Session for the 50% DEPOSIT,
// and writes nothing. The order is written later by /api/stripe-webhook once
// payment succeeds. Prices come from kits.ts here, so a tampered client payload
// can never change what is charged.
//
// Request:  { tier: "basic"|"premium"|"platinum", lines: [{ key, quantity }] }
//   where `key` is the builder's data-key, "<section>-<index>" (e.g. "bedroom-0").
// Env (Cloudflare secret): STRIPE_SECRET_KEY
// -----------------------------------------------------------------------------

const TIERS = new Set(["basic", "premium", "platinum"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface CartLine {
  key: string;
  quantity: number;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Checkout is not configured yet." }, 503);
  }

  let payload: { tier?: string; lines?: CartLine[] };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const tier = String(payload.tier ?? "").toLowerCase();
  if (!TIERS.has(tier)) {
    return json({ error: "Pick a kit (basic, premium or platinum) first." }, 400);
  }
  const kit = kitBySlug(tier);

  // Resolve every line against kits.ts — authoritative name + price, membership check.
  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  const resolved: { key: string; name: string; unit: number; quantity: number }[] = [];
  let subtotalCents = 0;
  for (const l of rawLines) {
    const key = String(l?.key ?? "");
    let q = Math.floor(Number(l?.quantity ?? 0));
    if (!key || !Number.isFinite(q) || q <= 0) continue;
    q = Math.min(9, q);

    const dash = key.lastIndexOf("-");
    const section = key.slice(0, dash);
    const idx = Number(key.slice(dash + 1));
    const item = kit.rooms[section]?.[idx];
    if (!item) {
      // sku not a member of this tier → stale or tampered client. Reject.
      return json({ error: `"${key}" is not part of the ${tier} kit.` }, 400);
    }
    const unit = Math.round(item.eur * 100); // gross cents
    subtotalCents += unit * q;
    resolved.push({ key, name: item.item, unit, quantity: q });
  }
  if (resolved.length === 0) {
    return json({ error: "Your kit is empty." }, 400);
  }

  const shippingCents = SHIPPING_EUR * 100;
  const depositCents = Math.round(subtotalCents * 0.5); // 50% deposit; balance is cash on delivery

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  const origin = new URL(request.url).origin;
  const stamp = crypto.randomUUID(); // non-PII; the webhook writes the order under this

  // Compact cart for the webhook (well under Stripe's 500-char metadata limit).
  const cart = resolved.map((r) => `${r.key}:${r.quantity}`).join(",");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: depositCents,
            tax_behavior: "inclusive",
            product_data: {
              name: `${kit.name} — 50% deposit`,
              description: `Deposit today; the balance (incl. €${SHIPPING_EUR} delivery) is paid in cash on delivery.`,
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["FI"] },
      phone_number_collection: { enabled: true },
      metadata: {
        tier,
        stamp,
        cart,
        items_subtotal_cents: String(subtotalCents),
        shipping_cents: String(shippingCents),
        deposit_cents: String(depositCents),
      },
      // {CHECKOUT_SESSION_ID} is substituted by Stripe on redirect; the success
      // page reads the session back to show what was paid and what's still due.
      success_url: `${origin}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/kits/${tier}/?checkout=cancelled`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("stripe checkout session error", err);
    return json({ error: "Could not start checkout. Try again." }, 502);
  }
};
