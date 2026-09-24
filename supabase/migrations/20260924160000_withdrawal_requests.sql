-- =============================================================================
-- Article 11a withdrawal function (EU Consumer Rights Directive, as amended)
-- =============================================================================
-- A consumer must be able to withdraw from a distance contract ONLINE, get an
-- on-screen acknowledgement, and receive confirmation on a durable medium.
-- Email alone is too fragile a record for a statutory right, so every request
-- is persisted here first; the emails are best-effort on top of that.
--
-- The buyer types their own order reference, so `order_ref` is FREE TEXT and is
-- deliberately NOT a foreign key — a withdrawal is still legally valid if they
-- mistype it or cannot find it, and refusing to record it would be the bug.
--
-- RLS lesson from 0003 applies: enable RLS + policies + grants in THIS
-- migration, or the role's writes fail with permission denied despite grants.
-- =============================================================================

begin;

create table if not exists withdrawal_requests (
  id              bigint generated always as identity primary key,
  order_ref       text,                    -- as typed by the buyer; may not match an order
  customer_name   text,
  customer_email  text not null,
  message         text,                    -- optional free text from the buyer
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,             -- when the durable-medium email went out
  handled_at      timestamptz,             -- when the owner actioned it
  handled_by      text
);

create index if not exists withdrawal_requests_created_idx
  on withdrawal_requests (created_at desc);

alter table withdrawal_requests enable row level security;

-- storefront (public withdrawal form) connects as moikit_writer: insert only,
-- plus select(id) so INSERT ... RETURNING id works.
grant insert, select (id) on withdrawal_requests to moikit_writer;

drop policy if exists writer_insert_withdrawals on withdrawal_requests;
create policy writer_insert_withdrawals on withdrawal_requests
  for insert to moikit_writer with check (true);

drop policy if exists writer_select_withdrawals on withdrawal_requests;
create policy writer_select_withdrawals on withdrawal_requests
  for select to moikit_writer using (true);

-- admin app: read them, and mark them handled.
grant select, update on withdrawal_requests to moikit_admin;

drop policy if exists admin_select_withdrawals on withdrawal_requests;
create policy admin_select_withdrawals on withdrawal_requests
  for select to moikit_admin using (true);

drop policy if exists admin_update_withdrawals on withdrawal_requests;
create policy admin_update_withdrawals on withdrawal_requests
  for update to moikit_admin using (true) with check (true);

commit;
