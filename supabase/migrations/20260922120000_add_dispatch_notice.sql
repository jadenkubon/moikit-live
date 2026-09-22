-- "On the way" notice: the admin app stamps these when a deliverer confirms
-- they are heading out with an order, and emails the recipient. Kept in the DB
-- (not per-device) so the state is shared and the notice is not sent twice.
alter table orders add column if not exists dispatched_at timestamptz;
alter table orders add column if not exists dispatched_by text;  -- deliverer's first name
