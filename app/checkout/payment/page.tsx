"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/Providers";
import { gql } from "@/lib/client";
import { formatMoney } from "@/lib/money";

const MUTATION = `mutation($input: CheckoutInput!) { checkout(input: $input) { id } }`;

export default function PaymentPage() {
  const router = useRouter();
  const { user, authLoaded, cart, clearCart } = useApp();
  const [card, setCard] = useState({ cardNumber: "", cardHolder: "", expiry: "", cvc: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (authLoaded && !user) router.replace("/login?next=/checkout");
  }, [authLoaded, user, router]);

  useEffect(() => {
    const s = sessionStorage.getItem("shopper_shipping");
    if (s) setShipping(JSON.parse(s));
    else router.replace("/checkout");
  }, [router]);

  if (!authLoaded || !user || !shipping) return <p>Loading…</p>;

  const total = cart.reduce((s, l) => s + l.priceCents * l.quantity, 0);
  const set = (k: keyof typeof card) => (e: React.ChangeEvent<HTMLInputElement>) => setCard({ ...card, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const d = await gql<{ checkout: { id: string } }>(MUTATION, {
        input: {
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          shipping,
          payment: card,
        },
      });
      clearCart();
      sessionStorage.removeItem("shopper_shipping");
      router.push(`/orders/${d.checkout.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Checkout — payment</h1>
      <div className="panel">
        <p className="muted">
          This is a fake payment form. Use <code>4242 4242 4242 4242</code> to succeed, <code>4000 0000 0000 0002</code> to be
          declined, or <code>4000 0000 0000 9995</code> for insufficient funds. Any future expiry and 3-digit CVC.
        </p>
        <form onSubmit={submit} data-testid="payment-form">
          <label>Card number<input value={card.cardNumber} onChange={set("cardNumber")} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" required data-testid="card-number" /></label>
          <label>Name on card<input value={card.cardHolder} onChange={set("cardHolder")} required data-testid="card-holder" /></label>
          <div className="row">
            <label>Expiry (MM/YY)<input value={card.expiry} onChange={set("expiry")} placeholder="12/30" required data-testid="card-expiry" /></label>
            <label>CVC<input value={card.cvc} onChange={set("cvc")} inputMode="numeric" placeholder="123" required data-testid="card-cvc" /></label>
          </div>
          {error && <div className="error" role="alert" data-testid="payment-error">{error}</div>}
          <button type="submit" disabled={busy || cart.length === 0} data-testid="pay-button">
            {busy ? "Processing…" : `Pay ${formatMoney(total)}`}
          </button>
        </form>
      </div>
    </>
  );
}
