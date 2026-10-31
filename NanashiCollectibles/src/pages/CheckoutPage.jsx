import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Section from "../components/layout/Section.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import { Skeleton, SkeletonText } from "../components/ui/Skeleton.jsx";
import { TextField, RadioGroupField } from "../components/ui/Field.jsx";
import OrderSummary from "../components/cart/OrderSummary.jsx";
import ContactAddressCard from "../components/checkout/ContactAddressCard.jsx";
import AddressSelectorModal from "../components/checkout/AddressSelectorModal.jsx";
import DeliveryDetailsSection from "../components/checkout/DeliveryDetailsSection.jsx";
import FulfilmentMethodCards from "../components/checkout/FulfilmentMethodCards.jsx";
import { useAuth } from "../features/auth/AuthContext.js";
import { useCart } from "../features/cart/CartContext.js";
import {
  getFulfilmentMethods,
  tokenizeMockCard,
  submitCheckout,
  getPaymentEligibility,
  submitBankTransferCheckout,
  submitPayOnDeliveryCheckout,
  submitPayOnPickupCheckout,
  CheckoutError,
} from "../features/checkout/checkoutService.js";
import { getAddresses, createAddress } from "../features/checkout/addressService.js";
import { formatMoney } from "../features/shop/format.js";

// Outcomes that mean THIS specific attempt is done and a genuine retry needs
// a fresh key — everything else (network failure, 500, CHECKOUT_IN_PROGRESS
// from a concurrent duplicate click) keeps the same key, since the backend's
// own CHECKOUT_IDEMPOTENCY table is what safely dedupes an uncertain outcome.
const ATTEMPT_TERMINAL_CODES = [
  "PAYMENT_FAILED",
  "CART_EMPTY",
  "PRODUCT_UNAVAILABLE",
  "PRODUCT_NOT_SELLABLE",
  "INSUFFICIENT_STOCK",
  "MERCHANT_NOT_ACTIVE",
  "INVALID_COUPON",
  "COUPON_MIN_SUBTOTAL",
  "COUPON_EXHAUSTED",
  "COUPON_ALREADY_USED",
  "MERCHANT_NOT_BANK_TRANSFER_ELIGIBLE",
  "MERCHANT_NOT_ONLINE_PAYMENT_ELIGIBLE",
  "MERCHANT_NOT_PAYMENT_ELIGIBLE",
  "DELIVERY_ADDRESS_REQUIRED",
  "FULFILMENT_PAYMENT_MISMATCH",
];

const CART_CHANGED_CODES = [
  "CART_EMPTY",
  "PRODUCT_UNAVAILABLE",
  "PRODUCT_NOT_SELLABLE",
  "INSUFFICIENT_STOCK",
  "MERCHANT_NOT_ACTIVE",
  "MERCHANT_NOT_BANK_TRANSFER_ELIGIBLE",
  "MERCHANT_NOT_ONLINE_PAYMENT_ELIGIBLE",
  "MERCHANT_NOT_PAYMENT_ELIGIBLE",
];

// Server-computed data.paymentMethods keys (checkout.routes.js GET
// /eligibility) -> the paymentMethod value this page's own state and submit
// branching use, and the human label shown in the radio group.
const PAYMENT_METHOD_OPTIONS = [
  { key: "onlinePayment", value: "online", label: "Online Payment (card)" },
  { key: "bankTransfer", value: "bank_transfer", label: "Bank Transfer" },
  { key: "payOnDelivery", value: "pay_on_delivery", label: "Pay on Delivery" },
  { key: "payOnPickup", value: "pay_on_pickup", label: "Pay on Pickup" },
];

function validateCard(card) {
  const errors = {};
  const digits = (card.number || "").replace(/\s+/g, "");
  if (!/^\d{12,19}$/.test(digits)) errors.number = "Enter a valid card number.";

  const month = Number(card.expirationMonth);
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.expirationMonth = "MM (1–12)";

  const year = Number(card.expirationYear);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < currentYear || year > currentYear + 15) errors.expirationYear = "YYYY";

  if (!/^\d{3,4}$/.test(card.securityCode || "")) errors.securityCode = "3–4 digits";

  return errors;
}

export default function CheckoutPage() {
  const auth = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [methods, setMethods] = useState(null); // null = loading
  const [methodsError, setMethodsError] = useState(null);
  const [methodsMessage, setMethodsMessage] = useState(null); // server-provided reason when nothing is available (e.g. multi-merchant fulfilment mismatch)
  const [selectedMethodId, setSelectedMethodId] = useState(null);

  const [eligibility, setEligibility] = useState(null); // null = loading
  const [paymentMethod, setPaymentMethod] = useState(null); // "online" | "bank_transfer" | null (not yet decided)

  // Address — reuses the existing CUSTOMER_ADDRESSES model
  // (features/checkout/addressService.js). Selected once in the Contact
  // card (ContactAddressCard + AddressSelectorModal) and reused as the
  // delivery address when Fulfilment = Delivery. Delivery instructions and
  // the reference photo are per-order, never saved to the address book —
  // see DeliveryDetailsSection.
  const [addresses, setAddresses] = useState(null); // null = loading
  const [addressesError, setAddressesError] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressSelectionError, setAddressSelectionError] = useState(null);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [referencePhotoUrl, setReferencePhotoUrl] = useState(null);

  const [card, setCard] = useState({ number: "", expirationMonth: "", expirationYear: "", securityCode: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  function loadMethods() {
    setMethods(null);
    setMethodsError(null);
    setMethodsMessage(null);
    getFulfilmentMethods({ token: auth.token })
      .then((data) => {
        const available = (data.methods || []).filter((m) => m.available);
        setMethods(available);
        setMethodsMessage(data.message || null);
        if (available.length === 1) setSelectedMethodId(available[0].id);
        else setSelectedMethodId((prev) => (available.some((m) => m.id === prev) ? prev : null));
      })
      .catch((err) => setMethodsError(err.message));
  }

  useEffect(() => {
    if (auth.status === "authenticated") loadMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  function loadAddresses() {
    setAddresses(null);
    setAddressesError(null);
    getAddresses({ token: auth.token })
      .then((rows) => {
        setAddresses(rows);
        const preferred = rows.find((a) => a.isDefaultShipping) || rows[0];
        setSelectedAddressId(preferred ? preferred.id : null);
      })
      .catch((err) => {
        setAddresses([]);
        setAddressesError(err.message);
      });
  }

  useEffect(() => {
    if (auth.status === "authenticated") loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  // Payment eligibility depends on the chosen fulfilment method (Pay on
  // Delivery only ever applies under Delivery, Pay on Pickup only ever under
  // Pickup — see checkout.routes.js GET /eligibility) — re-fetched whenever
  // selectedMethodId changes, not just once on mount.
  function loadEligibility() {
    setEligibility(null);
    getPaymentEligibility({ token: auth.token, shippingMethodId: selectedMethodId })
      .then((data) => {
        setEligibility(data);
        const available = PAYMENT_METHOD_OPTIONS.filter((opt) => data.paymentMethods?.[opt.key]?.available);
        // Auto-select when exactly one method is available; otherwise let the
        // customer choose (keeping their previous choice if it's still
        // valid), or leave unset if nothing is available.
        if (available.length === 1) setPaymentMethod(available[0].value);
        else
          setPaymentMethod((prev) => {
            if (available.some((opt) => opt.value === prev)) return prev;
            return available.length ? available[0].value : null;
          });
      })
      .catch(() =>
        setEligibility({
          paymentMethods: {
            bankTransfer: { available: false, reason: "Couldn't load payment methods." },
            onlinePayment: { available: false, reason: "Couldn't load payment methods." },
            payOnDelivery: { available: false, reason: "Couldn't load payment methods." },
            payOnPickup: { available: false, reason: "Couldn't load payment methods." },
          },
          message: "Couldn't load payment methods. Please try again.",
        })
      );
  }

  useEffect(() => {
    if (auth.status === "authenticated") loadEligibility();
    // loadEligibility intentionally excluded — see loadMethods() above for the same pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, selectedMethodId]);

  function updateCard(field) {
    return (event) => setCard((prev) => ({ ...prev, [field]: event.target.value }));
  }

  const selectedMethod = methods?.find((m) => m.id === selectedMethodId);
  const isDelivery = selectedMethod?.fulfilmentType === "DELIVERY";
  const isPickup = selectedMethod?.fulfilmentType === "PICKUP";
  const selectedAddress = (addresses || []).find((a) => a.id === selectedAddressId) || null;

  function handleSelectAddress(id) {
    setSelectedAddressId(id);
    setAddressSelectionError(null);
    setAddressModalOpen(false);
  }

  // Committed to local state immediately (before the modal closes) so a
  // checkout retry — same idempotencyKey, e.g. after a declined card —
  // reuses this address instead of creating a duplicate CUSTOMER_ADDRESSES
  // row; the customer already confirmed it via "Save & use this address".
  async function handleCreateAddress(fields) {
    const created = await createAddress({ token: auth.token, ...fields, setDefault: !addresses?.length });
    setAddresses((prev) => [created, ...(prev || [])]);
    setSelectedAddressId(created.id);
    setAddressSelectionError(null);
    setAddressModalOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setCheckoutError(null);

    if (!paymentMethod) {
      setCheckoutError({ message: "No payment method is available for this order." });
      return;
    }
    if (paymentMethod === "online") {
      const errors = validateCard(card);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (!selectedMethodId) {
      setCheckoutError({ message: "Please select a fulfilment method." });
      return;
    }

    // Delivery requires a real, already-saved address (point 16). Pickup
    // never blocks on this. The backend independently enforces it too
    // (checkout.routes.js reserveOrder) — this is convenience, not the
    // authoritative check.
    if (isDelivery && !selectedAddressId) {
      setAddressSelectionError("Please select or add a delivery address.");
      return;
    }
    setAddressSelectionError(null);

    setSubmitting(true);
    try {
      const shippingAddressId = isDelivery ? selectedAddressId : null;
      const deliveryFields = isDelivery
        ? { deliveryInstructions: deliveryInstructions.trim() || undefined, deliveryReferenceImageUrl: referencePhotoUrl || undefined }
        : {};

      let result;
      if (paymentMethod === "bank_transfer") {
        result = await submitBankTransferCheckout({ token: auth.token, idempotencyKey, shippingMethodId: selectedMethodId, shippingAddressId, ...deliveryFields });
      } else if (paymentMethod === "pay_on_delivery") {
        result = await submitPayOnDeliveryCheckout({ token: auth.token, idempotencyKey, shippingMethodId: selectedMethodId, shippingAddressId, ...deliveryFields });
      } else if (paymentMethod === "pay_on_pickup") {
        result = await submitPayOnPickupCheckout({ token: auth.token, idempotencyKey, shippingMethodId: selectedMethodId, shippingAddressId });
      } else {
        const { paymentToken } = await tokenizeMockCard(card);
        result = await submitCheckout({ token: auth.token, idempotencyKey, shippingMethodId: selectedMethodId, shippingAddressId, paymentToken, ...deliveryFields });
      }
      await cart.refresh();
      navigate(`/checkout/success/${result.orderId}`);
    } catch (err) {
      if (CART_CHANGED_CODES.includes(err.code)) {
        cart.refresh();
        loadEligibility();
      }
      if (err instanceof CheckoutError && ATTEMPT_TERMINAL_CODES.includes(err.code)) {
        setIdempotencyKey(crypto.randomUUID());
      }
      setCheckoutError({ message: err.message, code: err.code });
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.status === "loading" || cart.status === "loading") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            <SkeletonText lines={4} />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </Section>
    );
  }

  if (auth.status !== "authenticated") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <EmptyState
          title="Log in to check out"
          description="Your cart is saved — log in or create an account to complete your order."
          action={
            <div className="flex gap-3">
              <Button to="/login" state={{ from: "/checkout" }}>
                Log in
              </Button>
              <Button to="/register" variant="secondary" state={{ from: "/checkout" }}>
                Create account
              </Button>
            </div>
          }
        />
      </Section>
    );
  }

  if (cart.status === "error") {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <ErrorState icon="cart" title="Couldn't load your cart" description={cart.error} action={<Button onClick={cart.refresh}>Retry</Button>} />
      </Section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <Section spacing="lg" containerSize="wide" className="pt-14 sm:pt-20">
        <EmptyState
          title="Your cart is empty"
          description="Add something to your cart before checking out."
          action={<Button to="/shop">Continue Shopping</Button>}
        />
      </Section>
    );
  }

  const shippingFee = selectedMethod ? Number(selectedMethod.base_fee) : undefined;
  const total = shippingFee != null ? cart.subtotal + shippingFee : cart.subtotal;
  const hasCartIssue = cart.items.some(
    (item) => item.product_status !== "active" || item.available_stock <= 0 || item.quantity > item.available_stock
  );

  const availablePaymentOptions = eligibility
    ? PAYMENT_METHOD_OPTIONS.filter((opt) => eligibility.paymentMethods?.[opt.key]?.available)
    : [];
  const noPaymentMethod = eligibility !== null && availablePaymentOptions.length === 0;

  // The order summary's shipping line names the fulfilment type itself
  // ("Delivery"/"Pickup"), not the raw SHIPPING_METHODS.NAME — a merchant's
  // configured method name (e.g. "Local Delivery", "Express Pickup") can
  // vary, but the customer-facing summary line should read consistently.
  const shippingLabel = isDelivery ? "Delivery" : isPickup ? "Pickup" : selectedMethod?.name;

  return (
    <Section spacing="lg" containerSize="wide" className="pb-32 pt-14 sm:pb-24 sm:pt-20">
      <h1 className="mb-8 font-display text-2xl font-semibold text-amber-50 sm:text-3xl">Checkout</h1>

      {checkoutError ? (
        <div className="mb-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
          <p className="text-sm font-medium text-danger-300">Your cart has changed</p>
          <p className="mt-1 text-sm text-danger-200/80">{checkoutError.message}</p>
          {CART_CHANGED_CODES.includes(checkoutError.code) ? (
            <Button to="/cart" variant="secondary" size="sm" className="mt-3">
              Return to cart
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasCartIssue && !checkoutError ? (
        <div className="mb-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
          <p className="text-sm text-danger-200/80">
            One or more items in your cart have changed availability. Update your cart before placing your order.
          </p>
          <Button to="/cart" variant="secondary" size="sm" className="mt-3">
            Return to cart
          </Button>
        </div>
      ) : null}

      <form id="checkout-form" onSubmit={handleSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ContactAddressCard
            user={auth.user}
            fulfilmentType={selectedMethod?.fulfilmentType ?? null}
            addresses={addresses}
            addressesError={addressesError}
            onRetryAddresses={loadAddresses}
            selectedAddress={selectedAddress}
            onOpenSelector={() => setAddressModalOpen(true)}
            error={addressSelectionError}
          />

          <Card variant="form">
            <h2 className="font-display text-lg font-semibold text-amber-50">Fulfilment</h2>
            {methods === null ? (
              <SkeletonText lines={2} className="mt-4" />
            ) : methodsError ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-danger-400">{methodsError}</p>
                <Button variant="secondary" size="sm" onClick={loadMethods}>
                  Retry
                </Button>
              </div>
            ) : methods.length === 0 ? (
              <p className="mt-4 text-sm text-danger-400">{methodsMessage || "This merchant currently has no fulfilment method available. Please contact support."}</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-amber-50/60">Choose how you would like to receive your order.</p>
                <FulfilmentMethodCards methods={methods} selectedMethodId={selectedMethodId} onSelect={setSelectedMethodId} className="mt-4" />

                {isDelivery ? (
                  <DeliveryDetailsSection
                    token={auth.token}
                    deliveryInstructions={deliveryInstructions}
                    onChangeInstructions={setDeliveryInstructions}
                    referencePhotoUrl={referencePhotoUrl}
                    onChangeReferencePhoto={setReferencePhotoUrl}
                  />
                ) : isPickup ? (
                  <div className="mt-4 rounded-lg border border-white/10 bg-ink-900/40 p-4">
                    <p className="text-sm font-medium text-amber-50/85">Pickup</p>
                    <p className="mt-1 text-sm leading-relaxed text-amber-50/60">
                      The merchant will provide pickup details after your order is placed.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <Card variant="form">
            <h2 className="font-display text-lg font-semibold text-amber-50">Payment</h2>

            {eligibility === null ? (
              <SkeletonText lines={2} className="mt-4" />
            ) : noPaymentMethod ? (
              <div className="mt-4 rounded-lg border border-danger-500/30 bg-danger-500/10 p-4">
                <p className="text-sm font-medium text-danger-300">Payment unavailable</p>
                <p className="mt-1 text-sm text-danger-200/80">
                  {eligibility.message || "No payment method is available for this order."}
                </p>
              </div>
            ) : availablePaymentOptions.length > 1 ? (
              <RadioGroupField
                name="paymentMethod"
                value={paymentMethod}
                onChange={setPaymentMethod}
                className="mt-4"
                options={availablePaymentOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
              />
            ) : (
              <p className="mt-4 text-sm font-medium text-amber-50/85">{availablePaymentOptions[0]?.label}</p>
            )}

            {noPaymentMethod ? null : paymentMethod === "bank_transfer" ? (
              <p className="mt-4 text-sm leading-relaxed text-amber-50/65">
                After placing your order, you'll see each merchant's bank details and the amount to transfer.
                Your order will be confirmed once every merchant has received your transfer.
              </p>
            ) : paymentMethod === "pay_on_delivery" ? (
              <p className="mt-4 text-sm leading-relaxed text-amber-50/65">
                Pay the merchant directly when your order is delivered. No card or bank details are needed now.
              </p>
            ) : paymentMethod === "pay_on_pickup" ? (
              <p className="mt-4 text-sm leading-relaxed text-amber-50/65">
                Pay the merchant directly when you collect your order. No card or bank details are needed now.
              </p>
            ) : paymentMethod === "online" ? (
              <>
                <p className="mt-1 text-xs text-amber-50/45">
                  Test mode — enter any card details. Use a card number ending in 0002, 0069, or 0119 to simulate a decline.
                </p>

                <div className="mt-4 flex flex-col gap-4">
                  <TextField
                    id="card-number"
                    label="Card number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="4111 1111 1111 1111"
                    value={card.number}
                    onChange={updateCard("number")}
                    error={fieldErrors.number}
                    required
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <TextField
                      id="card-exp-month"
                      label="Exp. month"
                      inputMode="numeric"
                      autoComplete="cc-exp-month"
                      placeholder="MM"
                      value={card.expirationMonth}
                      onChange={updateCard("expirationMonth")}
                      error={fieldErrors.expirationMonth}
                      required
                    />
                    <TextField
                      id="card-exp-year"
                      label="Exp. year"
                      inputMode="numeric"
                      autoComplete="cc-exp-year"
                      placeholder="YYYY"
                      value={card.expirationYear}
                      onChange={updateCard("expirationYear")}
                      error={fieldErrors.expirationYear}
                      required
                    />
                    <TextField
                      id="card-cvv"
                      label="CVV"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="123"
                      value={card.securityCode}
                      onChange={updateCard("securityCode")}
                      error={fieldErrors.securityCode}
                      required
                    />
                  </div>
                </div>
              </>
            ) : null}
          </Card>
        </div>

        <div className="min-w-0">
          <OrderSummary
            itemCount={cart.itemCount}
            items={cart.items}
            subtotal={cart.subtotal}
            shippingFee={shippingFee}
            shippingLabel={shippingLabel}
            total={total}
            sticky
          >
            <Button
              type="submit"
              size="lg"
              className="hidden w-full lg:inline-flex"
              isLoading={submitting}
              disabled={hasCartIssue || methods === null || methods?.length === 0 || noPaymentMethod || !paymentMethod}
            >
              Place Order
            </Button>
          </OrderSummary>
        </div>
      </form>

      <AddressSelectorModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        addresses={addresses || []}
        selectedAddressId={selectedAddressId}
        onSelect={handleSelectAddress}
        onCreate={handleCreateAddress}
      />

      {/* Mobile sticky submit — references the form above by id so it works
          without being nested inside it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 p-4 backdrop-blur-md lg:hidden">
        <Button
          type="submit"
          form="checkout-form"
          size="lg"
          className="w-full"
          isLoading={submitting}
          disabled={hasCartIssue || methods === null || methods?.length === 0 || noPaymentMethod || !paymentMethod}
        >
          Place Order · {formatMoney(total)}
        </Button>
      </div>
    </Section>
  );
}
