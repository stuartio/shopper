"use client";

import Link from "next/link";
import { useApp } from "@/components/Providers";
import { formatMoney } from "@/lib/money";

export default function CartPage() {
  const { cart, setQuantity } = useApp();
  const total = cart.reduce((s, l) => s + l.priceCents * l.quantity, 0);

  if (cart.length === 0)
    return (
      <>
        <h1>Your cart</h1>
        <p data-testid="cart-empty">Your cart is empty. <Link href="/">Keep shopping</Link></p>
      </>
    );

  return (
    <>
      <h1>Your cart</h1>
      <table data-testid="cart-table">
        <thead><tr><th></th><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
        <tbody>
          {cart.map((l) => (
            <tr key={l.productId} data-testid={`cart-line-${l.productId}`}>
              <td><img src={l.imageUrl} alt={l.name} /></td>
              <td>{l.name}</td>
              <td>{formatMoney(l.priceCents)}</td>
              <td>
                <button className="secondary" onClick={() => setQuantity(l.productId, l.quantity - 1)} data-testid={`qty-dec-${l.productId}`}>−</button>
                {" "}<span data-testid={`qty-${l.productId}`}>{l.quantity}</span>{" "}
                <button className="secondary" onClick={() => setQuantity(l.productId, l.quantity + 1)} data-testid={`qty-inc-${l.productId}`}>+</button>
              </td>
              <td>{formatMoney(l.priceCents * l.quantity)}</td>
              <td><button className="secondary" onClick={() => setQuantity(l.productId, 0)} data-testid={`remove-${l.productId}`}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Total: <strong data-testid="cart-total">{formatMoney(total)}</strong></p>
      <Link href="/checkout" className="button" data-testid="checkout-button">Proceed to checkout</Link>
    </>
  );
}
