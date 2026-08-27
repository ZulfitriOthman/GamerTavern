const SIZES = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

export default function Container({ size = "default", className = "", children }) {
  return (
    <div className={["mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className].join(" ")}>
      {children}
    </div>
  );
}
