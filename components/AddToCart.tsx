"use client";

import { useState } from "react";
import { useApp } from "./Providers";

export function AddToCart({ product }: { product: { id: string; name: string; priceCents: number; imageUrl: string } }) {
  const { addToCart } = useApp();
  const [added, setAdded] = useState(false);
  return (
    <button
      data-testid={`add-to-cart-${product.id}`}
      onClick={() => {
        addToCart({ productId: product.id, name: product.name, priceCents: product.priceCents, imageUrl: product.imageUrl });
        setAdded(true);
        setTimeout(() => setAdded(false), 1000);
      }}
    >
      {added ? "Added ✓" : "Add to cart"}
    </button>
  );
}
