-- =============================================================================
-- MoiKit Oy is NOT entered in the Finnish VAT register (AVL 3, small-business
-- threshold), confirmed against EU VIES. Every order was nevertheless being
-- stamped with vat_rate_bp = 2550 (25.5%) from the column default, which is a
-- false tax statement on the order record.
--
-- The COLUMN IS KEPT, not dropped: the EUR 20,000 threshold is measured on
-- TURNOVER, so a good year puts MoiKit into the VAT register and this flips
-- straight back — at which point it is a one-line default change, not a schema
-- migration against live orders.
-- =============================================================================

begin;

alter table orders alter column vat_rate_bp set default 0;

-- Correct the rows already stamped. These are all test orders today, but a
-- wrong tax rate must not survive on any record.
update orders set vat_rate_bp = 0 where vat_rate_bp <> 0;

commit;
