function LightboxModal({ image, onClose }) {
  if (!image) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-content-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div className="max-w-5xl" onClick={(event) => event.stopPropagation()}>
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-[74vh] w-full rounded-xl object-contain"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-slate-200">{image.caption}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default LightboxModal;
