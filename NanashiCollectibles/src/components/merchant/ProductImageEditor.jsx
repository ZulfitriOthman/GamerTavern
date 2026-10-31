import { useRef, useState } from "react";
import { useSocket } from "../../services/socket/SocketContext.js";
import { uploadProductImage } from "../../features/merchant/merchantProductSocketService.js";
import { resolveProductImageUrl } from "../../features/shop/productImage.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

// images: [{ url, isPrimary }]. Uses the existing image:upload Socket.IO event
// (Backend/controllers/product.controller.js) — no new upload endpoint was needed.
export default function ProductImageEditor({ images, onChange }) {
  const { socket, status: socketStatus } = useSocket();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFiles(fileList) {
    setError(null);
    const files = Array.from(fileList || []);
    if (!files.length) return;

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`"${file.name}" isn't a supported image type (jpg, png, gif, webp only).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" is larger than 5MB.`);
        continue;
      }
      if (socketStatus !== "connected") {
        setError("Not connected to the server. Please wait and try again.");
        continue;
      }

      setUploading(true);
      try {
        const base64 = await fileToBase64(file);
        const { imageUrl } = await uploadProductImage(socket, { fileName: file.name, base64 });
        onChange([...images, { url: imageUrl, isPrimary: images.length === 0 }]);
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    }
  }

  function removeAt(index) {
    const next = images.filter((_, i) => i !== index);
    if (next.length && !next.some((img) => img.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  }

  function setPrimary(index) {
    onChange(images.map((img, i) => ({ ...img, isPrimary: i === index })));
  }

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((img, index) => (
          <div key={img.url} className="group relative overflow-hidden rounded-lg border border-white/10 bg-ink-900">
            <img src={resolveProductImageUrl(img.url)} alt="" className="aspect-square w-full object-cover" />
            {img.isPrimary ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">Primary</span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink-950/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1 text-amber-50/70 hover:text-amber-50 disabled:opacity-30 focus-ring" aria-label="Move earlier">
                ←
              </button>
              {!img.isPrimary ? (
                <button type="button" onClick={() => setPrimary(index)} className="rounded px-1 text-[10px] text-amber-50/70 hover:text-amber-50 focus-ring">
                  Set primary
                </button>
              ) : (
                <span className="text-[10px] text-transparent">·</span>
              )}
              <button type="button" onClick={() => move(index, 1)} disabled={index === images.length - 1} className="rounded p-1 text-amber-50/70 hover:text-amber-50 disabled:opacity-30 focus-ring" aria-label="Move later">
                →
              </button>
              <button type="button" onClick={() => removeAt(index)} className="rounded p-1 text-danger-400 hover:text-danger-300 focus-ring" aria-label="Remove image">
                ✕
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 text-xs text-amber-50/50 hover:border-white/30 hover:text-amber-50/70 focus-ring disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "+ Add image"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {error ? (
        <p role="alert" className="text-xs text-danger-400">
          {error}
        </p>
      ) : (
        <p className="text-xs text-amber-50/40">JPG, PNG, GIF, or WebP. Max 5MB each.</p>
      )}
    </div>
  );
}
