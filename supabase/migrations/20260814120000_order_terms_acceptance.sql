-- =============================================================================
-- MoiKit — migration 0004: record the customer's terms/privacy acceptance
-- =============================================================================
-- The kit builder now requires the customer to tick a box confirming they have
-- read and accept the Terms of Sale and the Privacy Notice before checkout can
-- start. A tick that is never recorded is worthless the moment anyone asks for
-- proof, so the acceptance is carried through Stripe session metadata (key
-- `tos`) and written onto the order row by the webhook, in the same INSERT as
-- the order itself — one atomic record of "this person, this order, these terms".
--
-- Two columns, deliberately:
--   terms_accepted_at  – WHEN the box was ticked (the moment /api/checkout ran,
--                        not the moment the payment cleared — those differ by
--                        however long the customer spent on Stripe's page).
--   terms_version      – WHICH wording they accepted. Policies get edited; an
--                        acceptance with no version is unprovable after the
--                        first edit. Bump LEGAL_VERSION in src/lib/legal.ts and
--                        keep the old wording archived whenever the terms change.
--
-- NOTE ON LEGAL BASIS (read before treating this as "GDPR consent"):
-- This column is NOT a GDPR Article 6(1)(a) consent record. The name, address,
-- phone and email on an order are processed under Article 6(1)(b) — necessary
-- to perform the sales contract — and under 6(1)(c) for the six-year accounting
-- retention. Neither can be withdrawn, so presenting them as "consent" would be
-- misleading. What this column records is the consumer-law fact that the buyer
-- was shown, and accepted, the contract terms and the privacy notice before the
-- order was placed. Keep the checkbox wording aligned with that.
--
-- Idempotent: add column if not exists + re-stated grants. No backfill — orders
-- placed before this deploy genuinely have no acceptance record, and inventing
-- one would defeat the point of keeping it.
-- =============================================================================

begin;

alter table orders
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

comment on column orders.terms_accepted_at is
  'When the buyer ticked the terms/privacy box in the kit builder (set from Stripe metadata `tos`). NULL for orders placed before the checkbox existed.';
comment on column orders.terms_version is
  'Version identifier of the Terms of Sale + Privacy Notice wording that was accepted, e.g. ''2026-08-14''.';

-- Re-state the grants. Table-level INSERT/SELECT already extend to new columns,
-- so this changes nothing in a healthy database — it is here so a database
-- rebuilt from migrations alone ends up in exactly the documented state, and so
-- the intent is visible next to the columns it applies to.
grant insert on orders to moikit_writer;
grant select on orders to moikit_admin;
grant update on orders to moikit_admin;

commit;
