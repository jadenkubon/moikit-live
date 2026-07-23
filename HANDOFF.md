# MoiKit checkout — handoff (updated 2026-07-23)

## TL;DR — checkout works end-to-end ✅
The full Stripe deposit-checkout pipeline is **done and verified against the live
DB**: builder → `/api/checkout` (50% deposit session) → customer pays → Stripe
`checkout.session.completed` → **`/api/stripe-webhook` writes the order + itemized
lines** as least-privilege `moikit_writer`. A real event lands 1 order + 17 line
items with correct money, PII, and totals, and it's idempotent (repeat deliveries
don't duplicate). No open blockers.

The remaining items below are **enhancements, not blockers.**

---

## What was the blocker, and how it was fixed (2026-07-23)
The webhook DB write failed. It turned out to be **three** bugs in sequence:

1. **`permission denied for table orders`** — *not* a grants issue. **RLS was
   enabled** on `orders`/`order_items` outside the migrations (Supabase dashboard
   security advisor) **with zero policies**, so `moikit_writer` was blocked
   regardless of grants. → migration
   `supabase/migrations/20260723150000_rls_policies_for_order_roles.sql` declares
   per-role policies (writer insert/select, callback select/update, admin
   select/update) and folds in `select (id, stamp)`. RLS is now part of the schema.
2. **`cannot call jsonb_to_recordset on a non-array` → `malformed array literal`** —
   postgres.js can't reliably encode a **list-shaped parameter** under this Worker's
   config (`prepare:false` + `fetch_types:false` + Hyperdrive). It mangled both a
   `JSON.stringify()::jsonb` string and a native `unnest()` array. → pass the item
   list via **`sql.json(itemsArr)`**, which encodes the array itself.
3. **Type mismatch** — `sql.json()` binds as **jsonb** (OID 3802), but the query
   called `json_to_recordset` (expects `json`, OID 114). → use
   **`jsonb_to_recordset`** to match.

Commits: `c06473f` (RLS migration + fix + committed the previously-untracked 0002
migration) → `e79c537` (jsonb_to_recordset) → `c174a8b` (removed temp diagnostics).

### How to reproduce / re-verify quickly
- **Resend the canonical test event** (Stripe CLI is installed + paired):
  ```
  stripe events resend evt_1TwCTqRyQ7IlSVC6YdpKL2lk --webhook-endpoint we_1Tw9zCRyQ7IlSVC6MgZfDF9V
  ```
  (stripe.exe lives at
  `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Stripe.StripeCli_*\stripe.exe` if not on PATH.)
- **Check the DB** (read-only, runs as `postgres`):
  ```
  supabase db query --linked --workdir C:\Users\jkubon\moikit-live -o json "select count(*) from orders"
  ```
- The webhook endpoint is `we_1Tw9zCRyQ7IlSVC6MgZfDF9V` → `/api/stripe-webhook`, test mode.

---

## Remaining work (enhancements, prioritized)
1. ~~**Order-success page**~~ — DONE. `/checkout/success` reads the session back from
   Stripe (`success_url` now carries `{CHECKOUT_SESSION_ID}`) and shows the itemized
   order, deposit paid and cash balance; cancel shows a banner on the kit page.
   Both fall back gracefully — the success page never errors, because the money is
   already taken and the webhook, not the page, owns the record.
2. **Exercise the other paths** — pricing is verified offline for all three tiers,
   every single-room partial cart, multi-quantity lines and bad keys (all pass;
   each kit's items sum exactly to its listed price). Still worth **one real test
   purchase** through Stripe on a non-basic tier to confirm the deposit charged and
   the emails sent.
2b. **Order emails** — `src/lib/notify.ts` (Resend) is wired into the webhook but
   dormant until `RESEND_API_KEY` / `ORDER_FROM` / `OWNER_EMAIL` are set as Worker
   secrets and the sending domain is verified in Resend. The webhook now only
   notifies when the insert created a row, so redelivered events don't re-email.
3. **Confirm deposit math with the owner** — currently 50% of *items only* is
   charged via Stripe (basic €240 → €120); shipping €30 + remaining 50% are cash on
   delivery. Verify this is the intended split.
4. **Delete the test order** — one row (`id 3`, "Playwright Test",
   `pwtest@moikit.fi`) sits in the DB from verification. Harmless; remove before
   go-live: `delete from orders where stamp = '34771de5-cc6a-44f4-90fe-e2b1904ee317';`
5. **Admin read app** — not built. Reads orders via `moikit_admin` (SELECT+UPDATE,
   behind OAuth). RLS policies for it are already in place from migration 0003.
6. **Go-live switches** — swap Stripe test keys → live (`sk_live`/`pk_live`), point
   the live webhook at `/api/stripe-webhook`, set the live signing secret.

---

## Reference: the moving parts
- **Repo (canonical):** `C:\Users\jkubon\moikit-live` → github.com/jadenkubon/**moikit-live**,
  branch `main`. Push to `main` **auto-deploys to Cloudflare** (Git integration;
  `wrangler` CLI is NOT logged in). Build: `npm run build` (Astro). The dead
  snapshots `moikit-astro`/`moikit-static` and the stale `Documents\GitHub\moikit-live`
  clone have been deleted. (`C:\Users\jkubon\moikit-site` is a separate old plain-HTML
  build, untracked — left in place.)
- **Architecture (Option B):** product catalog lives in `src/data/kits.ts` (source of
  truth); DB holds **orders only**. 3 kits basic/premium/platinum (€240/310/475),
  each bedroom+kitchen+bathroom, items sum exactly to the kit price. Builder item key
  = `"<section>-<index>"` (e.g. `bedroom-0`), matched against `kits.ts` server-side in
  checkout + webhook.
- **Payment flow:** public `/api/checkout` (no DB, Stripe 50%-deposit session) →
  customer pays → **`/api/stripe-webhook`** is the ONLY writer (as `moikit_writer`).
- **Supabase:** project `moikit-site-db`, ref **`lpqadedqprurzhezoeoy`**, PG17,
  eu-central-1. Linked via `supabase` CLI (DB password cached in Windows Credential
  Manager). Migrations: `20260722120000` (initial, superseded), `20260722140000`
  (Option B, orders-only), `20260723150000` (RLS policies). All applied.
- **DB roles:** `moikit_writer` (LOGIN; INSERT + SELECT(id,stamp) on order tables +
  RLS insert/select policies), `moikit_callback` (status updates), `moikit_admin`
  (SELECT+UPDATE, for the future admin app). RLS is ON with per-role policies.
- **Cloudflare:** account `Moikit.fi@proton.me`, Worker **`moikit-live`**,
  `https://moikit-live.moikit-fi.workers.dev`. Secrets: `STRIPE_SECRET_KEY` (sk_test),
  `STRIPE_WEBHOOK_SECRET` (whsec test), `DATABASE_URL` (fallback). **Hyperdrive**
  binding `HYPERDRIVE`, id **`566e67c30a944a638d0f2693f464eab2`** → Supabase Session
  pooler (`aws-0-eu-central-1.pooler.supabase.com:5432`) as
  `moikit_writer.lpqadedqprurzhezoeoy`.
- **Stripe:** TEST mode, account "MoiKit Oy". Webhook endpoint `we_1Tw9zCRyQ7IlSVC6MgZfDF9V`
  → `/api/stripe-webhook`, event `checkout.session.completed`. Test card `4242 4242 4242 4242`.
  Stripe CLI installed + paired (`stripe login`) for resending events.
- **Tooling permissions:** `settings.local.json` allows `Bash(supabase db query *)`,
  `Bash(supabase db push *)`, `Bash(stripe events *)` etc. Note the harness blocks an
  agent from editing its OWN permissions file — a human must add rules there.
- **Key files:** `src/pages/api/checkout.ts`, `src/pages/api/stripe-webhook.ts`,
  `src/data/kits.ts`, `src/pages/kits/[slug].astro`,
  `supabase/migrations/20260723150000_rls_policies_for_order_roles.sql`, `wrangler.jsonc`.
- Deeper background is in the memory file `moikit-project.md`.
