# MoiKit — site & project handoff (2026-07-23)

Broad state of the project and the remaining **site/product work**, separate from
the narrow payment bug. For the one open checkout blocker (webhook DB write fails
with `permission denied for table orders`), see **`HANDOFF.md`**.

---

## What MoiKit is
Finnish home-essentials storefront for newcomers to Lappeenranta. You pick one of
three pre-built kits — **Basic €240 / Premium €310 / Platinum €475** — each a full
**bedroom + kitchen + bathroom** bundle whose price equals the exact sum of its
itemized parts. A builder lets you drop whole rooms or individual items (e.g. just
the kitchen), and the total updates live. Payment is a **50% deposit online
(Stripe), balance in cash on delivery** (delivery €30, in cooperation with LOAS).
Audience: LUT students, exchange/international arrivals, new renters.

## Stack & repos
- **Astro 5 + Tailwind v4**, deployed as a **Cloudflare Worker** (Git-integration
  build on push to `main`; `@astrojs/cloudflare` adapter, static pages + server
  API routes).
- **Supabase Postgres** (eu-central-1) for orders only.
- **Canonical repo:** `C:\Users\jkubon\moikit-live` → github.com/jadenkubon/**moikit-live**.
  `moikit-astro` and `moikit-static` are **dead snapshots** — ignore them (see
  cleanup below).

## Architecture decision — "Option B" (important)
The **product catalog lives in `src/data/kits.ts`** (single source of truth, with
images + copy). The **database stores orders only** — no catalog tables. Checkout
and the webhook import `kits.ts` server-side to price/validate. This was a
deliberate reversal of an earlier catalog-in-DB design (migration 0001) after we
found the DB catalog didn't match the real `kits.ts`. Migration
`20260722140000_orders_only_catalog_in_app.sql` drops the catalog tables and keeps
`orders` + `order_items` + `app_settings` + roles.

Builder item identity: each item's key is `"<section>-<index>"` (e.g. `bedroom-0`),
its position in `kits.ts`. Checkout/webhook resolve keys back to name/price from
`kits.ts`. Snapshots (`order_items`) freeze name + price at purchase.

---

## Current state

### Done / working
- **Storefront** (`src/pages/index.astro`, `src/pages/kits/[slug].astro`): home,
  3 kit detail pages, live builder (drop rooms/items, running total, deposit line),
  comparison table, related-kit cross-sell, item thumbnails/lightbox, FAQ, header
  (trust rotator) + footer. Deployed at `https://moikit-live.moikit-fi.workers.dev`.
- **Checkout UI**: "Pay with Stripe" buttons wired to `/api/checkout`; FAQ + deposit
  copy updated to Stripe + 50% deposit.
- **Schema** applied to Supabase (`orders`, `order_items`, `order_totals` view,
  `app_settings` shipping=3000, least-privilege roles). See `HANDOFF.md`/memory for IDs.
- **Payment pipeline** — complete end-to-end, including the webhook order write
  (see `HANDOFF.md` for the three bugs that were fixed on 2026-07-23).
- **Order success + cancel pages** — `/checkout/success` reads the Stripe session
  back and shows items, deposit paid and cash balance; `?checkout=cancelled` shows
  a reassurance banner on the kit page.
- **Pricing verified** for all three tiers, every single-room partial cart, multi-
  quantity lines and out-of-range keys (each kit's items sum exactly to its price).

### Blocked
- Nothing. The remaining roadmap items below are unstarted, not blocked.

---

## Remaining site/product work (roadmap)

### 1. Owner "what to buy" admin app  ← the next big piece
A **separate** codebase/site, gated by **OAuth** (owner login), that reads paid
orders and shows a **procurement list** (what to physically buy to fulfil), plus
per-order detail for packing/delivery.
- Read path uses role **`moikit_admin`** (SELECT+UPDATE) — or, for a server-rendered
  internal tool behind owner auth, the Supabase `service_role` key is acceptable
  (it's not the public path). It is **never** exposed to the storefront.
- Core query (buy list): `select item_name, sum(quantity) from order_items oi
  join orders o on o.id=oi.order_id where o.payment_status='ok' group by item_name
  order by 2 desc;`
- Also: order list w/ customer + address + deposit vs balance (`order_totals` view
  gives derived subtotal/total; balance = total − amount_charged_cents).
- Fulfilment: let owner flip status / mark delivered (UPDATE on orders).
- Not started. Blocked only on the webhook write producing real rows to read.

### 2. Finnish localization
DB is English-only by design; the plan is a **frontend translation layer keyed on
the item identifier** (sku/section-index) mapping EN↔FI display strings. The
storefront is currently English-only. Item names, kit copy, FAQ, UI chrome all
need FI. No `_fi` columns in the DB — keep translations in the app.

### 3. Order success / cancel pages — DONE (2026-07-23)
`src/pages/checkout/success.astro` (server-rendered) retrieves the Stripe session
via `?session_id={CHECKOUT_SESSION_ID}` and shows the itemized order, deposit paid,
and cash balance, degrading to a plain thank-you if the lookup fails. The kit page
reveals a cancelled banner on `?checkout=cancelled` and strips the param.

### 4. Notifications / email — CODE DONE, NEEDS CONFIG
`src/lib/notify.ts` sends an owner "new order" alert (delivery address + pack list
+ balance to collect) and a customer confirmation, via Resend's HTTP API, called
from the webhook only when the insert actually created a row (so a Stripe
redelivery doesn't re-send). It is a no-op until these are set on the Worker:
`RESEND_API_KEY`, `ORDER_FROM` (verified sender, e.g. `MoiKit <orders@moikit.fi>`),
`OWNER_EMAIL`. Failures are logged, never surfaced — a bounced email must not turn
a paid order into a 500 and trigger endless Stripe redelivery.

### 5. Repo cleanup
- **Delete `moikit-astro`** (Claude created it by mistake; owner approved deletion).
  Blocked: the `gh` token lacks `delete_repo` scope — run `gh auth refresh -h
  github.com -s delete_repo` then `gh repo delete jadenkubon/moikit-astro --yes`,
  or delete via GitHub UI.
- **Keep `moikit-static`** (owner uses it; don't touch).
- Optionally remove the local `C:\Users\jkubon\moikit-astro` folder (defunct clone).

### 6. Testing / polish
- Exercise **premium & platinum** kits and **partial carts** (drop rooms) end-to-end
  once the webhook writes.
- Product/Offer structured data, OG images, canonical `moikit.fi`, favicon (per the
  original brief's quality floor) — verify these are all present.
- Custom domain: currently on `*.workers.dev`; wire `moikit.fi` when ready.
- Accessibility/responsive/reduced-motion pass.

### 7. Go-live checklist (later)
- Swap Stripe **test → live** keys (Cloudflare secrets) + create a **live** webhook
  endpoint; update `STRIPE_WEBHOOK_SECRET`.
- Confirm the 6-year retention / anonymisation plan for `orders` PII (columns are
  nullable + `anonymised_at` exists; the anonymisation job itself isn't built).
- Confirm deposit math with owner (currently 50% of *items*; shipping + rest cash).

---

## Reference (where things live)
- **Frontend:** `src/pages/index.astro`, `src/pages/kits/[slug].astro`,
  `src/components/*`, `src/data/kits.ts` (the catalog — edit prices/items here),
  `src/data/itemImages.ts`, `public/img/items/*`.
- **Server:** `src/pages/api/checkout.ts`, `src/pages/api/stripe-webhook.ts`.
- **DB:** `supabase/migrations/` (0001 initial/superseded, 0002 Option B). Linked
  via `supabase` CLI (DB password cached in Windows Credential Manager →
  `supabase db push` works). Project `moikit-site-db`, ref `lpqadedqprurzhezoeoy`.
- **Cloudflare:** Worker `moikit-live`, account `Moikit.fi@proton.me`,
  `wrangler.jsonc` (Hyperdrive binding for DB). Deploys on git push.
- **Test harness:** `…/scratchpad/pwtest/test.mjs` (Playwright full-purchase driver).
- **Deeper context:** memory file `moikit-project.md`; payment bug in `HANDOFF.md`.

## Suggested next-session order
1. Fix the webhook DB write (`HANDOFF.md`) — unblocks everything downstream.
2. Success page + owner email (so a real order is visibly complete).
3. Owner "what to buy" admin app.
4. Finnish localization.
5. Repo cleanup, go-live checklist.
