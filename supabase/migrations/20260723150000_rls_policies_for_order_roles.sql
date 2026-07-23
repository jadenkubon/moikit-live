-- =============================================================================
-- MoiKit — migration 0003: RLS policies for the order roles
-- =============================================================================
-- RLS was enabled on orders/order_items in production (dashboard security
-- advisor) but no migration ever created policies, so every access by the
-- non-owner roles was blocked — including the webhook's INSERT as
-- moikit_writer. Row-level security applies on top of GRANTs: a role needs
-- BOTH the privilege and a policy that admits the row.
--
-- This migration makes RLS part of the declared schema:
--   * enable (and keep) RLS on both order tables
--   * per-role policies that admit all rows — column GRANTs remain the
--     mechanism that narrows what each role can see/touch
--   * fold in `select (id, stamp)` for moikit_writer, applied manually in
--     prod: ON CONFLICT (stamp) needs SELECT on the arbiter column, and
--     RETURNING id needs SELECT on id.
-- Idempotent: policies are dropped/recreated; grants re-apply cleanly.
-- =============================================================================

begin;

alter table orders      enable row level security;
alter table order_items enable row level security;

-- writer (Stripe webhook): may insert orders + items; SELECT stays limited to
-- (id, stamp) via column grants — the policy only admits rows, it widens nothing.
grant select (id, stamp) on orders to moikit_writer;

drop policy if exists writer_insert_orders on orders;
create policy writer_insert_orders on orders
  for insert to moikit_writer with check (true);

drop policy if exists writer_select_orders on orders;
create policy writer_select_orders on orders
  for select to moikit_writer using (true);

drop policy if exists writer_insert_order_items on order_items;
create policy writer_insert_order_items on order_items
  for insert to moikit_writer with check (true);

drop policy if exists writer_select_order_items on order_items;
create policy writer_select_order_items on order_items
  for select to moikit_writer using (true);

-- callback (PSP status updates): find by stamp, flip status. Columns limited
-- by the 0002 grants.
drop policy if exists callback_select_orders on orders;
create policy callback_select_orders on orders
  for select to moikit_callback using (true);

drop policy if exists callback_update_orders on orders;
create policy callback_update_orders on orders
  for update to moikit_callback using (true) with check (true);

-- admin (fulfillment app): read + update everything on both tables.
drop policy if exists admin_select_orders on orders;
create policy admin_select_orders on orders
  for select to moikit_admin using (true);

drop policy if exists admin_update_orders on orders;
create policy admin_update_orders on orders
  for update to moikit_admin using (true) with check (true);

drop policy if exists admin_select_order_items on order_items;
create policy admin_select_order_items on order_items
  for select to moikit_admin using (true);

drop policy if exists admin_update_order_items on order_items;
create policy admin_update_order_items on order_items
  for update to moikit_admin using (true) with check (true);

commit;
