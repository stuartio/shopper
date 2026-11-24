export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string;
};

// 5 categories x 8 products = 40 products (limit is 50).
const RAW: Record<string, [string, number][]> = {
  Electronics: [
    ["Wireless Headphones", 8999],
    ["Bluetooth Speaker", 4999],
    ["Smart Watch", 15999],
    ["USB-C Charger", 2499],
    ["Mechanical Keyboard", 10999],
    ["Webcam 1080p", 5999],
    ["Portable Power Bank", 3499],
    ["Noise-Cancelling Earbuds", 12999],
  ],
  Clothing: [
    ["Cotton T-Shirt", 1999],
    ["Denim Jacket", 7999],
    ["Running Shorts", 2999],
    ["Wool Beanie", 1499],
    ["Hooded Sweatshirt", 4999],
    ["Leather Belt", 2999],
    ["Rain Jacket", 8999],
    ["Merino Socks (3 pack)", 2199],
  ],
  "Home & Kitchen": [
    ["Ceramic Mug Set", 2499],
    ["Chef's Knife", 5999],
    ["Cast Iron Skillet", 3999],
    ["French Press", 3299],
    ["Bamboo Cutting Board", 2299],
    ["Scented Candle", 1699],
    ["Throw Blanket", 3999],
    ["Glass Storage Jars", 2799],
  ],
  Books: [
    ["The Pragmatic Programmer", 3999],
    ["Clean Code", 3499],
    ["Designing Data-Intensive Applications", 4499],
    ["A Brief History of Time", 1799],
    ["Sapiens", 1999],
    ["The Hobbit", 1299],
    ["Dune", 1499],
    ["Atomic Habits", 1899],
  ],
  "Sports & Outdoors": [
    ["Yoga Mat", 2999],
    ["Insulated Water Bottle", 2499],
    ["Trekking Poles", 5499],
    ["Camping Hammock", 3999],
    ["Resistance Bands Set", 1999],
    ["Running Cap", 1799],
    ["Dry Bag 20L", 2699],
    ["Jump Rope", 1299],
  ],
};

export const CATEGORIES = Object.keys(RAW);

let n = 0;
export const PRODUCTS: Product[] = Object.entries(RAW).flatMap(([category, items]) =>
  items.map(([name, priceCents]) => {
    n += 1;
    const id = `p${String(n).padStart(3, "0")}`;
    return {
      id,
      name,
      category,
      priceCents,
      description: `${name} from our ${category} range. A solid pick for everyday use.`,
      imageUrl: `/products/${id}.jpg`,
    };
  }),
);

export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);

export const listProducts = (category?: string | null) =>
  category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;

export { formatMoney } from "./money";
