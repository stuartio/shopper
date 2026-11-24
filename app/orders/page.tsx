"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import { gql } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Row = { id: string; status: string; totalCents: number; createdAt: string };

export default function OrdersPage() {
  const router = useRouter();
  const { user, authLoaded } = useApp();
  const [orders, setOrders] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) return router.replace("/login?next=/orders");
    gql<{ myOrders: Row[] }>("{ myOrders { id status totalCents createdAt } }").then((d) => setOrders(d.myOrders));
  }, [authLoaded, user, router]);

  if (!orders) return <p>Loading…</p>;
  return (
    <>
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <p data-testid="no-orders">No orders yet.</p>
      ) : (
        <table data-testid="orders-table">
          <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
                <td>{o.status}</td>
                <td>{formatMoney(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
