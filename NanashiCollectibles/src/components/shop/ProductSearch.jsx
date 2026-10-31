import { useEffect, useImperativeHandle, useState } from "react";

// Uncontrolled-with-default, not synced from `defaultValue` via an effect. To reset
// the box (ShopPage's "Clear filters"), the parent calls the imperative `clear()`
// exposed via `ref` — a direct, synchronous state update from an event handler. An
// earlier version tried to do this by comparing a prop to a ref during render (React's
// "adjusting state when a prop changes" pattern) and remounting via `key`; both
// approaches raced against react-router's `setSearchParams` resolving `defaultValue`
// on a later render than the reset itself, and the ref-during-render read also
// violates this project's react-hooks/refs rule. Calling ref.current.clear() from the
// event handler sidesteps both problems.
export default function ProductSearch({ defaultValue = "", onChange, placeholder, ref }) {
  const [input, setInput] = useState(defaultValue);

  useImperativeHandle(ref, () => ({ clear: () => setInput("") }), []);

  useEffect(() => {
    const timer = setTimeout(() => onChange(input), 350);
    return () => clearTimeout(timer);
  }, [input, onChange]);

  return (
    <div className="relative flex-1">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-50/35"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M17 17l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        className="w-full rounded-lg border border-white/10 bg-ink-900 py-3 pl-11 pr-4 text-sm text-amber-50 placeholder:text-amber-50/35 transition-colors duration-150 focus-ring focus:border-brand-400"
      />
    </div>
  );
}
