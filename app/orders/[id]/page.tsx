"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import { gql } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  cardLast4: string;
  createdAt: string;
  items: { productId: string; name: string; priceCents: number; quantity: number }[];
  shipping: { fullName: string; address: string; city: string; postalCode: string; country: string };
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, authLoaded } = useApp();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) return router.replace(`/login?next=/orders/${id}`);
    gql<{ order: Order | null }>(
      `query($id: ID!) { order(id: $id) { id status totalCents cardLast4 createdAt
         items { productId name priceCents quantity }
         shipping { fullName address city postalCode country } } }`,
      { id },
    ).then((d) => setOrder(d.order));
  }, [authLoaded, user, id, router]);

  if (order === undefined) return <p>Loading…</p>;
  if (order === null) return <p data-testid="order-not-found">Order not found.</p>;

  return (
    <>
      <h1 className="success" data-testid="order-confirmation">Thank you for your order!</h1>
      <p>Order number: <strong data-testid="order-id">{order.id}</strong> — status <span data-testid="order-status">{order.status}</span></p>
      <table>
        <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.productId}><td>{i.name}</td><td>{formatMoney(i.priceCents)}</td><td>{i.quantity}</td><td>{formatMoney(i.priceCents * i.quantity)}</td></tr>
          ))}
        </tbody>
      </table>
      <p>Total: <strong data-testid="order-total">{formatMoney(order.totalCents)}</strong></p>
      <p className="muted">
        Shipping to {order.shipping.fullName}, {order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}, {order.shipping.country}.
        Paid with card ending {order.cardLast4}.
      </p>
    </>
  );
}
