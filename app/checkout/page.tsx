"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/components/Providers";
import { formatMoney } from "@/lib/money";

export default function CheckoutShipping() {
  const router = useRouter();
  const { user, authLoaded, cart } = useApp();
  const [f, setF] = useState({ fullName: "", address: "", city: "", postalCode: "", country: "" });

  useEffect(() => {
    if (authLoaded && !user) router.replace("/login?next=/checkout");
  }, [authLoaded, user, router]);

  useEffect(() => {
    const saved = sessionStorage.getItem("shopper_shipping");
    if (saved) setF(JSON.parse(saved));
  }, []);

  const total = cart.reduce((s, l) => s + l.priceCents * l.quantity, 0);
  if (!authLoaded || !user) return <p>Loading…</p>;
  if (cart.length === 0)
    return <p data-testid="cart-empty">Your cart is empty. <Link href="/">Keep shopping</Link></p>;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    sessionStorage.setItem("shopper_shipping", JSON.stringify(f));
    router.push("/checkout/payment");
  }

  return (
    <>
      <h1>Checkout — shipping</h1>
      <div className="panel">
        <form onSubmit={submit} data-testid="shipping-form">
          <label>Full name<input value={f.fullName} onChange={set("fullName")} required data-testid="shipping-name" /></label>
          <label>Address<input value={f.address} onChange={set("address")} required data-testid="shipping-address" /></label>
          <div className="row">
            <label>City<input value={f.city} onChange={set("city")} required data-testid="shipping-city" /></label>
            <label>Postal code<input value={f.postalCode} onChange={set("postalCode")} required data-testid="shipping-postal" /></label>
          </div>
          <label>Country<input value={f.country} onChange={set("country")} required data-testid="shipping-country" /></label>
          <p>Order total: <strong data-testid="checkout-total">{formatMoney(total)}</strong></p>
          <button type="submit" data-testid="continue-to-payment">Continue to payment</button>
        </form>
      </div>
    </>
  );
}
