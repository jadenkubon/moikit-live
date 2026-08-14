// -----------------------------------------------------------------------------
// Legal document version — one constant, three consumers.
//
//   • the legal pages print it as "Version X / last updated X"
//   • /api/checkout stamps it into the Stripe session metadata when the buyer
//     ticks the acceptance box
//   • the webhook writes it to orders.terms_version
//
// So an order row says which wording that buyer actually agreed to. BUMP THIS
// whenever the Terms of Sale, the Privacy Notice or the Withdrawal Policy change
// in substance, and archive the superseded wording — an acceptance record that
// points at a version you have since overwritten proves nothing.
// -----------------------------------------------------------------------------

export const LEGAL_VERSION = "2026-08-14";

/** Canonical URLs, so the checkbox label, the footer and the pages agree. */
export const LEGAL_LINKS = {
  privacy: "/legal/privacy/",
  terms: "/legal/terms/",
  withdrawal: "/legal/withdrawal/",
} as const;
