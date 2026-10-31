import { useRef, useState } from "react";
import { uploadDeliveryReferencePhoto } from "../../features/checkout/checkoutService.js";
import { resolveUploadUrl } from "../../features/shop/productImage.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Optional, single reference photo showing WHERE to leave/deliver the
// order (front gate, reception, ...) — never a product photo, never
// implying the merchant should leave a parcel unattended. Uploads
// immediately on file select (same UX as ProductImageEditor.jsx), via the
// dedicated authenticated REST endpoint (POST /api/upload/delivery-reference)
// rather than the merchant's Socket.IO product-image flow — this is a
// customer-facing, non-merchant upload, and CheckoutPage has no Socket.IO
// connection to reuse.
export default function DeliveryReferencePhotoUpload({ token, value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    setError(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, or WebP photos are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is larger than 5MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
    try {
      const { imageUrl } = await uploadDeliveryReferencePhoto({ token, file });
      onChange(imageUrl);
    } catch (err) {
      setError(err.message);
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setLocalPreview(null);
    setError(null);
    onChange(null);
  }

  const previewSrc = localPreview || resolveUploadUrl(value);

  return (
    <div>
      <p className="text-sm text-amber-50/70">
        Delivery reference photo <span className="text-amber-50/40">Optional</span>
      </p>
      <p className="mt-1 text-xs text-amber-50/45">
        Upload a photo to help the merchant identify the delivery location, entrance, gate, reception area, or safe
        place to leave the order — e.g. a front gate, apartment entrance, reception desk, porch, or drop-off area.
      </p>

      <div className="mt-3">
        {previewSrc ? (
          <div className="flex items-center gap-3">
            <img src={previewSrc} alt="" className="h-20 w-20 rounded-lg border border-white/10 object-cover" />
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || uploading}
                className="rounded px-1 text-left text-sm font-medium text-brand-400 transition-colors duration-150 hover:text-brand-300 focus-ring disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={disabled || uploading}
                className="rounded px-1 text-left text-sm text-amber-50/60 transition-colors duration-150 hover:text-danger-400 focus-ring disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 py-6 text-sm text-amber-50/50 transition-colors duration-150 hover:border-white/30 hover:text-amber-50/70 focus-ring disabled:opacity-50"
          >
            <span className="font-medium">{uploading ? "Uploading…" : "+ Add reference photo"}</span>
            <span className="text-xs text-amber-50/35">JPG, PNG or WebP — max 5MB</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {error ? (
          <p role="alert" className="mt-2 text-xs text-danger-400">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
