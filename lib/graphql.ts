import { createSchema, createYoga, type Plugin } from "graphql-yoga";
import { GraphQLError } from "graphql";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { CATEGORIES, getProduct, listProducts } from "./catalog";
import { clearCookie, extractBearer, extractSessionCookie, sessionCookie, signToken, verifyToken } from "./auth";
import {
  createApiKey,
  createUser,
  deleteApiKey,
  getApiKey,
  getOrder,
  getUserById,
  getUserByName,
  listApiKeys,
  listOrders,
  saveOrder,
  type OrderRecord,
  type UserRecord,
} from "./store";

type Ctx = { user: UserRecord | null; setCookie: (v: string) => void };

// Two flavours of the same API:
//  - "public": /api/graphql      -> every call needs "Authorization: Bearer <api key>". Shop operations only.
//  - "web":    /api/web/graphql  -> used by this site's own UI, session-cookie auth. Adds account + API key management.
export type Mode = "public" | "web";

const baseTypes = /* GraphQL */ `
  type Product {
    id: ID!
    name: String!
    description: String!
    priceCents: Int!
    category: String!
    imageUrl: String!
  }
  type User {
    id: ID!
    username: String!
  }
  type OrderItem {
    productId: ID!
    name: String!
    priceCents: Int!
    quantity: Int!
  }
  type Shipping {
    fullName: String!
    address: String!
    city: String!
    postalCode: String!
    country: String!
  }
  type Order {
    id: ID!
    status: String!
    items: [OrderItem!]!
    totalCents: Int!
    shipping: Shipping!
    cardLast4: String!
    createdAt: String!
  }
  input CartItemInput {
    productId: ID!
    quantity: Int!
  }
  input ShippingInput {
    fullName: String!
    address: String!
    city: String!
    postalCode: String!
    country: String!
  }
  input PaymentInput {
    cardNumber: String!
    cardHolder: String!
    expiry: String!
    cvc: String!
  }
  input CheckoutInput {
    items: [CartItemInput!]!
    shipping: ShippingInput!
    payment: PaymentInput!
  }
`;

const webTypes = /* GraphQL */ `
  type AuthPayload {
    user: User!
  }
  type ApiKey {
    key: String!
    name: String!
    createdAt: String!
  }
`;

const typeDefsFor = (mode: Mode) => /* GraphQL */ `
  ${baseTypes}
  ${mode === "web" ? webTypes : ""}
  type Query {
    categories: [String!]!
    products(category: String): [Product!]!
    product(id: ID!): Product
    me: User
    myOrders: [Order!]!
    order(id: ID!): Order
    ${mode === "web" ? "apiKeys: [ApiKey!]!" : ""}
  }
  type Mutation {
    checkout(input: CheckoutInput!): Order!
    ${
      mode === "web"
        ? `register(username: String!, password: String!): AuthPayload!
    login(username: String!, password: String!): AuthPayload!
    logout: Boolean!
    createApiKey(name: String): ApiKey!
    revokeApiKey(key: String!): Boolean!`
        : ""
    }
  }
`;

const fail = (message: string, code: string): never => {
  throw new GraphQLError(message, { extensions: { code } });
};

const requireUser = (ctx: Ctx) => ctx.user ?? fail("You must be logged in", "UNAUTHENTICATED");

const publicUser = (u: UserRecord) => ({ id: u.id, username: u.username });

async function authPayload(ctx: Ctx, user: UserRecord) {
  ctx.setCookie(sessionCookie(await signToken(user.id)));
  return { user: publicUser(user) };
}

// Spoofed payment processing. Test cards:
//   any 16 digits        -> approved
//   4000 0000 0000 0002  -> declined
//   4000 0000 0000 9995  -> insufficient funds
function spoofCharge(card: string): void {
  if (card === "4000000000000002") fail("Your card was declined", "PAYMENT_DECLINED");
  if (card === "4000000000009995") fail("Insufficient funds", "PAYMENT_DECLINED");
}

function validatePayment(p: { cardNumber: string; cardHolder: string; expiry: string; cvc: string }): string {
  const card = p.cardNumber.replace(/[\s-]/g, "");
  if (!/^\d{16}$/.test(card)) fail("Card number must be 16 digits", "BAD_USER_INPUT");
  if (!p.cardHolder.trim()) fail("Card holder is required", "BAD_USER_INPUT");
  if (!/^\d{3,4}$/.test(p.cvc)) fail("CVC must be 3 or 4 digits", "BAD_USER_INPUT");
  const m = /^(\d{2})\/(\d{2})$/.exec(p.expiry);
  if (!m) return fail("Expiry must be MM/YY", "BAD_USER_INPUT");
  const month = Number(m![1]);
  const year = 2000 + Number(m![2]);
  const now = new Date();
  if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1))
    fail("Card has expired", "BAD_USER_INPUT");
  return card;
}

const shopResolvers = {
  Query: {
    categories: () => CATEGORIES,
    products: (_: unknown, a: { category?: string | null }) => listProducts(a.category),
    product: (_: unknown, a: { id: string }) => getProduct(a.id) ?? null,
    me: (_: unknown, __: unknown, ctx: Ctx) => (ctx.user ? publicUser(ctx.user) : null),
    myOrders: async (_: unknown, __: unknown, ctx: Ctx) => listOrders(requireUser(ctx).id),
    order: async (_: unknown, a: { id: string }, ctx: Ctx) => {
      const user = requireUser(ctx);
      const order = await getOrder(a.id);
      return order && order.userId === user.id ? order : null;
    },
  },
  Mutation: {
    checkout: async (
      _: unknown,
      a: {
        input: {
          items: { productId: string; quantity: number }[];
          shipping: OrderRecord["shipping"];
          payment: { cardNumber: string; cardHolder: string; expiry: string; cvc: string };
        };
      },
      ctx: Ctx,
    ) => {
      const user = requireUser(ctx);
      const { items, shipping, payment } = a.input;
      if (items.length === 0) fail("Cart is empty", "BAD_USER_INPUT");
      const lines = items.map((i) => {
        const p = getProduct(i.productId) ?? fail(`Unknown product ${i.productId}`, "BAD_USER_INPUT");
        if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)
          fail("Quantity must be between 1 and 99", "BAD_USER_INPUT");
        return { productId: p.id, name: p.name, priceCents: p.priceCents, quantity: i.quantity };
      });
      for (const [k, v] of Object.entries(shipping)) if (!v.trim()) fail(`Shipping ${k} is required`, "BAD_USER_INPUT");
      const card = validatePayment(payment);
      spoofCharge(card);
      const order: OrderRecord = {
        id: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId: user.id,
        status: "PAID",
        items: lines,
        totalCents: lines.reduce((s, l) => s + l.priceCents * l.quantity, 0),
        shipping,
        cardLast4: card.slice(-4),
        createdAt: new Date().toISOString(),
      };
      await saveOrder(order);
      return order;
    },
  },
};

const webResolvers = {
  Query: {
    apiKeys: async (_: unknown, __: unknown, ctx: Ctx) => listApiKeys(requireUser(ctx).id),
  },
  Mutation: {
    register: async (_: unknown, a: { username: string; password: string }, ctx: Ctx) => {
      const username = a.username.trim();
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username))
        fail("Username must be 3-32 characters (letters, numbers, _ . -)", "BAD_USER_INPUT");
      if (a.password.length < 6) fail("Password must be at least 6 characters", "BAD_USER_INPUT");
      if (await getUserByName(username)) fail("Username already taken", "USERNAME_TAKEN");
      const user: UserRecord = { id: randomUUID(), username, passwordHash: await bcrypt.hash(a.password, 8) };
      await createUser(user);
      return authPayload(ctx, user);
    },
    login: async (_: unknown, a: { username: string; password: string }, ctx: Ctx) => {
      const user = await getUserByName(a.username.trim());
      if (!user || !(await bcrypt.compare(a.password, user.passwordHash)))
        return fail("Invalid username or password", "INVALID_CREDENTIALS");
      return authPayload(ctx, user);
    },
    logout: (_: unknown, __: unknown, ctx: Ctx) => {
      ctx.setCookie(clearCookie);
      return true;
    },
    createApiKey: async (_: unknown, a: { name?: string | null }, ctx: Ctx) => {
      const user = requireUser(ctx);
      const rec = {
        key: `shp_${randomBytes(16).toString("hex")}`,
        userId: user.id,
        name: a.name?.trim() || "API key",
        createdAt: new Date().toISOString(),
      };
      await createApiKey(rec);
      return rec;
    },
    revokeApiKey: async (_: unknown, a: { key: string }, ctx: Ctx) => deleteApiKey(requireUser(ctx).id, a.key),
  },
};

// Lets resolvers set a Set-Cookie header on the HTTP response.
const cookiesByRequest = new WeakMap<Request, string[]>();

const cookiePlugin: Plugin = {
  onResponse({ request, response }) {
    for (const c of cookiesByRequest.get(request) ?? []) response.headers.append("Set-Cookie", c);
  },
};

function makeYoga(mode: Mode) {
  const resolvers =
    mode === "web"
      ? {
          Query: { ...shopResolvers.Query, ...webResolvers.Query },
          Mutation: { ...shopResolvers.Mutation, ...webResolvers.Mutation },
        }
      : shopResolvers;

  return createYoga<object, Ctx>({
    schema: createSchema({ typeDefs: typeDefsFor(mode), resolvers }),
    graphqlEndpoint: mode === "web" ? "/api/web/graphql" : "/api/graphql",
    graphiql: false,
    fetchAPI: { Response },
    plugins: [cookiePlugin],
    maskedErrors: false,
    context: async ({ request }): Promise<Ctx> => {
      const cookies: string[] = [];
      cookiesByRequest.set(request, cookies);
      let userId: string | null = null;
      if (mode === "public") {
        const key = extractBearer(request);
        userId = key ? ((await getApiKey(key))?.userId ?? null) : null;
      } else {
        const token = extractSessionCookie(request);
        userId = token ? await verifyToken(token) : null;
      }
      return { user: userId ? await getUserById(userId) : null, setCookie: (v) => cookies.push(v) };
    },
  });
}

const g = globalThis as unknown as { __yoga?: Record<Mode, ReturnType<typeof makeYoga>> };
const instances = (g.__yoga ??= { public: makeYoga("public"), web: makeYoga("web") });

export const webYoga = instances.web;

const unauthorized = (message: string) =>
  new Response(JSON.stringify({ errors: [{ message, extensions: { code: "UNAUTHENTICATED" } }] }), {
    status: 401,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": 'Bearer realm="shopper"' },
  });

// Public endpoint: reject anything without a valid API key before it reaches GraphQL.
export async function handlePublic(request: Request): Promise<Response> {
  const key = extractBearer(request);
  if (!key) return unauthorized("Missing API key. Send 'Authorization: Bearer <your API key>'.");
  if (!(await getApiKey(key))) return unauthorized("Invalid API key.");
  return instances.public.fetch(request);
}
