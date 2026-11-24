import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, getProduct } from "@/lib/catalog";
import { AddToCart } from "@/components/AddToCart";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const p = getProduct((await params).id);
  if (!p) notFound();
  return (
    <div className="product-detail" data-testid="product-detail">
      <img src={p.imageUrl} alt={p.name} />
      <div>
        <p><Link href={`/?category=${encodeURIComponent(p.category)}`}>← {p.category}</Link></p>
        <h1 data-testid="product-title">{p.name}</h1>
        <p className="price" data-testid="product-detail-price">{formatMoney(p.priceCents)}</p>
        <p>{p.description}</p>
        <AddToCart product={p} />
      </div>
    </div>
  );
}
