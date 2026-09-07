import { createContext, useContext } from "react";

export const MerchantAuthContext = createContext(null);

export function useMerchantAuth() {
  const ctx = useContext(MerchantAuthContext);
  if (!ctx) throw new Error("useMerchantAuth must be used within a MerchantAuthProvider");
  return ctx;
}
