import { createSchema, createYoga, type Plugin } from "graphql-yoga";
import { GraphQLError } from "graphql";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { CATEGORIES, getProduct, listProducts } from "./catalog";
import { clearCookie, extractToken, sessionCookie, signToken, verifyToken } from "./auth";
import {
  createUser,
  getOrder,
  getUserById,
  getUserByName,
  listOrders,
  saveOrder,
  type OrderRecord,
  type UserRecord,
} from "./store";

type Ctx = { user: UserRecord | null; setCookie: (v: string) => void };

const typeDefs = /* GraphQL */ `
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
  type AuthPayload {
    token: String!
    user: User!
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
  type Query {
    categories: [String!]!
    products(category: String): [Product!]!
    product(id: ID!): Product
    me: User
    myOrders: [Order!]!
    order(id: ID!): Order
  }
  type Mutation {
    register(username: String!, password: String!): AuthPayload!
    login(username: String!, password: String!): AuthPayload!
    logout: Boolean!
    checkout(input: CheckoutInput!): Order!
  }
`;

const fail = (message: string, code: string): never => {
  throw new GraphQLError(message, { extensions: { code } });
};

const requireUser = (ctx: Ctx) => ctx.user ?? fail("You must be logged in", "UNAUTHENTICATED");

const publicUser = (u: UserRecord) => ({ id: u.id, username: u.username });

async function authPayload(ctx: Ctx, user: UserRecord) {
  const token = await signToken(user.id);
  ctx.setCookie(sessionCookie(token));
  return { token, user: publicUser(user) };
}

// Spoofed payment processing. Test cards:
//   4242 4242 4242 4242  -> approved (any 16 digits are approved unless listed below)
//   4000 0000 0000 0002  -> declined
//   4000 0000 0000 9995  -> insufficient funds
function spoofCharge(card: string): void {
  if (card === "4000000000000002") fail("Your card was declined", "PAYMENT_DECLINED");
  if (card === "4000000000009995") fail("Insufficient funds", "PAYMENT_DECLINED");
}

function validatePayment(p: { cardNumber: string; cardHolder: string; expiry: string; cvc: string }) {
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

const toOrder = (o: OrderRecord) => o;

const resolvers = {
  Query: {
    categories: () => CATEGORIES,
    products: (_: unknown, a: { category?: string | null }) => listProducts(a.category),
    product: (_: unknown, a: { id: string }) => getProduct(a.id) ?? null,
    me: (_: unknown, __: unknown, ctx: Ctx) => (ctx.user ? publicUser(ctx.user) : null),
    myOrders: async (_: unknown, __: unknown, ctx: Ctx) => (await listOrders(requireUser(ctx).id)).map(toOrder),
    order: async (_: unknown, a: { id: string }, ctx: Ctx) => {
      const user = requireUser(ctx);
      const order = await getOrder(a.id);
      return order && order.userId === user.id ? toOrder(order) : null;
    },
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
      const card = validatePayment(payment) as string;
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
      return toOrder(order);
    },
  },
};

// Lets resolvers set a Set-Cookie header on the HTTP response.
const cookiesByRequest = new WeakMap<Request, string[]>();

const cookiePlugin: Plugin = {
  onResponse({ request, response }) {
    for (const c of cookiesByRequest.get(request) ?? []) response.headers.append("Set-Cookie", c);
  },
};

export const yoga = createYoga<object, Ctx>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  plugins: [cookiePlugin],
  maskedErrors: false,
  context: async ({ request }): Promise<Ctx> => {
    const cookies: string[] = [];
    cookiesByRequest.set(request, cookies);
    const token = extractToken(request);
    const userId = token ? await verifyToken(token) : null;
    return { user: userId ? await getUserById(userId) : null, setCookie: (v) => cookies.push(v) };
  },
});
