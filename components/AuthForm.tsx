"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { gql } from "@/lib/client";
import { useApp } from "./Providers";

function Form({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const { refreshUser } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await gql(
        `mutation($u: String!, $p: String!) { ${mode}(username: $u, password: $p) { user { id } } }`,
        { u: username, p: password },
      );
      await refreshUser();
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h1>{isLogin ? "Log in" : "Create account"}</h1>
      <form onSubmit={submit} data-testid={`${mode}-form`}>
        <label>Username
          <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required data-testid="username-input" />
        </label>
        <label>Password
          <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} required data-testid="password-input" />
        </label>
        {error && <div className="error" role="alert" data-testid="form-error">{error}</div>}
        <button type="submit" disabled={busy} data-testid="submit-button">{isLogin ? "Log in" : "Register"}</button>
      </form>
      <p className="muted">
        {isLogin ? (
          <>No account? <Link href="/register">Register</Link></>
        ) : (
          <>Already registered? <Link href="/login">Log in</Link></>
        )}
      </p>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense>
      <Form mode={mode} />
    </Suspense>
  );
}
