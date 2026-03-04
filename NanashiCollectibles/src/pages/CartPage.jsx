// src/pages/CartPage.jsx
import { useState } from "react";
import { checkoutPayment } from "../api/payments";

function CartPage({
  cart,
  removeFromCart,
  updateQuantity,
  cartTotalPrice,
  clearCart,
}) {
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: "",
    email: "",
    cardNumber: "",
    expirationMonth: "",
    expirationYear: "",
    securityCode: "",
  });

  const onFieldChange = (e) => {
    const { name, value } = e.target;
    setCheckoutForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setIsPaying(true);
    setPaymentError("");
    setPaymentSuccess("");

    try {
      const result = await checkoutPayment({
        amount: cartTotalPrice,
        currency: "USD",
        card: {
          number: checkoutForm.cardNumber,
          expirationMonth: checkoutForm.expirationMonth,
          expirationYear: checkoutForm.expirationYear,
          securityCode: checkoutForm.securityCode,
        },
        billTo: {
          fullName: checkoutForm.fullName,
          email: checkoutForm.email,
        },
        cartItems: cart.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      setPaymentSuccess(
        `Payment ${result.status || "processed"}. Transaction ID: ${result.transactionId || "N/A"}`,
      );
      clearCart?.();
    } catch (err) {
      setPaymentError(err?.message || "Checkout failed");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Fantasy Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-6 shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        <h2 className="font-serif text-3xl font-bold text-amber-100">Your Cart</h2>
        <p className="mt-1 font-serif text-sm italic text-amber-100/70">
          Review your selections before proceeding to checkout
        </p>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {cart.length === 0 ? (
        <div className="rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-8 text-center shadow-lg shadow-purple-900/20">
          <p className="font-serif text-base italic text-amber-100/70">
            Your cart is empty. Return to the shop and discover your treasures.
          </p>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="space-y-4">
            {cart.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20 transition-all hover:border-amber-600/40 hover:shadow-amber-900/30"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-1 flex-col">
                    <span className="font-serif text-base font-semibold text-amber-100">
                      {item.name}
                    </span>
                    <span className="mt-1 font-serif text-sm italic text-amber-100/60">
                      BND {item.price.toFixed(2)} each
                    </span>
                    <div className="mt-3 flex items-center gap-3">
                      <label className="font-serif text-xs text-amber-600">
                        Quantity:
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.id, Number(e.target.value))
                        }
                        className="w-20 rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-1.5 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="font-serif text-sm text-rose-400 transition-colors hover:text-rose-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="font-serif text-lg font-bold text-amber-400">
                    BND {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>

          {/* Total & Checkout */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-6 shadow-2xl shadow-purple-900/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            
            <div className="flex items-center justify-between border-b border-amber-900/30 pb-4">
              <span className="font-serif text-lg text-amber-100/70">Total Amount</span>
              <span className="font-serif text-3xl font-bold text-amber-400">
                BND {cartTotalPrice.toFixed(2)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                name="fullName"
                value={checkoutForm.fullName}
                onChange={onFieldChange}
                placeholder="Cardholder name"
                className="rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <input
                name="email"
                value={checkoutForm.email}
                onChange={onFieldChange}
                placeholder="Email"
                type="email"
                className="rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <input
                name="cardNumber"
                value={checkoutForm.cardNumber}
                onChange={onFieldChange}
                placeholder="Card number"
                className="rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600 sm:col-span-2"
              />
              <input
                name="expirationMonth"
                value={checkoutForm.expirationMonth}
                onChange={onFieldChange}
                placeholder="MM"
                className="rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <input
                name="expirationYear"
                value={checkoutForm.expirationYear}
                onChange={onFieldChange}
                placeholder="YYYY"
                className="rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <input
                name="securityCode"
                value={checkoutForm.securityCode}
                onChange={onFieldChange}
                placeholder="CVV"
                className="rounded-lg border border-amber-900/30 bg-slate-950 px-3 py-2 font-serif text-sm text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <button
              className="mt-6 w-full overflow-hidden rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-4 font-serif text-base font-bold uppercase tracking-wider text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/40"
              onClick={handleCheckout}
              disabled={isPaying || cart.length === 0}
            >
              {isPaying ? "Processing Payment..." : "Proceed to Checkout"}
            </button>

            {paymentError ? (
              <p className="mt-3 text-center font-serif text-xs text-rose-300">{paymentError}</p>
            ) : null}

            {paymentSuccess ? (
              <p className="mt-3 text-center font-serif text-xs text-emerald-300">{paymentSuccess}</p>
            ) : null}
            
            <p className="mt-3 text-center font-serif text-xs italic text-amber-100/50">
              Secure payment processing • Multiple payment methods accepted
            </p>
            
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          </div>
        </>
      )}
    </div>
  );
}

export default CartPage;
