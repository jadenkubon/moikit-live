# MoiKit — admin/fulfilment app handoff (2026-07-24)

Brief for building the **owner admin app** in a fresh session. Storefront context
lives in `SITE-HANDOFF.md` / `HANDOFF.md` (same folder); this doc is
self-contained for the admin build.

---

## What to build

A **separate app** (not part of the storefront) where the owner and helpers:

1. **See orders** — list of paid orders with customer, address, phone, items,
   deposit paid vs **cash balance to collect** (this model is 50/50: half paid
   online via Stripe, half collected in cash on delivery).
2. **Check an order off as done** — a fulfilment checkbox per order. Must be
   **stored in the DB** (not localStorage): the check state is shared and
   visible to every logged-in user across accounts/devices.
3. **Group orders into pickup batches** — the operator selects some orders and
   *commits* them to a batch; the app then shows the **aggregated shopping/pick
   list** for that batch: every item summed across the batch's orders. E.g. 3
   kit orders where 2 share the same items → "Mattress (80×200) × 3, Fitted
   sheet × 3, …" so the owner buys everything for a batch in one store run.
   Batches persist (they're the unit of "what am I picking up this trip").

Requirement 1 is a read of existing tables. Requirements 2 and 3 need **schema
additions** (migration proposal below) because no fulfilment or batch columns
exist yet.

---

## The system it plugs into (already live)

- Storefront: Astro 5 + Tailwind v4 on a Cloudflare Worker (`moikit-live`,
  account `Moikit.fi@proton.me`, acct ID `c7abe5c331a57553bb3a8a7709429962`).
  Repo `C:\Users\jkubon\moikit-live` → github.com/jadenkubon/moikit-live; push
  to `main` auto-deploys. **The admin app is a separate codebase/Worker** — do
  not bolt it into the storefront repo (but see "migrations" below).
- **Catalog lives in `src/data/kits.ts`** in the storefront repo ("Option B") —
  the DB stores **orders only**. `order_items` rows are immutable snapshots
  (name + price frozen at purchase), so the admin app needs **no access to
  kits.ts** — everything it displays comes from the DB.
- Supabase Postgres: project `moikit-site-db`, ref **`lpqadedqprurzhezoeoy`**,
  PG17, eu-central-1. Session pooler:
  `aws-0-eu-central-1.pooler.supabase.com:5432`.
- Payment: Stripe Checkout (50% deposit) → webhook writes the order as
  `moikit_writer`. Stripe account `acct_1Tu1HfRyQ7IlSVC6`. Orders carry
  `stripe_payment_intent_id` / `stripe_checkout_session_id`, and the PI is
  stamped with a human REF (`upper(left(stamp,8))`) — support can hop
  Stripe ↔ order in both directions.
- DB is currently **empty** (0 orders — the test order was deleted). Create
  test rows by making a test purchase on
  `https://moikit-live.moikit-fi.workers.dev` (Stripe TEST mode, card
  `4242 4242 4242 4242`), or resend a Stripe event with the CLI.

## Schema that exists (migrations 0002 + 0003, applied)

`orders` — one row per order:
- `id` bigint identity PK · `stamp` text unique (idempotency key; REF = first 8
  chars uppercased) · `tier` enum basic|premium|platinum
- `payment_status` enum ok|pending|delayed|fail — **filter on `= 'ok'` for real
  orders** · `amount_charged_cents` (the deposit actually captured)
- `shipping_cents` (snapshot, 3000) · `vat_rate_bp` (2550) · `currency`
- PII (all nullable, for anonymise-in-place): `customer_name/email/phone`,
  `address_line/postal/city`, `delivery_date`, `notes`
- `created_at/updated_at/paid_at/anonymised_at`

`order_items` — itemized snapshot lines:
- `order_id` FK (cascade) · `sku` (`"<tier>-<section>-<idx>"`) · `item_name` ·
  `section` (bedroom|kitchen|bathroom) · `unit_price_cents` · `quantity` ·
  `line_total_cents` (checked = unit × qty)

`order_totals` — view deriving `items_subtotal_cents` / `total_cents` per order
(nothing stored, can't diverge). **Balance to collect = `total_cents −
amount_charged_cents`.**

**RLS is ON** for both tables with per-role admit-all policies (migration 0003);
column GRANTs do the narrowing. Hard-learned lesson: **any new table must get
RLS + policies + grants in the same migration**, or the role's queries fail
with `permission denied` despite grants.

## DB access for the admin app

Two sanctioned options (the storefront must never see either credential):

1. **`moikit_admin` role** — already exists with SELECT on
   orders/order_items/order_totals + UPDATE on orders/order_items, and RLS
   policies in place. It is **NOLOGIN** — the owner must run
   `alter role moikit_admin with login password '…'` in the Supabase SQL
   editor (password → the admin app's secret), same procedure used for
   `moikit_writer`. Needs the extra grants in the migration below for batches.
2. **Supabase `service_role` key** — acceptable for a server-rendered internal
   tool where every route sits behind owner auth (explicitly OK'd earlier).
   Bypasses RLS and needs no new grants; less least-privilege.

Prefer 1 if using raw SQL over the pooler (postgres.js — note the storefront's
hard-won config for Workers + Hyperdrive/pooler: `prepare:false`,
`fetch_types:false`, pass JSON params via `sql.json()`). Prefer 2 if using
`@supabase/supabase-js` (simpler; it's already a storefront dependency).

## Auth

Requirement: owner login, and the fulfilment checks must be usable by
**multiple accounts**. Owner previously approved "OAuth (owner login)".
Recommendation: **Cloudflare Access** (Zero Trust, free tier) in front of the
admin Worker — an email allowlist with Google/GitHub/email-PIN login, zero auth
code in the app, and adding a helper = adding an email to the policy. The app
can read the logged-in identity from the `Cf-Access-Authenticated-User-Email`
header (verify the accompanying JWT) for the `fulfilled_by` audit column.
Rolling custom OAuth inside the app is the fallback if Access is rejected.

## Proposed migration 0004 (fulfilment + batches)

Not applied — the admin session should review, adjust, and apply. Design
decisions baked in: a batch is a first-class row; an order belongs to **at most
one batch** (nullable FK on orders — simplest model that matches "commit orders
to a group"; a many-to-many join table is over-modeling for one operator);
fulfilment is a nullable timestamp + who, so "done" carries when/by-whom for
free and un-checking is just setting NULL.

```sql
begin;

-- fulfilment check, shared across accounts
alter table orders add column if not exists fulfilled_at timestamptz;
alter table orders add column if not exists fulfilled_by text;  -- email of who checked it

-- pickup batches
create table if not exists pickup_batches (
  id         bigint generated always as identity primary key,
  name       text not null default '',           -- e.g. "Saturday IKEA run"
  created_by text,
  created_at timestamptz not null default now(),
  closed_at  timestamptz                          -- set when the run is done
);

alter table orders add column if not exists batch_id bigint
  references pickup_batches (id) on delete set null;
create index if not exists orders_batch_idx on orders (batch_id);

-- admin role: full control of batches, and the new orders columns are covered
-- by its existing table-level UPDATE grant.
alter table pickup_batches enable row level security;
grant select, insert, update, delete on pickup_batches to moikit_admin;

drop policy if exists admin_all_pickup_batches on pickup_batches;
create policy admin_all_pickup_batches on pickup_batches
  for all to moikit_admin using (true) with check (true);

commit;
```

**Migrations live in the storefront repo** (`moikit-live/supabase/migrations/`,
timestamp-prefixed) because that's the checkout linked to the Supabase project —
add 0004 there and `supabase db push` from `C:\Users\jkubon\moikit-live`
(`--workdir` works too; DB password is cached in Windows Credential Manager).
Don't create a second supabase link in the admin repo.

## Core queries

Orders list (with money and batch/fulfilment state):

```sql
select o.id, upper(left(o.stamp, 8)) as ref, o.tier, o.created_at,
       o.customer_name, o.customer_phone, o.customer_email,
       o.address_line, o.address_postal, o.address_city,
       o.delivery_date, o.notes,
       t.total_cents, o.amount_charged_cents,
       t.total_cents - o.amount_charged_cents as balance_cents,
       o.fulfilled_at, o.fulfilled_by, o.batch_id
from orders o join order_totals t on t.order_id = o.id
where o.payment_status = 'ok'
order by o.created_at desc;
```

Aggregated pick list for a batch (the requirement-3 payoff):

```sql
select oi.item_name, oi.section, sum(oi.quantity) as qty,
       sum(oi.line_total_cents) as value_cents
from order_items oi join orders o on o.id = oi.order_id
where o.batch_id = $1 and o.payment_status = 'ok'
group by oi.item_name, oi.section
order by oi.section, qty desc;
```

(Group by `item_name`, not `sku` — the same physical item has tier-prefixed
skus like `basic-bedroom-0` / `premium-bedroom-0`, and a shopping list should
merge them. Names are frozen snapshots and identical across tiers for shared
items.)

Check off / batch-assign are single UPDATEs on `orders`
(`fulfilled_at = now(), fulfilled_by = $email` — or NULLs to un-check;
`batch_id = $id` — or NULL to remove from a batch).

## Decisions to confirm with the owner before building

1. **Stack/hosting** — recommend mirroring the storefront (Astro on a second
   Cloudflare Worker, same account) for tooling reuse; anything server-rendered
   works.
2. **Cloudflare Access vs in-app OAuth** (recommendation above).
3. **DB credential** — `moikit_admin` password vs `service_role` key.
4. Whether checking off the **last un-fulfilled order in a batch** should
   auto-close the batch (nice-to-have; skip for v1 if in doubt).

## Constraints / gotchas

- **Never expose** the admin credential or service_role key to the storefront
  or any public page. Admin app must not write to `order_items` money columns;
  its writes are fulfilment/batch/notes fields on `orders` + `pickup_batches`.
- PII: orders support anonymise-in-place (`anonymised_at` + nullable PII).
  Don't cache/export PII outside the DB. 6-year retention plan exists;
  anonymisation job not built yet (out of scope here).
- Money is **integer cents, gross** (VAT 25.5% included, `vat_rate_bp`).
  Display as `€ (cents/100).toFixed(2)`.
- `orders.updated_at` has no auto-trigger — set it in UPDATE statements if you
  want it meaningful.
- Deposit math is Option B (50% of items+shipping) as of 2026-07-24, but old
  test rows may predate it — always compute balance from
  `total_cents − amount_charged_cents`, never assume half.
- The Cloudflare zone `moikit.fi` (ID `6a8cdf62316a0dd4c6e3fd38661128bb`) is
  **pending** nameserver switch from OVH; the storefront runs on
  `moikit-live.moikit-fi.workers.dev` meanwhile. The admin app can live on
  `*.workers.dev` indefinitely — or `admin.moikit.fi` once the zone is active.
