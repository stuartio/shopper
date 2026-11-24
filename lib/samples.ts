// Sample GraphQL tests shown (and runnable) on the /api-docs page.
// check() returns null when the response is what we expect, otherwise a message describing the failure.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Sample = {
  id: string;
  name: string;
  description: string;
  /** which Authorization header to send: the user's key, none at all, or a bogus key */
  auth: "key" | "none" | "bad";
  query: string;
  variables?: Record<string, unknown>;
  expect: string;
  check: (status: number, body: any) => string | null;
};

const CHECKOUT = `mutation Checkout($input: CheckoutInput!) {
  checkout(input: $input) { id status totalCents cardLast4 items { name quantity priceCents } }
}`;

const checkoutVars = (cardNumber: string, expiry = "12/30") => ({
  input: {
    items: [{ productId: "p001", quantity: 2 }],
    shipping: { fullName: "Test User", address: "1 Test St", city: "Testville", postalCode: "12345", country: "US" },
    payment: { cardNumber, cardHolder: "Test User", expiry, cvc: "123" },
  },
});

const errCode = (b: any) => b?.errors?.[0]?.extensions?.code;

export const SAMPLES: Sample[] = [
  {
    id: "categories",
    name: "List categories",
    description: "Returns every product category.",
    auth: "key",
    query: `{ categories }`,
    expect: "HTTP 200 and more than one category",
    check: (s, b) =>
      s !== 200 ? `HTTP ${s}` : (b?.data?.categories?.length ?? 0) > 1 ? null : "expected more than one category",
  },
  {
    id: "products",
    name: "List all products",
    description: "The catalogue has at most 50 products, each with a positive price and an image.",
    auth: "key",
    query: `{ products { id name priceCents category imageUrl } }`,
    expect: "1-50 products, all with priceCents > 0 and an imageUrl",
    check: (s, b) => {
      const p = b?.data?.products;
      if (s !== 200 || !Array.isArray(p)) return `HTTP ${s}, no products array`;
      if (p.length < 1 || p.length > 50) return `got ${p.length} products`;
      return p.every((x: any) => x.priceCents > 0 && x.imageUrl) ? null : "a product has no price or image";
    },
  },
  {
    id: "filter",
    name: "Filter products by category",
    description: "Uses a variable to ask for one category only.",
    auth: "key",
    query: `query ($category: String) { products(category: $category) { id name category } }`,
    variables: { category: "Books" },
    expect: "a non-empty list where every product is in Books",
    check: (s, b) => {
      const p = b?.data?.products;
      if (s !== 200 || !Array.isArray(p) || p.length === 0) return `HTTP ${s}, empty or missing list`;
      return p.every((x: any) => x.category === "Books") ? null : "found a product outside Books";
    },
  },
  {
    id: "product",
    name: "Get one product",
    description: "Fetch a single product by id.",
    auth: "key",
    query: `{ product(id: "p001") { id name description priceCents category imageUrl } }`,
    expect: "product p001 with a name",
    check: (s, b) => (s === 200 && b?.data?.product?.id === "p001" && b.data.product.name ? null : "p001 not returned"),
  },
  {
    id: "unknown-product",
    name: "Unknown product returns null",
    description: "A missing id is not an error; the field is simply null.",
    auth: "key",
    query: `{ product(id: "does-not-exist") { id } }`,
    expect: "HTTP 200 and data.product is null",
    check: (s, b) => (s === 200 && b?.data?.product === null ? null : "expected data.product to be null"),
  },
  {
    id: "me",
    name: "Who am I?",
    description: "The API key identifies the user it belongs to.",
    auth: "key",
    query: `{ me { id username } }`,
    expect: "your username",
    check: (s, b) => (s === 200 && b?.data?.me?.username ? null : "no user returned"),
  },
  {
    id: "no-key",
    name: "No API key is rejected",
    description: "Calls without an Authorization header fail with 401.",
    auth: "none",
    query: `{ categories }`,
    expect: "HTTP 401 with code UNAUTHENTICATED",
    check: (s, b) => (s === 401 && errCode(b) === "UNAUTHENTICATED" ? null : `got HTTP ${s}`),
  },
  {
    id: "bad-key",
    name: "Invalid API key is rejected",
    description: "A made-up key fails with 401.",
    auth: "bad",
    query: `{ categories }`,
    expect: "HTTP 401 with code UNAUTHENTICATED",
    check: (s, b) => (s === 401 && errCode(b) === "UNAUTHENTICATED" ? null : `got HTTP ${s}`),
  },
  {
    id: "declined",
    name: "Checkout: declined card",
    description: "Card 4000 0000 0000 0002 is always declined.",
    auth: "key",
    query: CHECKOUT,
    variables: checkoutVars("4000000000000002"),
    expect: "error code PAYMENT_DECLINED",
    check: (_s, b) => (errCode(b) === "PAYMENT_DECLINED" ? null : "expected PAYMENT_DECLINED"),
  },
  {
    id: "expired",
    name: "Checkout: validation error",
    description: "An expiry date in the past is rejected before payment.",
    auth: "key",
    query: CHECKOUT,
    variables: checkoutVars("4242424242424242", "01/20"),
    expect: "error code BAD_USER_INPUT",
    check: (_s, b) => (errCode(b) === "BAD_USER_INPUT" ? null : "expected BAD_USER_INPUT"),
  },
  {
    id: "checkout",
    name: "Checkout: successful order",
    description: "Two of product p001 paid with 4242 4242 4242 4242. Total is computed on the server.",
    auth: "key",
    query: CHECKOUT,
    variables: checkoutVars("4242424242424242"),
    expect: "status PAID, cardLast4 4242, totalCents = 2 x price of p001",
    check: (_s, b) => {
      const o = b?.data?.checkout;
      if (!o) return b?.errors?.[0]?.message ?? "no order returned";
      if (o.status !== "PAID" || o.cardLast4 !== "4242") return `status ${o.status}, card ${o.cardLast4}`;
      return o.totalCents === 2 * o.items[0].priceCents ? null : "total does not match line items";
    },
  },
  {
    id: "orders",
    name: "List my orders",
    description: "Orders placed with this key's user. Run the successful checkout first to have one.",
    auth: "key",
    query: `{ myOrders { id status totalCents createdAt } }`,
    expect: "an array of orders",
    check: (s, b) => (s === 200 && Array.isArray(b?.data?.myOrders) ? null : "no orders array"),
  },
];
