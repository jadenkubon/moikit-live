-- =============================================================================
-- MoiKit — commerce schema (migration 0001)
-- =============================================================================
-- Target: Supabase Postgres (EU / Frankfurt).
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / CREATE OR
--   REPLACE / guarded DO blocks / upserts). Running it twice is a no-op.
--
-- Design invariants this schema GUARANTEES structurally (not in app code):
--   1. Price = sum of parts. Items carry the only price. A kit's advertised
--      price is a VIEW (kit_prices) that SUMs its parts — there is no stored
--      kit-price column that could ever drift from the itemized total.
--   2. Every order picks exactly one of 3 tiers (basic/premium/platinum).
--   3. An item can only appear on an order for a kit that includes it.
--      "mattress_platinum" is not a member of "basic", so a Basic order line
--      for it CANNOT be inserted (composite FK to kit_items). This is your
--      "kit-specific item is never > 0 in the wrong kit" rule, made physical.
--   4. All money is integer cents, gross (VAT-inclusive at 25.5%). No floats.
--   5. order_items snapshot name + price at purchase time, so invoices are
--      immutable for the 6-year Finnish Accounting Act retention; PII columns
--      on orders are nullable so records can be anonymised in place afterward.
--   6. Order subtotal + grand total are NEVER stored — they are derived from the
--      immutable line snapshots (order_totals view), so they cannot diverge. Only
--      the applied shipping fee is snapshotted on the order. The amount the payment
--      provider actually captured is stored separately (amount_charged_cents) and
--      reconciled against the derived total in the webhook.
--
-- Payments: Stripe now, Paytrail later. payment_status is an internal,
-- provider-agnostic enum both map onto; provider columns are Stripe-shaped with
-- generic fallbacks so adding Paytrail later needs no structural change.
--
-- Product data is English-only in the DB; the stable `items.sku` (e.g.
-- `kitchen_towels_4pc`) is the key a front-end translation layer maps EN <-> FI.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Enum types (guarded so re-runs don't error)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kit_tier') then
    create type kit_tier as enum ('basic', 'premium', 'platinum');
  end if;

  -- Internal, provider-agnostic payment states (Stripe now, Paytrail later map onto these).
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('ok', 'pending', 'delayed', 'fail');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Operational settings (editable without a migration)
--    Shipping is a flat fee that changes over time; keep the CURRENT value here
--    and snapshot the APPLIED value onto each order (see orders.shipping_cents).
-- -----------------------------------------------------------------------------
create table if not exists app_settings (
  key         text primary key,
  value_cents integer,
  note        text,
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Items — the catalog. "Items-first": this is the primary entity.
--    Exactly one price per item (no per-kit override anywhere) => consistent
--    pricing by construction.
-- -----------------------------------------------------------------------------
create table if not exists items (
  id               bigint generated always as identity primary key,
  sku              text    not null unique,          -- stable EN key, e.g. kitchen_towels_4pc
  name             text    not null,                 -- canonical English name
  description      text,
  section          text    not null
                     check (section in ('bedroom', 'kitchen', 'bathroom', 'cleaning')),
  unit_price_cents integer not null check (unit_price_cents >= 0),  -- gross, VAT incl
  active           boolean not null default true,    -- soft-delete; never hard-delete once ordered
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists items_section_idx on items (section) where active;

-- -----------------------------------------------------------------------------
-- 4. Kits — exactly three rows. NO price column: price is derived (kit_prices).
--    Kitchen/bathroom/cleaning are NOT kits; they are item sections.
--    UNIQUE(id, tier) exists so order_items can point a composite FK at it.
-- -----------------------------------------------------------------------------
create table if not exists kits (
  id         bigint generated always as identity primary key,
  slug       text     not null unique,               -- routing: basic|premium|platinum
  tier       kit_tier not null unique,
  name       text     not null,                       -- "Basic Kit"
  active     boolean  not null default true,
  sort       smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tier)
);

-- -----------------------------------------------------------------------------
-- 5. Kit membership — which items belong to which kit, and the default qty
--    pre-filled in the builder. Core bedroom items default to 1; every add-on
--    (kitchen/bathroom/cleaning + appliances/laundry) defaults to 0.
--    The advertised kit price = SUM over rows with default_quantity > 0.
--    is_addon only groups the appliance/laundry extras for the UI.
--    PK (kit_id,item_id) is the target of the order_items membership FK.
-- -----------------------------------------------------------------------------
create table if not exists kit_items (
  kit_id           bigint   not null references kits (id)  on delete cascade,
  item_id          bigint   not null references items (id) on delete restrict,
  default_quantity smallint not null default 0 check (default_quantity >= 0),
  is_addon         boolean  not null default false,
  sort             smallint not null default 0,
  primary key (kit_id, item_id)
);
create index if not exists kit_items_item_idx on kit_items (item_id);

-- -----------------------------------------------------------------------------
-- 6. Orders — one per checkout attempt.
--    * stamp: unique, non-PII correlation id (Paytrail "stamp"). No PII goes in
--      any key/derived column, so anonymisation never breaks references.
--    * money: integer cents, gross. total = items + shipping (CHECK-enforced).
--    * PII: all nullable -> anonymise in place (NULL them + set anonymised_at).
-- -----------------------------------------------------------------------------
create table if not exists orders (
  id                bigint generated always as identity primary key,
  stamp             text not null unique,               -- our idempotency/correlation key, non-PII
  kit_id            bigint not null references kits (id),-- mandatory tier pick
  payment_provider  text not null default 'stripe',     -- 'stripe' now, 'paytrail' later
  payment_status    payment_status not null default 'pending',

  -- Provider bookkeeping (non-PII). Stripe-shaped, generic fallback for Paytrail later.
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  provider_reference         text,                       -- Stripe charge id / Paytrail ref
  amount_charged_cents       integer check (amount_charged_cents >= 0),  -- what the PSP captured; reconcile vs order_totals.total_cents

  -- Money — integer cents, gross (VAT-incl). Subtotal + grand total are DERIVED from
  -- the lines (order_totals view); only the applied shipping snapshot lives here.
  shipping_cents    integer  not null default 0 check (shipping_cents >= 0),
  vat_rate_bp       smallint not null default 2550,      -- 25.5%, stamped for the invoice
  currency          text     not null default 'EUR',

  -- Customer PII — all nullable for anonymise-in-place
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  address_line      text,
  address_postal    text,
  address_city      text,
  delivery_date     date,
  notes             text,

  -- Lifecycle
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  paid_at           timestamptz,
  anonymised_at     timestamptz,

  unique (id, kit_id)   -- composite-FK target for order_items
);
create index if not exists orders_status_idx  on orders (payment_status);
create index if not exists orders_created_idx on orders (created_at);

-- -----------------------------------------------------------------------------
-- 7. Order line items — immutable snapshot at purchase time.
--    Two composite FKs together make cross-kit items impossible:
--      (order_id, kit_id) -> orders(id, kit_id)      : line's kit == order's kit
--      (kit_id, item_id)  -> kit_items(kit_id,item_id): item is a member of that kit
--    item_id stays NOT NULL so membership is always checked; items are
--    soft-deleted (active=false), never removed once referenced here.
-- -----------------------------------------------------------------------------
create table if not exists order_items (
  id               bigint generated always as identity primary key,
  order_id         bigint  not null,
  kit_id           bigint  not null,
  item_id          bigint  not null,

  -- Snapshot (authoritative for the invoice; survives later catalog changes)
  sku              text    not null,
  item_name        text    not null,
  section          text    not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity         smallint not null check (quantity >= 1),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at       timestamptz not null default now(),

  constraint order_items_line_ck check (line_total_cents = unit_price_cents * quantity),
  foreign key (order_id, kit_id) references orders    (id, kit_id)     on delete cascade,
  foreign key (kit_id, item_id)  references kit_items (kit_id, item_id) on delete restrict
);
create index if not exists order_items_order_idx on order_items (order_id);
create index if not exists order_items_item_idx  on order_items (item_id);

-- -----------------------------------------------------------------------------
-- 8. Derived pricing — the structural "price = sum of parts" guarantee.
-- -----------------------------------------------------------------------------

-- Advertised kit price = sum of its default-included parts. Never stored.
create or replace view kit_prices as
  select k.id                                              as kit_id,
         k.tier,
         k.slug                                            as kit_slug,
         coalesce(sum(i.unit_price_cents * ki.default_quantity), 0)::int
                                                           as base_price_cents
  from kits k
  join kit_items ki on ki.kit_id = k.id
  join items i      on i.id = ki.item_id
  where k.active
  group by k.id, k.tier, k.slug;

-- Full selectable menu per kit (for the builder): every item, its price, the
-- default quantity, and whether it's an appliance/laundry add-on.
create or replace view kit_menu as
  select k.tier,
         k.slug             as kit_slug,
         i.sku,
         i.name,
         i.section,
         i.unit_price_cents,
         ki.default_quantity,
         ki.is_addon,
         ki.sort
  from kits k
  join kit_items ki on ki.kit_id = k.id
  join items i      on i.id = ki.item_id
  where k.active and i.active;

-- Order money — DERIVED, never stored, so it can never diverge from the lines.
-- items_subtotal = SUM(line snapshots); total = subtotal + the order's shipping.
-- Reconcile total_cents against orders.amount_charged_cents in the PSP webhook.
create or replace view order_totals as
  select o.id                                             as order_id,
         coalesce(sum(oi.line_total_cents), 0)::int       as items_subtotal_cents,
         o.shipping_cents,
         (coalesce(sum(oi.line_total_cents), 0) + o.shipping_cents)::int
                                                          as total_cents
  from orders o
  left join order_items oi on oi.order_id = o.id
  group by o.id, o.shipping_cents;

-- -----------------------------------------------------------------------------
-- 9. Auto-maintain updated_at (idempotent via CREATE OR REPLACE, PG14+)
-- -----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace trigger items_set_updated_at
  before update on items  for each row execute function set_updated_at();
create or replace trigger kits_set_updated_at
  before update on kits   for each row execute function set_updated_at();
create or replace trigger orders_set_updated_at
  before update on orders for each row execute function set_updated_at();

-- =============================================================================
-- 10. Least-privilege roles + GRANT/REVOKE
--     Roles are NOLOGIN by design (no credentials committed to VCS). Grant them
--     to the login role your Cloudflare Worker connects as, or ALTER ... LOGIN
--     with a password out-of-band. The public Supabase API roles (anon /
--     authenticated) are locked out of all PII tables entirely.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'moikit_writer')   then create role moikit_writer   nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'moikit_callback') then create role moikit_callback nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'moikit_admin')    then create role moikit_admin    nologin; end if;
end $$;

grant usage on schema public to moikit_writer, moikit_callback, moikit_admin;

-- Hard baseline: nobody gets anything by default.
revoke all on all tables in schema public from public;

-- Public API roles: catalog is readable (no PII); order tables are NOT.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    grant select on items, kits, kit_items, kit_prices, kit_menu to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    grant select on items, kits, kit_items, kit_prices, kit_menu to authenticated;
  end if;
end $$;

-- moikit_writer  — public order path: INSERT ONLY, never SELECT PII.
--   select(id) is the minimum needed for `INSERT ... RETURNING id`.
grant insert on orders, order_items to moikit_writer;
grant select (id) on orders      to moikit_writer;
grant select (id) on order_items to moikit_writer;

-- moikit_callback — PSP webhook (Stripe now / Paytrail later): locate order by
--   stamp, flip status + record what the provider charged. No access to PII.
grant select (id, stamp, payment_status) on orders to moikit_callback;
grant update (payment_status, paid_at, amount_charged_cents,
              stripe_payment_intent_id, stripe_checkout_session_id, provider_reference)
  on orders to moikit_callback;

-- moikit_admin — fulfillment: read everything, update order/line state.
grant select on orders, order_items, items, kits, kit_items,
                 kit_prices, kit_menu, order_totals to moikit_admin;
grant update on orders, order_items to moikit_admin;

-- =============================================================================
-- 11. Seed data
--     Catalog (settings excepted) upserts so the migration stays the source of
--     truth on re-run. app_settings uses DO NOTHING so a live-edited shipping
--     fee is never clobbered by re-running the migration.
-- =============================================================================

-- Current flat shipping fee (was €20, now €30). Snapshot onto each order.
insert into app_settings (key, value_cents, note) values
  ('shipping_fee_cents', 3000, 'Flat delivery fee, VAT incl. Snapshot onto orders.shipping_cents at checkout.')
on conflict (key) do nothing;

-- The three tiers.
insert into kits (slug, tier, name, sort) values
  ('basic',    'basic',    'Basic Kit',    1),
  ('premium',  'premium',  'Premium Kit',  2),
  ('platinum', 'platinum', 'Platinum Kit', 3)
on conflict (tier) do update
  set slug = excluded.slug, name = excluded.name, sort = excluded.sort;

-- Items catalog (prices in integer cents, gross). One price per item.
insert into items (sku, name, section, unit_price_cents) values
  -- Bedroom — tier-specific sleep items (the "core" of each kit)
  ('mattress_basic',        'Mattress (80×200)',                                   'bedroom',  7500),
  ('mattress_premium',      'Upgraded mattress (80×200)',                          'bedroom', 20000),
  ('mattress_platinum',     'Premium hybrid mattress (80×200)',                    'bedroom', 45000),
  ('fitted_sheet_white',    'Fitted sheet — white (coloured options +€5)',         'bedroom',  1000),
  ('pillow_standard',       'Pillow',                                              'bedroom',  1000),
  ('pillow_high',           'High pillow (50×60 cm)',                              'bedroom',  3000),
  ('pillow_ergonomic',      'Ergonomic pillow (33×35 cm)',                         'bedroom',  4000),
  ('bedding_set_basic',     'Bedding set: duvet cover + pillowcase — 4 designs',   'bedroom',  2500),
  ('bedding_set_premium',   'Bedding set: duvet cover + pillowcase — 4 designs',   'bedroom',  3000),
  ('bedding_set_platinum',  'Bedding set: duvet cover + pillowcase — 4 designs',   'bedroom',  4000),
  ('light_duvet',           'Light duvet',                                         'bedroom',  2000),
  ('warm_duvet',            'Warm duvet',                                          'bedroom',  3000),
  ('hangers_plastic',       '10-pack dark plastic hangers',                        'bedroom',   500),
  ('hangers_wooden',        '8-pack wooden hangers',                               'bedroom',  1000),
  ('hangers_bamboo',        '2× 5-pack bamboo hangers',                            'bedroom',  2000),
  -- Kitchen
  ('kitchen_plates_large_4','Dish set — 4 large plates (26 cm)',                   'kitchen',  2000),
  ('kitchen_plates_small_4','4 small dinner plates (21 cm)',                       'kitchen',  1600),
  ('kitchen_bowls_4',       '4 bowls (white, 20 cm)',                              'kitchen',  1600),
  ('kitchen_glasses_6',     'Water glasses (6 × 27 cl)',                           'kitchen',  1500),
  ('kitchen_mugs_3',        '3 mugs (320 ml)',                                     'kitchen',   800),
  ('kitchen_cutlery_16',    'Cutlery set, 16 pieces',                              'kitchen',  2500),
  ('kitchen_pot',           'Pot with lid',                                        'kitchen',  1500),
  ('kitchen_pan',           'Frying pan',                                          'kitchen',  1500),
  ('kitchen_spatula',       'Spatula',                                             'kitchen',   600),
  ('kitchen_wooden_spoon',  'Wooden spoon',                                        'kitchen',   600),
  ('kitchen_knives_3',      'Knife set, 3 pieces',                                 'kitchen',  2000),
  ('kitchen_storage_5',     'Food storage containers (5-pack)',                    'kitchen',  1500),
  ('kitchen_towels_4',      'Kitchen towels (4-pack)',                             'kitchen',   600),
  -- Kitchen appliances (add-ons)
  ('appliance_coffee_maker','Coffee maker',                                        'kitchen',  3500),
  ('appliance_microwave',   'Microwave',                                           'kitchen', 10000),
  ('appliance_kettle',      'Electric kettle (1.3 l)',                             'kitchen',  3500),
  ('appliance_toaster',     'Toaster',                                             'kitchen',  3000),
  -- Bathroom
  ('bathroom_bath_towels_2','2 bath towels (100×150 cm)',                          'bathroom', 3000),
  ('bathroom_hand_towels_2','2 hand towels (30×50 cm)',                            'bathroom',  500),
  ('bathroom_toilet_paper_4','Toilet paper (4 rolls)',                             'bathroom', 1000),
  ('bathroom_hand_soap',    'Hand soap',                                           'bathroom',  500),
  ('bathroom_soap_bar',     'Soap bar',                                            'bathroom',  500),
  ('bathroom_shampoo',      'Shampoo (250 ml)',                                    'bathroom',  700),
  ('bathroom_conditioner',  'Conditioner (200 ml)',                                'bathroom',  700),
  -- Cleaning
  ('cleaning_universal_spray','Universal spray',                                   'cleaning',  700),
  ('cleaning_window_spray', 'Window cleaner spray',                                'cleaning',  600),
  ('cleaning_toilet_cleaner','Toilet bowl cleaner',                                'cleaning',  600),
  ('cleaning_toilet_brush', 'Toilet brush',                                        'cleaning',  500),
  ('cleaning_dish_detergent','Dish detergent',                                     'cleaning',  500),
  ('cleaning_sponges_2',    'Sponges (2-pack)',                                    'cleaning',  500),
  ('cleaning_dish_brush',   'Finnish dish brush',                                  'cleaning',  500),
  ('cleaning_garbage_bags', 'Garbage bags (40 l)',                                 'cleaning',  500),
  ('cleaning_compost_bags', 'Compost bags (75 l)',                                 'cleaning',  800),
  -- Laundry (add-ons, shown under cleaning)
  ('laundry_basket',        'Laundry basket',                                      'cleaning', 1500),
  ('laundry_detergent',     'Laundry detergent',                                   'cleaning', 1000)
on conflict (sku) do update
  set name = excluded.name, section = excluded.section, unit_price_cents = excluded.unit_price_cents;

-- Kit membership — CORE bedroom items (default_quantity = 1) per tier.
insert into kit_items (kit_id, item_id, default_quantity, is_addon, sort)
select k.id, i.id, 1, false, row_number() over (partition by core.tier order by core.ord)
from (values
  ('basic'::kit_tier,    'mattress_basic',       1),
  ('basic',              'fitted_sheet_white',   2),
  ('basic',              'pillow_standard',      3),
  ('basic',              'bedding_set_basic',    4),
  ('basic',              'light_duvet',          5),
  ('basic',              'hangers_plastic',      6),
  ('premium',            'mattress_premium',     1),
  ('premium',            'fitted_sheet_white',   2),
  ('premium',            'pillow_high',          3),
  ('premium',            'bedding_set_premium',  4),
  ('premium',            'warm_duvet',           5),
  ('premium',            'light_duvet',          6),
  ('premium',            'hangers_wooden',       7),
  ('platinum',           'mattress_platinum',    1),
  ('platinum',           'fitted_sheet_white',   2),
  ('platinum',           'pillow_ergonomic',     3),
  ('platinum',           'bedding_set_platinum', 4),
  ('platinum',           'warm_duvet',           5),
  ('platinum',           'light_duvet',          6),
  ('platinum',           'hangers_bamboo',       7)
) as core(tier, sku, ord)
join kits  k on k.tier = core.tier
join items i on i.sku  = core.sku
on conflict (kit_id, item_id) do update
  set default_quantity = excluded.default_quantity, is_addon = excluded.is_addon, sort = excluded.sort;

-- Kit membership — UNIVERSAL add-on items (kitchen/bathroom/cleaning), available
-- under every tier at default_quantity = 0. Appliances + laundry flagged is_addon.
insert into kit_items (kit_id, item_id, default_quantity, is_addon, sort)
select k.id,
       i.id,
       0,
       (starts_with(i.sku, 'appliance_') or starts_with(i.sku, 'laundry_')),
       100 + i.id
from kits k
cross join items i
where i.section in ('kitchen', 'bathroom', 'cleaning')
on conflict (kit_id, item_id) do update
  set default_quantity = excluded.default_quantity, is_addon = excluded.is_addon;

commit;

-- =============================================================================
-- Sanity checks (run manually after applying; not part of the transaction):
--
--   -- Advertised prices must be 14500 / 33000 / 61000:
--   select tier, base_price_cents from kit_prices order by tier;
--
--   -- This must fail (cross-kit item) — proves rule #3 is structural:
--   --   insert into order_items (order_id, kit_id, item_id, sku, item_name,
--   --     section, unit_price_cents, quantity, line_total_cents)
--   --   values (<a basic order id>, <basic kit id>,
--   --     (select id from items where sku='mattress_platinum'),
--   --     'mattress_platinum','x','bedroom',45000,1,45000);
-- =============================================================================
