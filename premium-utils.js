/* =========================================================
   PREMIUM UTILS
   ---------------------------------------------------------
   Single source of truth for:
     1) Whether a seller's Premium plan is CURRENTLY active
        (checks plan + status + expiry date, not just a
        "premium" flag that might be stale)
     2) How many products a FREE seller may keep visible

   Used by: index.html, product.html, seller-profile.html,
   seller-dashboard.html - so all pages agree on the same
   rules.

   IMPORTANT: If a Premium seller's subscription expires,
   we do NOT delete their extra products. We only HIDE the
   newest ones beyond the free limit from public view. The
   oldest FREE_MAX_PRODUCTS stay visible. As soon as the
   seller renews Premium (or an admin approves a new
   payment), everything becomes visible again automatically
   - nothing was ever deleted.
========================================================= */

export const FREE_MAX_PRODUCTS = 5;

/**
 * Determine if a seller document currently has an ACTIVE
 * Premium plan (checks the expiry date too, not just the
 * stored status string - the stored status may not have
 * been flipped back to "free" yet by an admin).
 *
 * @param {Object|null|undefined} seller - a `users/{id}` document's data
 * @returns {boolean}
 */
export function isPremiumActive(seller) {
  if (!seller) return false;

  const plan = (seller.subscriptionPlan || "free").toLowerCase();
  const status = (seller.subscriptionStatus || "inactive").toLowerCase();

  if (plan !== "premium" || status !== "active") {
    return false;
  }

  if (seller.subscriptionEnd) {
    const endDate = new Date(seller.subscriptionEnd);
    if (!isNaN(endDate.getTime()) && endDate.getTime() <= Date.now()) {
      // Plan says "premium/active" but the expiry date has passed.
      return false;
    }
  }

  return true;
}

/**
 * Given ALL of one seller's products (any order) and whether
 * that seller is currently Premium, return the set of product
 * IDs that should be VISIBLE to the public.
 *
 * Rule: if not Premium, only the OLDEST `FREE_MAX_PRODUCTS`
 * products (by createdAt) stay visible. The rest are hidden
 * (not deleted) until the seller renews Premium or removes
 * some products themselves to get back under the limit.
 *
 * @param {Array<{id:string, createdAt?:{seconds?:number}|Date|string}>} sellerProducts
 * @param {boolean} sellerIsPremium
 * @returns {Set<string>} IDs that should be visible
 */
export function getVisibleProductIds(sellerProducts, sellerIsPremium) {
  if (sellerIsPremium) {
    return new Set(sellerProducts.map((p) => p.id));
  }

  const toMillis = (product) => {
    const c = product.createdAt;
    if (!c) return 0;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    const parsed = new Date(c);
    return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const sortedOldestFirst = [...sellerProducts].sort(
    (a, b) => toMillis(a) - toMillis(b)
  );

  return new Set(
    sortedOldestFirst.slice(0, FREE_MAX_PRODUCTS).map((p) => p.id)
  );
}
