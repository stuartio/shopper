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

export type ApiKeyRecord = { key: string; userId: string; name: string; createdAt: string };

export async function createApiKey(rec: ApiKeyRecord) {
  await set(`apikey:${rec.key}`, rec);
  const keys = (await get<string[]>(`apikeys:${rec.userId}`)) ?? [];
  await set(`apikeys:${rec.userId}`, [rec.key, ...keys]);
}

export const getApiKey = (key: string) => get<ApiKeyRecord>(`apikey:${key}`);

export async function listApiKeys(userId: string) {
  const keys = (await get<string[]>(`apikeys:${userId}`)) ?? [];
  const recs = await Promise.all(keys.map((k) => getApiKey(k)));
  return recs.filter((r): r is ApiKeyRecord => !!r);
}

export async function deleteApiKey(userId: string, key: string) {
  const rec = await getApiKey(key);
  if (!rec || rec.userId !== userId) return false;
  const db = load();
  delete db[`apikey:${key}`];
  db[`apikeys:${userId}`] = ((db[`apikeys:${userId}`] as string[]) ?? []).filter((k) => k !== key);
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  return true;
}

export const getUserById =(id: string) => get<UserRecord>(`userid:${id}`);

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
