import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { SkeletonText } from "../ui/Skeleton.jsx";
import { formatAddressLines } from "../../features/checkout/addressFormat.js";

// Checkout's Contact card — customer identity plus their selected
// CUSTOMER_ADDRESSES row, side by side on desktop and stacked on mobile
// (a plain 2-col/1-col grid, no extra breakpoint logic needed). Address
// selection itself lives in AddressSelectorModal, opened via onOpenSelector
// — this component only ever displays state, never fetches or mutates it,
// per the project's "pages orchestrate data" convention.
//
// The small label above the address ("Delivery address" vs "Contact
// address") and the empty-state copy are fulfilment-aware: under Pickup an
// address is never required, so its copy must not imply otherwise.
export default function ContactAddressCard({ user, fulfilmentType, addresses, addressesError, onRetryAddresses, selectedAddress, onOpenSelector, error }) {
  const isDelivery = fulfilmentType === "DELIVERY";

  return (
    <Card variant="form">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-amber-50">Contact</h2>
          <div className="mt-4 flex flex-col gap-1 text-sm">
            <p className="text-amber-50/85">{user.name}</p>
            <p className="text-amber-50/55">{user.email}</p>
            {selectedAddress?.phone ? <p className="text-amber-50/55">{selectedAddress.phone}</p> : null}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-amber-50">Address</h2>

          {addresses === null ? (
            <SkeletonText lines={3} className="mt-4" />
          ) : addressesError ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-danger-400">{addressesError}</p>
              <Button variant="secondary" size="sm" onClick={onRetryAddresses}>
                Retry
              </Button>
            </div>
          ) : selectedAddress ? (
            <div className="mt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-amber-50/40">{isDelivery ? "Delivery address" : "Contact address"}</p>
                  <p className="mt-1 text-sm font-medium text-amber-50/90">{selectedAddress.label || "Address"}</p>
                  <div className="mt-0.5 text-sm text-amber-50/65">
                    {formatAddressLines(selectedAddress).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
                <Button variant="link" size="sm" onClick={onOpenSelector} className="shrink-0">
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-amber-50/60">No address saved.{isDelivery ? " Add an address to continue with delivery." : ""}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={onOpenSelector}>
                + Add address
              </Button>
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-2 text-xs text-danger-400">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
