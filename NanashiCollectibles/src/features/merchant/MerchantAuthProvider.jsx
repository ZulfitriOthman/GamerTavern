import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";
import * as merchantApi from "./merchantApi.js";
import { MerchantAuthContext } from "./MerchantAuthContext.js";

// Merchant identity is layered on top of the SAME shared session the storefront and
// Socket.IO already use (see AuthProvider.jsx's setSession) — a merchant is just a
// `users` row with a merchant_users membership, not a separate account system. This
// provider adds merchant-specific state (memberships, active merchant, role, status)
// without duplicating token storage.
//
// authState:
//   loading          — still resolving the underlying session or membership fetch
//   unauthenticated  — no session at all; route to /merchant/login
//   no_access        — logged in, but zero merchant memberships; route to a status page
//   not_active       — has a membership, but the merchant isn't ACTIVE or the staff
//                       membership itself is suspended; route to a status page
//   ready            — full dashboard access
function normalizeMembership(raw) {
  if (!raw) return null;
  return {
    merchantId: raw.merchant_id ?? raw.merchantId,
    role: raw.role,
    membershipStatus: raw.membership_status ?? raw.membershipStatus ?? "active",
    merchantStatus: raw.merchant_status ?? raw.merchantStatus,
    businessName: raw.business_name ?? raw.businessName,
    displayName: raw.display_name ?? raw.displayName,
    slug: raw.slug,
  };
}

export function MerchantAuthProvider({ children }) {
  const { token, user, status: sessionStatus, setSession, logout: logoutSession } = useAuth();

  const [memberships, setMemberships] = useState(null); // null = not fetched yet
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [membershipsError, setMembershipsError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoadingMemberships(true);
    setMembershipsError(null);
    try {
      const res = await merchantApi.getMe(token);
      setMemberships((res.merchants || []).map(normalizeMembership));
    } catch (err) {
      setMembershipsError(err.message);
      setMemberships([]);
    } finally {
      setLoadingMemberships(false);
    }
  }, [token]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      setMemberships(null);
      return;
    }
    if (sessionStatus === "authenticated" && memberships === null) {
      refresh();
    }
    // sessionStatus/memberships intentionally the only deps — refresh is stable via useCallback([token]).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, memberships]);

  const login = useCallback(
    async (credentials) => {
      const res = await merchantApi.login(credentials);
      setSession(res.token, res.user);
      setMemberships((res.merchants || []).map(normalizeMembership));
      return res;
    },
    [setSession]
  );

  const register = useCallback(
    async (fields) => {
      const res = await merchantApi.register(fields);
      setSession(res.token, res.user);
      setMemberships([
        normalizeMembership({
          merchant_id: res.merchant.id,
          role: "MERCHANT_OWNER",
          membership_status: "active",
          merchant_status: res.merchant.status,
          business_name: res.merchant.businessName,
          display_name: res.merchant.displayName,
          slug: res.merchant.slug,
        }),
      ]);
      return res;
    },
    [setSession]
  );

  const logout = useCallback(() => {
    setMemberships(null);
    logoutSession();
  }, [logoutSession]);

  const activeMerchant = memberships?.[0] || null;

  const authState = useMemo(() => {
    if (sessionStatus === "loading") return "loading";
    if (sessionStatus === "unauthenticated") return "unauthenticated";
    if (memberships === null || loadingMemberships) return "loading";
    if (memberships.length === 0) return "no_access";
    if (activeMerchant.merchantStatus !== "ACTIVE" || activeMerchant.membershipStatus !== "active") return "not_active";
    return "ready";
  }, [sessionStatus, memberships, loadingMemberships, activeMerchant]);

  const value = useMemo(
    () => ({
      authState,
      user,
      token,
      memberships: memberships || [],
      activeMerchant,
      role: activeMerchant?.role || null,
      membershipsError,
      login,
      register,
      logout,
      refresh,
    }),
    [authState, user, token, memberships, activeMerchant, membershipsError, login, register, logout, refresh]
  );

  return <MerchantAuthContext.Provider value={value}>{children}</MerchantAuthContext.Provider>;
}
