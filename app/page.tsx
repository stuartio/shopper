import Link from "next/link";
import { CATEGORIES, formatMoney, listProducts } from "@/lib/catalog";
import { AddToCart } from "@/components/AddToCart";

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const active = category && CATEGORIES.includes(category) ? category : undefined;
  const products = listProducts(active);

  return (
    <>
      <h1>{active ?? "All products"}</h1>
      <div className="filters" data-testid="category-filters">
        <Link href="/" className={`chip ${!active ? "active" : ""}`} data-testid="category-all">All</Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/?category=${encodeURIComponent(c)}`}
            className={`chip ${active === c ? "active" : ""}`}
            data-testid={`category-${c.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          >
            {c}
          </Link>
        ))}
      </div>
      <div className="grid" data-testid="product-list">
        {products.map((p) => (
          <div className="card" key={p.id} data-testid={`product-${p.id}`}>
            <Link href={`/products/${p.id}`}>
              <img src={p.imageUrl} alt={p.name} />
            </Link>
            <div className="body">
              <Link href={`/products/${p.id}`} data-testid={`product-name-${p.id}`}>{p.name}</Link>
              <span className="muted">{p.category}</span>
              <span className="price" data-testid={`product-price-${p.id}`}>{formatMoney(p.priceCents)}</span>
              <AddToCart product={p} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
