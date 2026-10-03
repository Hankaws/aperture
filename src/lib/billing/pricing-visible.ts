import { authEnabled } from "@/lib/auth/client";
import { pricingVisible } from "@/lib/billing/plans";

/** Plans and prices are hidden on the sign-in-off demo. See `pricingVisible`. */
export const showPricing = pricingVisible(authEnabled);
