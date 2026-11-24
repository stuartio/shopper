# Shopper

A small web shop for testing (UI automation, API/GraphQL testing, load testing). Next.js 15 + GraphQL Yoga, deployable to Vercel.

## Features
- 40 products across 5 categories (Electronics, Clothing, Home & Kitchen, Books, Sports & Outdoors), each with a price and a real photo (`public/products/*.jpg`, fetched from Wikimedia Commons by `scripts/fetch-images.mjs`; the images carry their own licences, which is fine for a non-commercial test app).
- Cart (kept in `localStorage`), then checkout: shipping page, then a **fake** payment page, then an order confirmation.
- Register / login / logout with username + password (bcrypt, JWT in an httpOnly cookie).
- GraphQL API at `/api/graphql`. **Every call needs `Authorization: Bearer <api key>`** (401 otherwise). Create keys on the `/api-docs` page after logging in. That page also documents the schema and has runnable sample tests and a query playground.
- `data-testid` attributes on all key UI elements.

## Run locally
```
npm install
npm run dev        # http://localhost:3000
```

## Deploy to Vercel
```
npm i -g vercel
vercel            # or import the repo in the Vercel dashboard
```
Environment variables: `AUTH_SECRET` (optional; signs session tokens), `DATA_FILE` (optional; path of the data file).

**Storage:** users and orders are saved to a JSON file: `./data/shopper-data.json` locally (git-ignored), so data survives restarts.
On Vercel the filesystem is read-only except `/tmp`, so the file lives at `/tmp/shopper-data.json`. That is ephemeral and
per-instance: data can reset on cold starts and may not be shared between serverless instances. Fine for short tests, but
for long-lived state on Vercel you'd need an external store.

## Fake payments
| Card | Result |
|---|---|
| any 16 digits, e.g. `4242 4242 4242 4242` | Approved |
| `4000 0000 0000 0002` | Declined (`PAYMENT_DECLINED`) |
| `4000 0000 0000 9995` | Insufficient funds (`PAYMENT_DECLINED`) |

Expiry must be a future `MM/YY`; CVC 3-4 digits. Only the last 4 digits are stored.

## GraphQL
Two endpoints share one schema:
- `/api/graphql` is the public API. Bearer API key required on every request; a key acts as the user who created it. It exposes the shop operations only (no register/login).
- `/api/web/graphql` is the private endpoint the website itself uses (session cookie). It additionally has `register`, `login`, `logout`, `apiKeys`, `createApiKey` and `revokeApiKey`. It is not part of the documented API.

```graphql
query  { categories  products(category: "Books") { id name priceCents imageUrl }  product(id: "p001") { name } }
query  { me { id username }  myOrders { id totalCents status }  order(id: "ORD-XXXX") { items { name quantity } } }
mutation {
  checkout(input: {
    items: [{ productId: "p001", quantity: 2 }]
    shipping: { fullName: "A", address: "1 St", city: "X", postalCode: "1", country: "US" }
    payment: { cardNumber: "4242424242424242", cardHolder: "A", expiry: "12/30", cvc: "123" }
  }) { id totalCents status }
}
```
```
curl -X POST http://localhost:3000/api/graphql -H "Authorization: Bearer shp_..." -H "Content-Type: application/json" -d '{"query":"{ categories }"}'
```
Prices are always computed server-side. Errors carry `extensions.code` (`UNAUTHENTICATED`, `BAD_USER_INPUT`, `PAYMENT_DECLINED`, plus `INVALID_CREDENTIALS` and `USERNAME_TAKEN` on the web endpoint).
