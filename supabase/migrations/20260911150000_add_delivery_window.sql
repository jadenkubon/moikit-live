-- Requested delivery TIME window, collected as a second Stripe Checkout custom
-- field alongside the date. Stored as a readable "HH:00–HH:00" string.
alter table orders add column if not exists delivery_window text;
