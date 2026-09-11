// -----------------------------------------------------------------------------
// Order notifications — owner alert + customer confirmation, sent from the
// webhook after the order is safely written.
//
// Split by channel (a deliberate decision):
//   • OWNER "new order" alert → Cloudflare Email Routing via the `send_email`
//     binding. Free, no external service; just needs Email Routing on moikit.fi
//     and the owner address verified as a destination.
//   • CUSTOMER confirmation → Resend, so it's a branded HTML email that itemizes
//     the order and states the cash balance due (Stripe's own receipt can't —
//     the session is a single "deposit" line item).
//
// Deliberately UNFAILING: a bounced or misconfigured email must never turn a
// paid order into a 500 for Stripe, which would trigger redelivery of an event
// whose money and row are already committed. Every path here resolves.
//
// Env (Cloudflare, all optional — a missing piece just skips that email):
//   OWNER_EMAILER    – `send_email` binding (wrangler.jsonc), for the owner alert
//   OWNER_EMAIL      – verified destination the owner alert is sent to
//   ORDER_FROM       – From: header, e.g. "MoiKit <orders@moikit.fi>" (the sender
//                      domain must be verified in BOTH Resend and Email Routing)
//   RESEND_API_KEY   – Resend API key (secret), for the customer confirmation
// -----------------------------------------------------------------------------

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

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
  deliveryDate: string | null; // requested delivery date, ISO "YYYY-MM-DD"
}

const eur = (cents: number) => "€" + (cents / 100).toFixed(2);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Requested delivery date ISO "YYYY-MM-DD" → "Fri, 12 Sep 2026" (UTC), or null.
function fmtDeliveryDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** Split a "Name <addr@host>" or bare "addr@host" header into parts. */
function parseAddress(header: string): { name: string; addr: string } | null {
  const m = header.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, ""), addr: m[2].trim() };
  const bare = header.trim();
  return bare.includes("@") ? { name: "", addr: bare } : null;
}

// --- shared HTML fragments ---------------------------------------------------

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
  // Only show the deposit/cash-on-delivery split when a balance is actually
  // owed. A paid-in-full order gets a single "paid in full" line instead.
  const tail =
    balance > 0
      ? `<tr><td style="padding:4px 0;color:#1F3A3D">Deposit paid online</td><td style="padding:4px 0;text-align:right;color:#1F3A3D">− ${eur(o.depositCents)}</td></tr>
      <tr><td style="padding:10px 12px;background:#FBEBD3;font-weight:700;border-radius:6px">Balance — cash on delivery</td><td style="padding:10px 12px;background:#FBEBD3;text-align:right;font-weight:700;border-radius:6px">${eur(balance)}</td></tr>`
      : `<tr><td style="padding:10px 12px;background:#DDF0E4;font-weight:700;border-radius:6px">Paid in full — nothing due on delivery</td><td style="padding:10px 12px;background:#DDF0E4;text-align:right;font-weight:700;border-radius:6px">${eur(o.depositCents)}</td></tr>`;
  return `
    <table style="width:100%;border-collapse:collapse;font:15px/1.5 -apple-system,Segoe UI,sans-serif;margin-top:14px;border-top:1px solid #E4D8C4;padding-top:8px">
      <tr><td style="padding:4px 0;color:#4a534f">Items</td><td style="padding:4px 0;text-align:right;color:#4a534f">${eur(o.subtotalCents)}</td></tr>
      <tr><td style="padding:4px 0;color:#4a534f">Delivery</td><td style="padding:4px 0;text-align:right;color:#4a534f">${eur(o.shippingCents)}</td></tr>
      <tr><td style="padding:6px 0;font-weight:600;border-top:1px solid #E4D8C4">Total</td><td style="padding:6px 0;text-align:right;font-weight:600;border-top:1px solid #E4D8C4">${eur(total)}</td></tr>
      ${tail}
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

// --- owner alert: Cloudflare Email Routing -----------------------------------

async function sendOwnerAlert(env: any, o: NotifyOrder): Promise<void> {
  const binding = env?.OWNER_EMAILER;
  const owner = env?.OWNER_EMAIL;
  const sender = env?.ORDER_FROM ? parseAddress(env.ORDER_FROM) : null;
  if (!binding || !owner || !sender) return; // not configured yet — skip

  try {
    const msg = createMimeMessage();
    msg.setSender({ name: sender.name || "MoiKit", addr: sender.addr });
    msg.setRecipient(owner);
    // A customer reply-to means the owner can answer the buyer straight from the alert.
    // mimetext parses address headers as Mailboxes and REJECTS a bare "a@b.com"
    // (it wants the object/angle-bracket form), so pass { addr } — and guard it,
    // because a malformed customer email must never sink the whole owner alert.
    if (o.customerEmail && o.customerEmail.includes("@")) {
      try {
        msg.setHeader("Reply-To", { addr: o.customerEmail });
      } catch {
        /* unparseable address — send the alert without a Reply-To */
      }
    }
    msg.setSubject(
      `New MoiKit order ${o.ref} — ${o.kitName} (${eur(o.depositCents)} deposit paid)`,
    );
    msg.addMessage({
      contentType: "text/html",
      data: `<div style="max-width:560px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#16211F">
        <h2 style="font-size:19px;margin:0 0 4px">New order — ${esc(o.kitName)}</h2>
        <p style="margin:0 0 16px;color:#8a8175;font-size:13px">REF ${esc(o.ref)} · tier ${esc(o.tier)}</p>
        <h3 style="font-size:15px;margin:0 0 6px">Deliver to</h3>
        <p style="margin:0 0 6px;color:#4a534f">${addressBlock(o)}</p>
        ${fmtDeliveryDate(o.deliveryDate) ? `<p style="margin:0 0 18px;color:#B5623C;font-weight:600">Requested delivery: ${fmtDeliveryDate(o.deliveryDate)}</p>` : `<p style="margin:0 0 18px;color:#8a8175;font-size:13px">No delivery date requested</p>`}
        <h3 style="font-size:15px;margin:0 0 6px">Items to pack (${o.lines.length})</h3>
        <table style="width:100%;border-collapse:collapse">${itemRows(o)}</table>
        ${moneyBlock(o)}
      </div>`,
    });

    const email = new EmailMessage(sender.addr, owner, msg.asRaw());
    await binding.send(email);
  } catch (err) {
    console.error("owner email (cloudflare) failed", err);
  }
}

// --- customer confirmation: Cloudflare Email Sending -------------------------
// Sent via the UNRESTRICTED `CUSTOMER_EMAILER` send binding (moikit.fi is
// onboarded to Email Sending: DKIM `cf-bounce`, DMARC in place), so it can reach
// any buyer's inbox — unlike the owner alert, which is restricted to a verified
// Email Routing destination. Uses the object send API (not raw MIME), so the
// address headers are handled by Cloudflare, not mimetext.

async function sendCustomerConfirmation(env: any, o: NotifyOrder): Promise<void> {
  const binding = env?.CUSTOMER_EMAILER;
  const sender = env?.ORDER_FROM ? parseAddress(env.ORDER_FROM) : null;
  const owner = env?.OWNER_EMAIL;
  // Needs the send binding, a valid sender identity, and a usable buyer address.
  if (!binding || !sender || !o.customerEmail || !o.customerEmail.includes("@")) return;

  const first = o.customerName ? esc(o.customerName.split(" ")[0]) : "";
  const balanceCents = o.subtotalCents + o.shippingCents - o.depositCents;
  const delivery = fmtDeliveryDate(o.deliveryDate);

  const html = `<div style="max-width:560px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#16211F">
    <h2 style="font-size:19px;margin:0 0 4px">Kiitos${first ? ", " + first : ""} — your kit is booked.</h2>
    <p style="margin:0 0 16px;color:#4a534f">${balanceCents > 0 ? "Your deposit is paid." : "Your order is paid in full."}${delivery ? ` You've requested delivery on <strong style="color:#16211F">${delivery}</strong> — we'll confirm it and the drop-off time with you.` : " We'll be in touch to confirm your delivery date for your address in Lappeenranta."}</p>
    <p style="margin:0 0 16px;color:#8a8175;font-size:13px">Order reference <strong style="color:#16211F">${esc(o.ref)}</strong></p>
    <h3 style="font-size:15px;margin:0 0 6px">${esc(o.kitName)}</h3>
    <table style="width:100%;border-collapse:collapse">${itemRows(o)}</table>
    ${moneyBlock(o)}
    <h3 style="font-size:15px;margin:22px 0 6px">Deliver to</h3>
    <p style="margin:0 0 6px;color:#4a534f">${addressBlock(o)}</p>
    ${delivery ? `<p style="margin:0 0 18px;color:#8a8175;font-size:13px">Requested delivery date: <strong style="color:#16211F">${delivery}</strong></p>` : ""}
    <h3 style="font-size:15px;margin:22px 0 6px">What happens next</h3>
    <ol style="margin:0 0 18px;padding-left:18px;color:#4a534f">
      <li>We email you to confirm your address and move-in date.</li>
      <li>We deliver everything in one drop, in cooperation with LOAS.</li>
      ${balanceCents > 0 ? `<li>You pay the remaining balance (${eur(balanceCents)}) in cash when it arrives.</li>` : ""}
    </ol>
    <p style="margin:0;color:#8a8175;font-size:13px">Questions? Just reply to this email.</p>
  </div>`;

  // Plain-text alternative — better deliverability and covers text-only clients.
  const text = [
    `Kiitos${o.customerName ? ", " + o.customerName.split(" ")[0] : ""} — your kit is booked.`,
    balanceCents > 0 ? `Your deposit is paid.` : `Your order is paid in full.`,
    delivery ? `Requested delivery date: ${delivery} (we'll confirm it with you).` : `We'll confirm your delivery date separately.`,
    ``,
    `Order reference: ${o.ref}`,
    `Kit: ${o.kitName}`,
    ...o.lines.map((l) => `  ${l.quantity} x ${l.name} — ${eur(l.unit * l.quantity)}`),
    ``,
    ...(balanceCents > 0
      ? [`Deposit paid today: ${eur(o.depositCents)}`, `Balance due in cash on delivery: ${eur(balanceCents)}`]
      : [`Paid in full today: ${eur(o.depositCents)} — nothing due on delivery.`]),
    ``,
    `Deliver to:`,
    [o.customerName, o.addressLine, [o.addressPostal, o.addressCity].filter(Boolean).join(" ")]
      .filter((p) => p && String(p).trim())
      .join(", "),
    ``,
    balanceCents > 0
      ? `What happens next: we confirm your address and move-in date, deliver everything in one drop, and you pay the remaining balance in cash on delivery.`
      : `What happens next: we confirm your address and move-in date, then deliver everything in one drop.`,
    ``,
    `Questions? Just reply to this email.`,
  ].join("\n");

  try {
    await binding.send({
      to: o.customerEmail,
      from: { email: sender.addr, name: sender.name || "MoiKit" },
      // Replies go to a mailbox a human reads, not the send-only From identity.
      ...(owner ? { replyTo: owner } : {}),
      subject: `Your MoiKit order is confirmed (${o.ref})`,
      html,
      text,
    });
  } catch (err) {
    console.error("customer email (cloudflare) failed", err);
  }
}

/**
 * Fire both notification emails. Never throws and never rejects — callers can
 * `await` it without guarding. Each channel fails independently.
 */
export async function notifyNewOrder(env: any, o: NotifyOrder): Promise<void> {
  await Promise.all([sendOwnerAlert(env, o), sendCustomerConfirmation(env, o)]);
}
