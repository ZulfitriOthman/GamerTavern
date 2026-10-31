// The site's one content-width scale — every page should pick from here
// rather than reaching for an arbitrary max-w-* value. Four registers:
//   narrow  (max-w-3xl,  768px)  — prose, forms, single-column reading content
//   default (max-w-6xl, 1152px)  — standard public page content (the fallback)
//   wide    (max-w-7xl, 1280px)  — public content that wants a bit more air
//   xwide   (1600px)             — grids/cards/tables/dashboards on large
//                                   desktop (homepage sections, admin/merchant
//                                   data views) — never used for prose
// "Full-bleed" isn't a size here — it means rendering *outside* Container
// entirely (see pages/home/Hero.jsx), so there's nothing to add for it.
const SIZES = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  xwide: "max-w-[1600px]",
};

export default function Container({ size = "default", className = "", children }) {
  return (
    <div className={["mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className].join(" ")}>
      {children}
    </div>
  );
}
