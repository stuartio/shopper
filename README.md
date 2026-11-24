# Shopper

A small web shop for testing (UI automation, API/GraphQL testing, load testing). Next.js 15 + GraphQL Yoga, deployable to Vercel.

## Features
- 40 products across 5 categories (Electronics, Clothing, Home & Kitchen, Books, Sports & Outdoors), each with a price and an image (generated SVGs at `/images/:id`, no external hosting).
- Cart (kept in `localStorage`), then checkout: shipping page, then a **fake** payment page, then an order confirmation.
- Register / login / logout with username + password (bcrypt, JWT in an httpOnly cookie).
- GraphQL API at `/api/graphql` (GraphiQL is available in the browser at the same URL).
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
```graphql
query  { categories  products(category: "Books") { id name priceCents imageUrl }  product(id: "p001") { name } }
query  { me { id username }  myOrders { id totalCents status }  order(id: "ORD-XXXX") { items { name quantity } } }
mutation { register(username: "alice", password: "secret1") { token user { id username } } }
mutation { login(username: "alice", password: "secret1") { token } }
mutation { logout }
mutation {
  checkout(input: {
    items: [{ productId: "p001", quantity: 2 }]
    shipping: { fullName: "A", address: "1 St", city: "X", postalCode: "1", country: "US" }
    payment: { cardNumber: "4242424242424242", cardHolder: "A", expiry: "12/30", cvc: "123" }
  }) { id totalCents status }
}
```
Authenticate API calls with either the session cookie or `Authorization: Bearer <token>` (the token is returned by `register`/`login`).
Prices are always computed server-side. Errors carry `extensions.code` (`UNAUTHENTICATED`, `BAD_USER_INPUT`, `INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `PAYMENT_DECLINED`).
