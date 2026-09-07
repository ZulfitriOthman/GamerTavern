import Button from "../ui/Button.jsx";

export default function MerchantTopbar({ onOpenDrawer, user, onLogout }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-ink-950/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-amber-50 focus-ring lg:hidden"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="flex-1" />

      <span className="hidden max-w-[10rem] truncate text-sm text-amber-50/60 sm:inline">{user?.name}</span>
      <Button variant="secondary" size="sm" onClick={onLogout}>
        Log out
      </Button>
    </header>
  );
}
