"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "./Providers";
import { gql } from "@/lib/client";

export function Header() {
  const { user, authLoaded, refreshUser, cart } = useApp();
  const router = useRouter();
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  async function logout() {
    await gql("mutation { logout }");
    await refreshUser();
    router.push("/");
  }

  return (
    <header className="header">
      <Link href="/" className="brand" data-testid="brand">
        Shopper
      </Link>
      <nav>
        <Link href="/" data-testid="nav-products">Products</Link>
        <Link href="/api-docs" data-testid="nav-api">API</Link>
        <Link href="/cart" data-testid="nav-cart">
          Cart (<span data-testid="cart-count">{count}</span>)
        </Link>
        {authLoaded &&
          (user ? (
            <>
              <Link href="/orders" data-testid="nav-orders">Orders</Link>
              <span data-testid="nav-username">{user.username}</span>
              <button onClick={logout} data-testid="logout-button">Log out</button>
            </>
          ) : (
            <>
              <Link href="/login" data-testid="nav-login">Log in</Link>
              <Link href="/register" data-testid="nav-register">Register</Link>
            </>
          ))}
      </nav>
    </header>
  );
}
