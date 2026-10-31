import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { getWishlist, addToWishlist, removeFromWishlist } from "./wishlistService.js";
import { WishlistContext } from "./WishlistContext.js";

// A Set of product ids, not the full wishlist rows — every card/detail page
// only ever needs "is this product wishlisted", and the one dedicated
// wishlist view (if one ships later) can fetch the full list itself. Loads
// once per authenticated session; clears immediately on logout rather than
// showing a stale wishlist for the next signed-out visitor on a shared device.
export function WishlistProvider({ children }) {
  const { status: authStatus, token } = useAuth();
  const [ids, setIds] = useState(() => new Set());
  const [loaded, setLoaded] = useState(false);

  // Every branch's setState is deferred by one microtask (same fix as
  // services/socket/SocketProvider.jsx uses for the same lint rule) — an
  // effect must not call setState synchronously in its own body, including
  // via a same-render-reachable early-return branch.
  useEffect(() => {
    let cancelled = false;

    if (authStatus !== "authenticated") {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setIds(new Set());
        setLoaded(false);
      });
      return () => {
        cancelled = true;
      };
    }

    getWishlist(token)
      .then((items) => {
        if (cancelled) return;
        setIds(new Set(items.map((i) => i.product_id)));
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, token]);

  const isWishlisted = useCallback((productId) => ids.has(productId), [ids]);

  // Optimistic: flips the local Set immediately, rolls back only if the
  // request actually fails — the common case (logged in, product exists)
  // never waits on a round trip to feel responsive.
  const toggle = useCallback(
    async (productId) => {
      if (authStatus !== "authenticated") {
        throw new Error("Log in to save items to your wishlist.");
      }
      const wasWishlisted = ids.has(productId);
      setIds((prev) => {
        const next = new Set(prev);
        if (wasWishlisted) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        if (wasWishlisted) await removeFromWishlist(token, productId);
        else await addToWishlist(token, productId);
      } catch (err) {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasWishlisted) next.add(productId);
          else next.delete(productId);
          return next;
        });
        throw err;
      }
    },
    [authStatus, ids, token]
  );

  const value = useMemo(
    () => ({ isWishlisted, toggle, loaded, isAuthenticated: authStatus === "authenticated" }),
    [isWishlisted, toggle, loaded, authStatus]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
