// -----------------------------------------------------------------------------
// Order notifications — owner alert + customer confirmation, sent from the
// webhook after the order is safely written.
//
// Deliberately dependency-free (one fetch to Resend's HTTP API) so it adds no
// weight to the Worker, and deliberately UNFAILING: a bounced email must never
// turn a paid order into a 500 for Stripe, which would trigger redelivery of an
// event whose money and row are already committed. Every path here resolves.
//
// Env (Cloudflare secrets/vars, all optional — unset means "don't send"):
//   RESEND_API_KEY   – Resend API key (secret)
//   ORDER_FROM       – From: header, e.g. "MoiKit <orders@moikit.fi>" (domain
//                      must be verified in Resend)
//   OWNER_EMAIL      – where the "new order" alert goes
// -----------------------------------------------------------------------------

export interface NotifyLine {
  name: string;
  quantity: number;
  unit: number; // cents
}

export interface NotifyOrder {
  ref: string; // short human reference (first 8 of stamp)
  tier: string;
  kitName: string;
  lines: NotifyLine[];
  subtotalCents: number;
  shippingCents: number;
  depositCents: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  addressLine: string | null;
  addressPostal: string | null;
  addressCity: string | null;
}

const eur = (cents: number) => "€" + (cents / 100).toFixed(2);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function send(
  apiKey: string,
  body: { from: string; to: string; subject: string; html: string; reply_to?: string },
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Body text is Resend's error detail — useful in a Worker tail, harmless to log.
    console.error("resend send failed", res.status, await res.text().catch(() => ""));
  }
}

function itemRows(o: NotifyOrder) {
  return o.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 0;color:#4a534f">${esc(l.name)}${
          l.quantity > 1 ? ` × ${l.quantity}` : ""
        }</td><td style="padding:4px 0;text-align:right;color:#8a8175;white-space:nowrap">${eur(
          l.unit * l.quantity,
        )}</td></tr>`,
    )
    .join("");
}

function moneyBlock(o: NotifyOrder) {
  const total = o.subtotalCents + o.shippingCents;
  const balance = Math.max(0, total - o.depositCents);
  return `
    <table style="width:100%;border-collapse:collapse;font:15px/1.5 -apple-system,Segoe UI,sans-serif;margin-top:14px;border-top:1px solid #E4D8C4;padding-top:8px">
      <tr><td style="padding:4px 0;color:#4a534f">Items</td><td style="padding:4px 0;text-align:right;color:#4a534f">${eur(o.subtotalCents)}</td></tr>
      <tr><td style="padding:4px 0;color:#4a534f">Delivery</td><td style="padding:4px 0;text-align:right;color:#4a534f">${eur(o.shippingCents)}</td></tr>
      <tr><td style="padding:6px 0;font-weight:600;border-top:1px solid #E4D8C4">Total</td><td style="padding:6px 0;text-align:right;font-weight:600;border-top:1px solid #E4D8C4">${eur(total)}</td></tr>
      <tr><td style="padding:4px 0;color:#1F3A3D">Deposit paid online</td><td style="padding:4px 0;text-align:right;color:#1F3A3D">− ${eur(o.depositCents)}</td></tr>
      <tr><td style="padding:10px 12px;background:#FBEBD3;font-weight:700;border-radius:6px">Balance — cash on delivery</td><td style="padding:10px 12px;background:#FBEBD3;text-align:right;font-weight:700;border-radius:6px">${eur(balance)}</td></tr>
    </table>`;
}

function addressBlock(o: NotifyOrder) {
  const parts = [
    o.customerName,
    o.addressLine,
    [o.addressPostal, o.addressCity].filter(Boolean).join(" "),
    o.customerPhone,
    o.customerEmail,
  ].filter((p) => p && String(p).trim());
  return parts.map((p) => esc(String(p))).join("<br>");
}

/**
 * Fire both notification emails. Never throws and never rejects — callers can
 * `await` it without guarding.
 */
export async function notifyNewOrder(env: any, o: NotifyOrder): Promise<void> {
  const apiKey = env?.RESEND_API_KEY;
  const from = env?.ORDER_FROM;
  const owner = env?.OWNER_EMAIL;
  if (!apiKey || !from) return; // not configured yet — silently skip

  const jobs: Promise<void>[] = [];

  // --- owner: what to buy, where it goes, what to collect -------------------
  if (owner) {
    jobs.push(
      send(apiKey, {
        from,
        to: owner,
        ...(o.customerEmail ? { reply_to: o.customerEmail } : {}),
        subject: `New MoiKit order ${o.ref} — ${o.kitName} (${eur(o.depositCents)} deposit paid)`,
        html: `<div style="max-width:560px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#16211F">
          <h2 style="font-size:19px;margin:0 0 4px">New order — ${esc(o.kitName)}</h2>
          <p style="margin:0 0 16px;color:#8a8175;font-size:13px">REF ${esc(o.ref)} · tier ${esc(o.tier)}</p>
          <h3 style="font-size:15px;margin:0 0 6px">Deliver to</h3>
          <p style="margin:0 0 18px;color:#4a534f">${addressBlock(o)}</p>
          <h3 style="font-size:15px;margin:0 0 6px">Items to pack (${o.lines.length})</h3>
          <table style="width:100%;border-collapse:collapse">${itemRows(o)}</table>
          ${moneyBlock(o)}
        </div>`,
      }),
    );
  }

  // --- customer: confirmation, mirrors the success page ---------------------
  if (o.customerEmail) {
    jobs.push(
      send(apiKey, {
        from,
        to: o.customerEmail,
        // The body says "just reply to this email"; `from` is a send-only Resend
        // identity, so point replies at a mailbox a human actually reads.
        ...(owner ? { reply_to: owner } : {}),
        subject: `Your MoiKit order is confirmed (${o.ref})`,
        html: `<div style="max-width:560px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#16211F">
          <h2 style="font-size:19px;margin:0 0 4px">Kiitos${o.customerName ? ", " + esc(o.customerName.split(" ")[0]) : ""} — your kit is booked.</h2>
          <p style="margin:0 0 16px;color:#4a534f">Your deposit is paid. We'll be in touch to confirm the delivery date for your address in Lappeenranta.</p>
          <p style="margin:0 0 16px;color:#8a8175;font-size:13px">Order reference <strong style="color:#16211F">${esc(o.ref)}</strong></p>
          <h3 style="font-size:15px;margin:0 0 6px">${esc(o.kitName)}</h3>
          <table style="width:100%;border-collapse:collapse">${itemRows(o)}</table>
          ${moneyBlock(o)}
          <h3 style="font-size:15px;margin:22px 0 6px">What happens next</h3>
          <ol style="margin:0 0 18px;padding-left:18px;color:#4a534f">
            <li>We email you to confirm your address and move-in date.</li>
            <li>We deliver everything in one drop, in cooperation with LOAS.</li>
            <li>You pay the remaining balance in cash when it arrives.</li>
          </ol>
          <p style="margin:0;color:#8a8175;font-size:13px">Questions? Just reply to this email.</p>
        </div>`,
      }),
    );
  }

  try {
    await Promise.all(jobs);
  } catch (err) {
    console.error("order notification failed", err);
  }
}
