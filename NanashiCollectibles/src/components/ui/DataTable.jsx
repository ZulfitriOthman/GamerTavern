import { SkeletonText } from "./Skeleton.jsx";
import EmptyState from "./EmptyState.jsx";
import Button from "./Button.jsx";

// Renders a real <table> at sm: and above, and a stacked card list below it — never a
// tiny-column table squeezed onto a phone screen. `columns`: [{ key, header, render(row),
// mobileHidden?, className? }]. `renderMobileCard` overrides the auto-generated card for
// rows that need custom mobile layout (e.g. products with a thumbnail).
export default function DataTable({
  columns,
  rows,
  keyField = "id",
  status = "success", // loading | error | success
  error,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  renderMobileCard,
  onRowClick,
  onRetry,
}) {
  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-ink-800/60 p-4">
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <EmptyState
        title="Couldn't load this list"
        description={error || "Something went wrong talking to the server."}
        action={
          onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null
        }
      />
    );
  }

  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto rounded-xl border border-white/10 sm:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-amber-50/45">
              {columns.map((col) => (
                <th key={col.key} className={["px-4 py-3 font-medium", col.className || ""].join(" ")}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  "border-b border-white/5 last:border-0",
                  onRowClick ? "cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]" : "",
                ].join(" ")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={["px-4 py-3.5 text-amber-50/85", col.className || ""].join(" ")}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) =>
          renderMobileCard ? (
            <div key={row[keyField]}>{renderMobileCard(row)}</div>
          ) : (
            <button
              key={row[keyField]}
              type="button"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className="flex w-full flex-col gap-1.5 rounded-xl border border-white/10 bg-ink-800/60 p-4 text-left focus-ring"
            >
              {columns
                .filter((col) => !col.mobileHidden)
                .map((col) => (
                  <div key={col.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="shrink-0 text-xs uppercase tracking-wide text-amber-50/40">{col.header}</span>
                    <span className="truncate text-amber-50/85">{col.render ? col.render(row) : row[col.key]}</span>
                  </div>
                ))}
            </button>
          )
        )}
      </div>
    </div>
  );
}
