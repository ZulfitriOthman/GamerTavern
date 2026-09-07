import { createContext, useContext } from "react";

export const ToastContext = createContext(null);

// push({ tone: 'success' | 'error' | 'info', message }) — returns nothing; toasts
// auto-dismiss. Kept deliberately tiny: one call site pattern for the whole app
// (product saved, inventory adjusted, order updated, staff added, settings saved, ...).
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
