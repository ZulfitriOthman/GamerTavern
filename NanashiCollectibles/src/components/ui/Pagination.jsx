import Button from "./Button.jsx";

// Matches the { page, limit, total, pages } shape every paginated
// /api/merchant/* endpoint returns (see Backend/modules/pagination.module.js).
export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
      <p className="text-xs text-amber-50/50">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages}>
          Next
        </Button>
      </div>
    </div>
  );
}
