import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

// `items`: [{ label, to? }] — the last item renders as plain text (the
// current page), everything before it is a link. Kept generic/shared rather
// than shop-specific since product detail is the first consumer but not the
// only one that will want this.
export default function Breadcrumb({ items, className = "" }) {
  return (
    <nav aria-label="Breadcrumb" className={["flex items-center gap-1.5 text-sm", className].join(" ")}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {i > 0 ? <Icon name="chevronRight" className="h-3.5 w-3.5 text-amber-50/25" /> : null}
              {isLast || !item.to ? (
                <span className="truncate text-amber-50/55" aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="truncate rounded text-amber-50/55 hover:text-amber-50 focus-ring">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
