"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { gql } from "@/lib/client";

export type CartLine = { productId: string; name: string; priceCents: number; imageUrl: string; quantity: number };
type User = { id: string; username: string };

type Ctx = {
  user: User | null;
  authLoaded: boolean;
  refreshUser: () => Promise<void>;
  cart: CartLine[];
  addToCart: (line: Omit<CartLine, "quantity">) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const d = await gql<{ me: User | null }>("{ me { id username } }");
      setUser(d.me);
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    try {
      setCart(JSON.parse(localStorage.getItem("shopper_cart") ?? "[]"));
    } catch {}
    setCartLoaded(true);
  }, [refreshUser]);

  useEffect(() => {
    if (cartLoaded) localStorage.setItem("shopper_cart", JSON.stringify(cart));
  }, [cart, cartLoaded]);

  const addToCart: Ctx["addToCart"] = (line) =>
    setCart((c) =>
      c.some((l) => l.productId === line.productId)
        ? c.map((l) => (l.productId === line.productId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...c, { ...line, quantity: 1 }],
    );

  const setQuantity: Ctx["setQuantity"] = (id, q) =>
    setCart((c) => (q <= 0 ? c.filter((l) => l.productId !== id) : c.map((l) => (l.productId === id ? { ...l, quantity: q } : l))));

  return (
    <AppCtx.Provider value={{ user, authLoaded, refreshUser, cart, addToCart, setQuantity, clearCart: () => setCart([]) }}>
      {children}
    </AppCtx.Provider>
  );
}
