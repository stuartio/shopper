"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import { gql } from "@/lib/client";
import { SAMPLES, type Sample } from "@/lib/samples";

type ApiKey = { key: string; name: string; createdAt: string };
type Result = { status: number; body: unknown; error: string | null; ms: number };

async function call(query: string, variables: unknown, auth: Sample["auth"], key: string): Promise<Result> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth === "key") headers.Authorization = `Bearer ${key}`;
  if (auth === "bad") headers.Authorization = "Bearer shp_not_a_real_key";
  const t = performance.now();
  const res = await fetch("/api/graphql", { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, error: null, ms: Math.round(performance.now() - t) };
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

export default function ApiDocs() {
  const { user, authLoaded } = useApp();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState("");
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState<Record<string, { result: Result; failure: string | null }>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [pgQuery, setPgQuery] = useState("{\n  products(category: \"Electronics\") {\n    id\n    name\n    priceCents\n  }\n}");
  const [pgVars, setPgVars] = useState("");
  const [pgResult, setPgResult] = useState<Result | null>(null);

  const loadKeys = useCallback(async () => {
    const d = await gql<{ apiKeys: ApiKey[] }>("{ apiKeys { key name createdAt } }");
    setKeys(d.apiKeys);
    setActive((a) => (a && d.apiKeys.some((k) => k.key === a) ? a : (d.apiKeys[0]?.key ?? "")));
  }, []);

  useEffect(() => {
    if (user) loadKeys().catch((e) => setMsg(e.message));
  }, [user, loadKeys]);

  async function createKey() {
    setMsg("");
    try {
      const d = await gql<{ createApiKey: ApiKey }>(
        "mutation($n: String) { createApiKey(name: $n) { key name createdAt } }",
        { n: name },
      );
      setName("");
      await loadKeys();
      setActive(d.createApiKey.key);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function revoke(key: string) {
    await gql("mutation($k: String!) { revokeApiKey(key: $k) }", { k: key });
    await loadKeys();
  }

  async function runSample(s: Sample) {
    setRunning(s.id);
    const result = await call(s.query, s.variables, s.auth, active);
    setResults((r) => ({ ...r, [s.id]: { result, failure: s.check(result.status, result.body) } }));
    setRunning(null);
  }

  async function runAll() {
    for (const s of SAMPLES) await runSample(s);
  }

  async function runPlayground() {
    let vars: unknown = undefined;
    try {
      vars = pgVars.trim() ? JSON.parse(pgVars) : undefined;
    } catch {
      return setPgResult({ status: 0, body: null, error: "Variables are not valid JSON", ms: 0 });
    }
    setPgResult(await call(pgQuery, vars, "key", active));
  }

  const keyOrPlaceholder = active || "YOUR_API_KEY";
  const curl = `curl -X POST ${typeof window === "undefined" ? "" : window.location.origin}/api/graphql \\
  -H "Authorization: Bearer ${keyOrPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"{ products(category: \\"Books\\") { id name priceCents } }"}'`;

  const passed = SAMPLES.filter((s) => results[s.id] && !results[s.id].failure).length;
  const ran = SAMPLES.filter((s) => results[s.id]).length;
  const needKey = !active;

  return (
    <div data-testid="api-docs">
      <h1>GraphQL API</h1>
      <p>
        Everything the shop can do is available over GraphQL at <code>POST /api/graphql</code>. Every request must carry an API
        key as a bearer token: <code>Authorization: Bearer &lt;key&gt;</code>. Requests with a missing or invalid key get{" "}
        <code>HTTP 401</code>. A key acts as the user who created it.
      </p>

      <h2>1. Your API keys</h2>
      <div className="panel wide" data-testid="api-keys-panel">
        {!authLoaded ? (
          <p>Loading…</p>
        ) : !user ? (
          <p data-testid="api-keys-login-prompt">
            <Link href="/login?next=/api-docs">Log in</Link> or <Link href="/register?next=/api-docs">register</Link> to create an API key.
          </p>
        ) : (
          <>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <label>Key name (optional)
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. postman" data-testid="api-key-name" />
              </label>
              <div><button onClick={createKey} data-testid="create-api-key">Create API key</button></div>
            </div>
            {msg && <div className="error">{msg}</div>}
            {keys.length === 0 ? (
              <p className="muted" data-testid="no-api-keys">You have no keys yet.</p>
            ) : (
              <table data-testid="api-keys-table">
                <thead><tr><th>Name</th><th>Key</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.key} data-testid="api-key-row">
                      <td>{k.name}</td>
                      <td><code data-testid="api-key-value">{k.key}</code></td>
                      <td>{new Date(k.createdAt).toLocaleString()}</td>
                      <td>
                        <button className="secondary" onClick={() => setActive(k.key)} disabled={active === k.key}>
                          {active === k.key ? "In use below" : "Use below"}
                        </button>{" "}
                        <button className="secondary" onClick={() => revoke(k.key)}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        <label style={{ marginTop: 12 }}>Key used by the examples and test runner below
          <input value={active} onChange={(e) => setActive(e.target.value.trim())} placeholder="shp_…" data-testid="active-key" />
        </label>
      </div>

      <h2>2. Example request</h2>
      <pre className="code" data-testid="curl-example">{curl}</pre>

      <h2>3. Schema</h2>
      <pre className="code">{`type Query {
  categories: [String!]!
  products(category: String): [Product!]!      # at most 50 products
  product(id: ID!): Product                    # null if the id is unknown
  me: User                                     # the owner of the API key
  myOrders: [Order!]!
  order(id: ID!): Order                        # null if not yours / unknown
}
type Mutation {
  checkout(input: CheckoutInput!): Order!      # fake payment, see test cards below
}
type Product { id: ID!  name: String!  description: String!  priceCents: Int!  category: String!  imageUrl: String! }
type Order   { id: ID!  status: String!  items: [OrderItem!]!  totalCents: Int!  shipping: Shipping!  cardLast4: String!  createdAt: String! }
input CheckoutInput { items: [CartItemInput!]!  shipping: ShippingInput!  payment: PaymentInput! }
input CartItemInput { productId: ID!  quantity: Int! }       # 1-99
input ShippingInput { fullName: String!  address: String!  city: String!  postalCode: String!  country: String! }
input PaymentInput  { cardNumber: String!  cardHolder: String!  expiry: String!  cvc: String! }   # expiry is MM/YY`}</pre>
      <p>
        <strong>Test cards:</strong> any 16 digits are approved; <code>4000 0000 0000 0002</code> is declined;{" "}
        <code>4000 0000 0000 9995</code> is insufficient funds. Errors carry <code>extensions.code</code>:{" "}
        <code>UNAUTHENTICATED</code>, <code>BAD_USER_INPUT</code>, <code>PAYMENT_DECLINED</code>. Registering and logging in are done on
        the website; the API key then identifies you.
      </p>

      <h2>4. Sample tests</h2>
      <p>
        <button onClick={runAll} disabled={needKey || running !== null} data-testid="run-all">Run all</button>{" "}
        {ran > 0 && (
          <strong data-testid="run-summary" className={passed === ran ? "success" : ""}>
            {passed}/{ran} passed
          </strong>
        )}
        {needKey && <span className="muted"> Create or paste an API key first.</span>}
      </p>
      {SAMPLES.map((s) => {
        const r = results[s.id];
        return (
          <details key={s.id} className="sample" data-testid={`sample-${s.id}`}>
            <summary>
              <span className={r ? (r.failure ? "badge fail" : "badge pass") : "badge"}>{r ? (r.failure ? "FAIL" : "PASS") : "–"}</span>{" "}
              <strong>{s.name}</strong> <span className="muted">— {s.description}</span>
            </summary>
            <p className="muted">Expect: {s.expect}</p>
            <pre className="code">{s.query}</pre>
            {s.variables !== undefined && <pre className="code">{pretty(s.variables)}</pre>}
            <button onClick={() => runSample(s)} disabled={(needKey && s.auth === "key") || running !== null} data-testid={`run-${s.id}`}>
              {running === s.id ? "Running…" : "Run"}
            </button>
            {r && (
              <>
                {r.failure && <div className="error" data-testid={`failure-${s.id}`}>{r.failure}</div>}
                <pre className="code">{`HTTP ${r.result.status} (${r.result.ms} ms)\n${pretty(r.result.body)}`}</pre>
              </>
            )}
          </details>
        );
      })}

      <h2>5. Try your own query</h2>
      <div className="panel wide">
        <label>Query<textarea rows={8} value={pgQuery} onChange={(e) => setPgQuery(e.target.value)} data-testid="pg-query" /></label>
        <label>Variables (JSON, optional)<textarea rows={3} value={pgVars} onChange={(e) => setPgVars(e.target.value)} data-testid="pg-vars" /></label>
        <p><button onClick={runPlayground} disabled={needKey} data-testid="pg-run">Run query</button></p>
        {pgResult && (
          <pre className="code" data-testid="pg-result">
            {pgResult.error ?? `HTTP ${pgResult.status} (${pgResult.ms} ms)\n${pretty(pgResult.body)}`}
          </pre>
        )}
      </div>
    </div>
  );
}
