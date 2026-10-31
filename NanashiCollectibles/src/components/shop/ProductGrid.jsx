import ProductCard from "./ProductCard.jsx";

// Mobile: 2 columns (readable at card width). Tablet (md): 3. Large desktop (xl): 4.
// See the report for why "desktop" (lg, 1024–1279) settles at 3 rather than adding a
// dedicated breakpoint just for that range.
export default function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
