const SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

export default function Spinner({ size = "sm", className = "" }) {
  return (
    <svg
      className={["animate-spin", SIZES[size], className].join(" ")}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
