import type { APIRoute } from "astro";
import postgres from "postgres";

export const prerender = false;

// -----------------------------------------------------------------------------
// POST /api/withdraw  — the Article 11a withdrawal function.
//
// EU distance-selling law requires that a consumer can withdraw ONLINE, get an
// on-screen acknowledgement, and receive confirmation on a DURABLE MEDIUM
// without undue delay. So the order of operations matters:
//
//   1. RECORD the request FIRST. A statutory right must not depend on an email
//      delivering. If the insert fails we say so and point them at a human,
//      rather than showing a confirmation for something we did not keep.
//   2. Email the buyer (their durable copy) and the owner (so it gets actioned).
//      Best effort: a bounced email must never invalidate a withdrawal that is
//      already legally recorded.
//
// The buyer types their own order reference, so it is accepted as FREE TEXT — a
// withdrawal is valid even if they mistype it or cannot find it.
// -----------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseAddress(header: string): { name: string; addr: string } | null {
  const m = header.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^"|"$/g, ""), addr: m[2].trim() };
  const bare = header.trim();
  return bare.includes("@") ? { name: "", addr: bare } : null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  const usingHyperdrive = !!env.HYPERDRIVE?.connectionString;
  const connString = usingHyperdrive ? env.HYPERDRIVE.connectionString : (env.DATABASE_URL ?? null);
  if (!connString) return json({ error: "not configured" }, 503);

  let body: { orderRef?: string; name?: string; email?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const email = String(body.email ?? "").trim().slice(0, 200);
  const name = String(body.name ?? "").trim().slice(0, 200);
  const orderRef = String(body.orderRef ?? "").trim().slice(0, 64);
  const message = String(body.message ?? "").trim().slice(0, 2000);

  // Only the email is strictly required — it is how we confirm back to them.
  if (!email.includes("@") || email.length < 5) {
    return json({ error: "Please give the email address you used for the order." }, 400);
  }

  const sql = postgres(connString, {
    prepare: false,
    fetch_types: false,
    max: 1,
    ...(usingHyperdrive ? {} : { ssl: "require" as const }),
  });

  let id: number | null = null;
  const receivedAt = new Date();
  try {
    const rows = await sql<{ id: number }[]>`
      insert into withdrawal_requests (order_ref, customer_name, customer_email, message)
      values (${orderRef || null}, ${name || null}, ${email}, ${message || null})
      returning id
    `;
    id = rows[0]?.id ?? null;
  } catch (err) {
    console.error("withdrawal insert failed", (err as any)?.code ?? "", (err as any)?.message ?? "");
    return json(
      { error: "We could not record that. Please email moi@moikit.fi so your withdrawal is not lost." },
      500,
    );
  } finally {
    await sql.end();
  }

  const stamp = receivedAt.toLocaleString("en-GB", { timeZone: "Europe/Helsinki" });
  const reference = "W" + String(id ?? 0).padStart(5, "0");
  const sender = env?.ORDER_FROM ? parseAddress(env.ORDER_FROM) : null;

  // --- buyer's durable-medium confirmation (best effort) --------------------
  if (sender && env?.CUSTOMER_EMAILER) {
    const rows = [
      ["Reference", reference],
      ["Received", stamp + " (Helsinki)"],
      ...(orderRef ? [["Your order", orderRef]] : []),
    ]
      .map(
        ([k, v]) =>
          '<tr><td style="padding:4px 0;color:#8a8175">' +
          esc(k) +
          '</td><td style="padding:4px 0;text-align:right"><strong>' +
          esc(v) +
          "</strong></td></tr>",
      )
      .join("");

    try {
      await env.CUSTOMER_EMAILER.send({
        to: email,
        from: { email: sender.addr, name: sender.name || "MoiKit" },
        ...(env?.OWNER_EMAIL ? { replyTo: env.OWNER_EMAIL } : {}),
        subject: "We received your withdrawal (" + reference + ")",
        html:
          '<div style="max-width:560px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#16211F">' +
          '<h2 style="font-size:19px;margin:0 0 10px">Your withdrawal has been received.</h2>' +
          '<p style="margin:0 0 16px;color:#4a534f">This confirms we received your decision to withdraw from your MoiKit order. Keep this email — it is your durable record.</p>' +
          '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' + rows + "</table>" +
          (message
            ? '<p style="margin:0 0 16px;padding:10px 12px;background:#F6EFE2;border-radius:6px">' + esc(message) + "</p>"
            : "") +
          '<p style="margin:0 0 16px;color:#4a534f">We will be in touch to arrange collection and your refund. If your kit has already arrived, please keep it available for collection.</p>' +
          '<p style="margin:0;color:#8a8175;font-size:13px">Questions? Just reply to this email.</p>' +
          "</div>",
        text: [
          "Your withdrawal has been received.",
          "",
          "Reference: " + reference,
          "Received: " + stamp + " (Helsinki)",
          ...(orderRef ? ["Your order: " + orderRef] : []),
          ...(message ? ["", message] : []),
          "",
          "We will be in touch to arrange collection and your refund. If your kit",
          "has already arrived, please keep it available for collection.",
          "",
          "Keep this email - it is your durable record of the withdrawal.",
        ].join("\n"),
      });
    } catch (err) {
      console.error("withdrawal customer email failed", err);
    }
  }

  // --- owner alert (best effort) --------------------------------------------
  if (sender && env?.OWNER_EMAILER && env?.OWNER_EMAIL) {
    try {
      await env.OWNER_EMAILER.send({
        to: env.OWNER_EMAIL,
        from: { email: sender.addr, name: sender.name || "MoiKit" },
        replyTo: email,
        subject: "WITHDRAWAL " + reference + (orderRef ? " — order " + orderRef : ""),
        html:
          '<div style="max-width:560px;font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#16211F">' +
          '<h2 style="font-size:19px;margin:0 0 10px">Withdrawal request — action needed</h2>' +
          '<p style="margin:0 0 16px;padding:10px 12px;background:#FBEBD3;border-radius:6px">Statutory deadline: refund within <strong>14 days</strong>.</p>' +
          '<table style="width:100%;border-collapse:collapse">' +
          '<tr><td style="padding:4px 0;color:#8a8175">Reference</td><td style="padding:4px 0;text-align:right"><strong>' + esc(reference) + "</strong></td></tr>" +
          '<tr><td style="padding:4px 0;color:#8a8175">Order quoted</td><td style="padding:4px 0;text-align:right">' + esc(orderRef || "(none given)") + "</td></tr>" +
          '<tr><td style="padding:4px 0;color:#8a8175">Name</td><td style="padding:4px 0;text-align:right">' + esc(name || "(not given)") + "</td></tr>" +
          '<tr><td style="padding:4px 0;color:#8a8175">Email</td><td style="padding:4px 0;text-align:right">' + esc(email) + "</td></tr>" +
          '<tr><td style="padding:4px 0;color:#8a8175">Received</td><td style="padding:4px 0;text-align:right">' + esc(stamp) + "</td></tr>" +
          "</table>" +
          (message
            ? '<p style="margin:16px 0 0;padding:10px 12px;background:#F6EFE2;border-radius:6px">' + esc(message) + "</p>"
            : "") +
          "</div>",
        text:
          "Withdrawal " + reference +
          "\nOrder: " + (orderRef || "(none)") +
          "\nName: " + (name || "(none)") +
          "\nEmail: " + email +
          "\nReceived: " + stamp +
          (message ? "\n\n" + message : "") +
          "\n\nRefund due within 14 days.",
      });
    } catch (err) {
      console.error("withdrawal owner email failed", err);
    }
  }

  return json({ ok: true, reference, receivedAt: receivedAt.toISOString() });
};
