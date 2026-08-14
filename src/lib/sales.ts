// Single kill switch for taking orders. The coming-soon modal is a UI overlay
// only — anyone can open devtools and remove it, or hit /api/checkout directly
// with fetch/curl, bypassing it entirely. This flag is the actual gate: when
// false, the checkout API itself refuses to create a Stripe session no matter
// how the request arrives. Flip back to true (and redeploy) to reopen sales.
export const SALES_ENABLED = false;
