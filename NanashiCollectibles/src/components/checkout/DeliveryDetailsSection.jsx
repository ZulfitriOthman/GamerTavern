import { TextareaField } from "../ui/Field.jsx";
import DeliveryReferencePhotoUpload from "./DeliveryReferencePhotoUpload.jsx";

// Delivery-only fields shown under Fulfilment when the customer has
// selected Delivery — instructions and the optional reference photo. The
// delivery address itself is chosen in the Contact card (ContactAddressCard
// / AddressSelectorModal), not here — see checkout.routes.js and
// CheckoutPage.jsx for how the two connect (selected CUSTOMER_ADDRESSES.id
// becomes ORDERS.SHIPPING_ADDRESS_ID). Instructions/photo stay per-order
// (never saved to the address book).
export default function DeliveryDetailsSection({ token, deliveryInstructions, onChangeInstructions, referencePhotoUrl, onChangeReferencePhoto }) {
  return (
    <div className="mt-4 flex flex-col gap-5">
      <TextareaField
        id="delivery-instructions"
        label="Delivery instructions"
        hint="Optional — max 500 characters"
        placeholder="Call upon arrival, leave with reception, blue gate on the left, etc."
        rows={3}
        maxLength={500}
        value={deliveryInstructions}
        onChange={(event) => onChangeInstructions(event.target.value)}
      />

      <DeliveryReferencePhotoUpload token={token} value={referencePhotoUrl} onChange={onChangeReferencePhoto} />
    </div>
  );
}
