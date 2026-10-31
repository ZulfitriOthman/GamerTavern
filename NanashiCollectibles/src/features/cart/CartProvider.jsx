import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { getCart, addCartItem, updateCartItem, removeCartItem, mergeGuestCart, clearCart } from "./cartService.js";
import { CartContext } from "./CartContext.js";

const GUEST_TOKEN_KEY = "nc.cart.guestToken";

function readGuestToken() {
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeGuestToken(token) {
  try {
    if (token) localStorage.setItem(GUEST_TOKEN_KEY, token);
    else localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    // localStorage unavailable — cart just won't persist across reloads for this guest
  }
}

export function CartProvider({ children }) {
  const { status: authStatus, token } = useAuth();
  const [guestToken, setGuestToken] = useState(() => readGuestToken());
  const [cart, setCart] = useState({ cartId: null, items: [], subtotal: 0 });
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [error, setError] = useState(null);
  // Guards the merge-on-login effect so it only fires once per login
  // transition, not on every render while authStatus stays "authenticated".
  const mergedRef = useRef(false);
  // True only while a merge-then-load sequence is actually in flight. Kept
  // separate from mergedRef (which stays true for the rest of the session
  // once a merge has been INITIATED) because the plain load effect below
  // runs in the SAME commit as the merge effect on the triggering render —
  // by the time it checks a guard, mergedRef has already been synchronously
  // flipped to true, so a guard based on mergedRef alone can never actually
  // skip that first render's load() and always races the real post-merge
  // load with a premature pre-merge (empty-cart) one.
  const mergePendingRef = useRef(false);

  const load = useCallback(() => {
    if (authStatus === "loading") return undefined;
    setStatus("loading");
    setError(null);
    return getCart({ token, guestToken })
      .then((data) => {
        if (data.guestToken) {
          writeGuestToken(data.guestToken);
          setGuestToken(data.guestToken);
        }
        setCart(data);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [authStatus, token, guestToken]);

  // Merge the guest cart into the user's cart exactly once when a guest with
  // items in progress logs in — the backend's own /cart/merge contract
  // ("call right after login when a guest cart token exists client-side").
  useEffect(() => {
    if (authStatus !== "authenticated" || !guestToken || mergedRef.current) return;
    mergedRef.current = true;
    mergePendingRef.current = true;
    mergeGuestCart({ token, guestToken })
      .then(() => {
        writeGuestToken(null);
        setGuestToken(null);
      })
      .catch(() => {
        // Best-effort — an expired/invalid guest token just means nothing to merge.
      })
      .finally(() => {
        mergePendingRef.current = false;
        load();
      });
  }, [authStatus, guestToken, token, load]);

  useEffect(() => {
    if (mergePendingRef.current) return; // merge effect above will load() when it finishes
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, token]);

  useEffect(() => {
    if (authStatus !== "authenticated") mergedRef.current = false;
  }, [authStatus]);

  const addItem = useCallback(
    async (productId, variantId, quantity) => {
      const data = await addCartItem({ token, guestToken, productId, variantId, quantity });
      if (data.guestToken) {
        writeGuestToken(data.guestToken);
        setGuestToken(data.guestToken);
      }
      setCart(data);
      return data;
    },
    [token, guestToken]
  );

  const updateItem = useCallback(
    async (itemId, quantity) => {
      const data = await updateCartItem({ token, guestToken, itemId, quantity });
      setCart(data);
      return data;
    },
    [token, guestToken]
  );

  const removeItem = useCallback(
    async (itemId) => {
      const data = await removeCartItem({ token, guestToken, itemId });
      setCart(data);
      return data;
    },
    [token, guestToken]
  );

  const clear = useCallback(async () => {
    const data = await clearCart({ token, guestToken });
    setCart(data);
    return data;
  }, [token, guestToken]);

  const itemCount = useMemo(() => cart.items.reduce((sum, item) => sum + item.quantity, 0), [cart.items]);

  const value = useMemo(
    () => ({ ...cart, itemCount, status, error, addItem, updateItem, removeItem, clear, refresh: load }),
    [cart, itemCount, status, error, addItem, updateItem, removeItem, clear, load]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
