import EmptyState from "../ui/EmptyState.jsx";
import Button from "../ui/Button.jsx";

export default function MarketplaceEmptyState({ hasActiveFilters, onClearFilters }) {
  if (hasActiveFilters) {
    return (
      <EmptyState
        title="No products match your filters."
        description="Try a different search, category, or price range."
        action={
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title="No products available yet"
      description="Products from our merchants will appear here."
    />
  );
}
