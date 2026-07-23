-- =============================================================================
-- MoiKit — migration 0002: catalog moves to the app (Option B)
-- =============================================================================
-- The product catalog now lives in src/data/kits.ts (the single source of truth,
-- alongside images + copy). The DATABASE keeps only ORDERS. Every order still
-- records which kit (tier) the customer chose and a full, immutable itemized
-- snapshot of what they bought — so "which kit" and "the list of all items" are
-- always in the DB, independent of the live catalog.
--
-- What changes vs 0001:
--   * drop the catalog tables/views (items, kits, kit_items, kit_prices, kit_menu)
--   * orders: record `tier` directly (no FK to a kits table)
--   * order_items: pure self-contained snapshots (no catalog FKs)
--   * pricing/validation now happen server-side in the checkout Worker from
--     kits.ts, so the writer role no longer needs any catalog read grant.
--
-- Safe to re-run: the teardown only fires while the pre-Option-B catalog still
-- exists; everything else is IF NOT EXISTS / CREATE OR REPLACE. It never drops
-- an orders table that is already in the new shape (so live orders are safe).
-- Enums (kit_tier, payment_status), app_settings, the set_updated_at() function
-- and the three roles all persist from 0001.
-- =============================================================================

begin;

-- ---- one-time teardown of the old catalog-coupled shape ---------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'items'
  ) then
    drop view  if exists order_totals;
    drop view  if exists kit_menu;
    drop view  if exists kit_prices;
    drop table if exists order_items;
    drop table if exists orders;
    drop table if exists kit_items;
    drop table if exists items;
    drop table if exists kits;
  end if;
end $$;

-- ---- ORDERS — one row per order -------------------------------------------
create table if not exists orders (
  id                bigint generated always as identity primary key,
  stamp             text not null unique,               -- idempotency/correlation key, non-PII
  tier              kit_tier not null,                  -- which kit the customer selected
  payment_provider  text not null default 'stripe',     -- 'stripe' now, 'paytrail' later
  payment_status    payment_status not null default 'pending',

  -- provider bookkeeping (non-PII)
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  provider_reference         text,
  amount_charged_cents       integer check (amount_charged_cents >= 0),  -- deposit the PSP captured

  -- money — integer cents, gross (VAT incl). Subtotal + total are DERIVED
  -- (order_totals view); only the applied shipping snapshot lives here.
  shipping_cents    integer  not null default 0 check (shipping_cents >= 0),
  vat_rate_bp       smallint not null default 2550,      -- 25.5%, stamped for the invoice
  currency          text     not null default 'EUR',

  -- customer PII — all nullable for anonymise-in-place
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  address_line      text,
  address_postal    text,
  address_city      text,
  delivery_date     date,
  notes             text,

  -- lifecycle
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  paid_at           timestamptz,
  anonymised_at     timestamptz
);
create index if not exists orders_status_idx  on orders (payment_status);
create index if not exists orders_created_idx on orders (created_at);
create index if not exists orders_tier_idx    on orders (tier);

-- ---- ORDER_ITEMS — the itemized list, immutable snapshots ------------------
-- Self-contained: name + price are copied at purchase time, so the record never
-- depends on (or drifts with) the live catalog in kits.ts.
create table if not exists order_items (
  id               bigint generated always as identity primary key,
  order_id         bigint  not null references orders (id) on delete cascade,
  sku              text    not null,                    -- stable key from kits.ts
  item_name        text    not null,
  section          text    not null,                    -- bedroom | kitchen | bathroom
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         smallint not null check (quantity >= 1),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at       timestamptz not null default now(),
  constraint order_items_line_ck check (line_total_cents = unit_price_cents * quantity)
);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_sku_idx   on order_items (sku);

-- ---- derived money (never stored, cannot diverge) -------------------------
create or replace view order_totals as
  select o.id                                             as order_id,
         o.tier,
         coalesce(sum(oi.line_total_cents), 0)::int       as items_subtotal_cents,
         o.shipping_cents,
         (coalesce(sum(oi.line_total_cents), 0) + o.shipping_cents)::int
                                                          as total_cents
  from orders o
  left join order_items oi on oi.order_id = o.id
  group by o.id, o.tier, o.shipping_cents;

create or replace trigger orders_set_updated_at
  before update on orders for each row execute function set_updated_at();

-- =============================================================================
-- Grants — orders-only surface. No catalog read anywhere (pricing is done in
-- the checkout Worker from kits.ts). Public API roles cannot touch orders.
-- =============================================================================
revoke all on all tables in schema public from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on orders, order_items from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on orders, order_items from authenticated;
  end if;
end $$;

grant usage on schema public to moikit_writer, moikit_callback, moikit_admin;

-- writer (the Stripe webhook): INSERT only; select(id) is just for RETURNING id.
grant insert on orders, order_items to moikit_writer;
grant select (id) on orders      to moikit_writer;
grant select (id) on order_items to moikit_writer;

-- callback (PSP webhook status updates): find by stamp, flip status only. No PII.
grant select (id, stamp, payment_status) on orders to moikit_callback;
grant update (payment_status, paid_at, amount_charged_cents,
              stripe_payment_intent_id, stripe_checkout_session_id, provider_reference)
  on orders to moikit_callback;

-- admin (fulfillment, behind OAuth): read everything, update order/line state.
grant select on orders, order_items, order_totals to moikit_admin;
grant update on orders, order_items to moikit_admin;

commit;
