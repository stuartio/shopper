// Persistence layer: a single JSON file on local disk (testing only).
// Location: $DATA_FILE, else /tmp/shopper-data.json on Vercel (the only writable path there,
// and it is ephemeral), else ./data/shopper-data.json.

import fs from "node:fs";
import path from "node:path";

export type UserRecord = { id: string; username: string; passwordHash: string };

export type OrderItem = { productId: string; name: string; priceCents: number; quantity: number };

export type OrderRecord = {
  id: string;
  userId: string;
  status: string;
  items: OrderItem[];
  totalCents: number;
  shipping: { fullName: string; address: string; city: string; postalCode: string; country: string };
  cardLast4: string;
  createdAt: string;
};

const FILE =
  process.env.DATA_FILE ??
  (process.env.VERCEL ? "/tmp/shopper-data.json" : path.join(process.cwd(), "data", "shopper-data.json"));

type Db = Record<string, unknown>;

function load(): Db {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
  } catch {
    return {};
  }
}

async function get<T>(key: string): Promise<T | null> {
  return (load()[key] as T | undefined) ?? null;
}

async function set(key: string, value: unknown) {
  const db = load();
  db[key] = value;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const dataFile = () => FILE;

export const getUserByName = (username: string) => get<UserRecord>(`user:${username.toLowerCase()}`);

export async function createUser(user: UserRecord) {
  await set(`user:${user.username.toLowerCase()}`, user);
  await set(`userid:${user.id}`, user);
}

export const getUserById = (id: string) => get<UserRecord>(`userid:${id}`);

export async function saveOrder(order: OrderRecord) {
  await set(`order:${order.id}`, order);
  const ids = (await get<string[]>(`orders:${order.userId}`)) ?? [];
  await set(`orders:${order.userId}`, [order.id, ...ids]);
}

export const getOrder = (id: string) => get<OrderRecord>(`order:${id}`);

export async function listOrders(userId: string) {
  const ids = (await get<string[]>(`orders:${userId}`)) ?? [];
  const orders = await Promise.all(ids.map((id) => getOrder(id)));
  return orders.filter((o): o is OrderRecord => !!o);
}
