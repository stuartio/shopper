// One-off helper: downloads a real photo per product from Wikimedia Commons into public/products/.
// Usage: node scripts/fetch-images.mjs [productId ...]   (no args = all products)
// Images are committed, so this only needs re-running if you change the catalog.
import fs from "node:fs";
import path from "node:path";

// Search queries per product id, tried in order. Order must match lib/catalog.ts.
const QUERIES = {
  p001: ["wireless headphones", "headphones"],
  p002: ["bluetooth speaker", "portable speaker"],
  p003: ["smartwatch", "smart watch"],
  p004: ["USB-C charger", "usb charger"],
  p005: ["mechanical keyboard", "computer keyboard"],
  p006: ["webcam", "web camera"],
  p007: ["power bank", "portable battery charger"],
  p008: ["wireless earbuds", "earbuds"],
  p009: ["blank white t-shirt", "t-shirt"],
  p010: ["denim jacket", "jean jacket"],
  p011: ["running shorts", "sports shorts"],
  p012: ["wool beanie", "knit hat beanie"],
  p013: ["hoodie sweatshirt", "hoodie"],
  p014: ["leather belt", "belt buckle"],
  p015: ["rain jacket", "waterproof jacket"],
  p016: ["wool socks", "socks"],
  p017: ["ceramic mug", "coffee mugs"],
  p018: ["chef's knife", "kitchen knife"],
  p019: ["cast iron skillet", "cast iron pan"],
  p020: ["french press", "coffee press"],
  p021: ["bamboo cutting board", "cutting board"],
  p022: ["scented candle", "candle"],
  p023: ["plaid blanket", "wool blanket", "knitted blanket"],
  p024: ["glass storage jars", "mason jars"],
  p025: ["programming books", "computer science books"],
  p026: ["programming book cover", "computer books shelf"],
  p027: ["technical books stack", "books stack"],
  p028: ["Stephen Hawking book", "physics book"],
  p029: ["hardcover books", "old books"],
  p030: ["Tolkien Hobbit book", "fantasy novel book"],
  p031: ["science fiction paperback", "paperback book"],
  p032: ["open book", "reading book"],
  p033: ["yoga mat", "yoga mat rolled"],
  p034: ["insulated water bottle", "stainless steel water bottle"],
  p035: ["trekking poles", "hiking poles"],
  p036: ["camping hammock", "hammock"],
  p037: ["resistance bands", "exercise band"],
  p038: ["baseball cap", "sports cap"],
  p039: ["roll-top dry bag", "kayak dry bag", "waterproof bag"],
  p040: ["jump rope", "speed rope"],
};

// Hand-picked exact Commons files where text search gave poor matches.
const OVERRIDES = {
  p012: "File:Beanie - Knit Cap (51013511676).jpg",
  p023: "File:Grey knitted blanket.jpg",
  p026: "File:Programming language textbooks.jpg",
  p030: "File:The Hobbit - title page of first American print.jpg",
  p031: "File:Jaws 1st edition 1975.jpg",
  p032: "File:A warm and inviting setup features an open book surrounded by scattered pages, a vintage camera, a cup of coffee, and a single rose.jpg",
  p033: "File:Yoga mat.jpg",
  p037: "File:Woman exercising with resistance band in a gym setting.jpg",
  p039: "File:Ortlieb Atrack, OutDoor 2018, Friedrichshafen (1X7A9931) (cropped).jpg",
  p040: "File:Skipping at the beach.jpg",
};

const UA = "shopper-test-app/0.1 (local testing; image fetch script)";
const API = "https://commons.wikimedia.org/w/api.php";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(process.cwd(), "public", "products");
fs.mkdirSync(outDir, { recursive: true });

async function search(q) {
  const url =
    `${API}?action=query&generator=search&gsrnamespace=6&gsrlimit=8&format=json` +
    `&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}` +
    `&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=600`;
  let res;
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status !== 429) break;
    await sleep(5000 * (attempt + 1));
  }
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages
    .map((p) => ({ title: p.title, info: p.imageinfo?.[0] }))
    .filter((x) => x.info?.mime === "image/jpeg" && x.info.width >= 600 && x.info.thumburl)
    .filter((x) => !/faec|feces|faeces|woman|women|girl|boy|kid|child|man |jockstrap|logo|signing|esa/i.test(x.title))
    // title must mention the main noun of the query (last word, crude de-pluralisation)
    .filter((x) => x.title.toLowerCase().includes(q.toLowerCase().split(/\s+/).pop().replace(/s$/, "")));
}

async function download(url, file) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return true;
    }
    if (res.status === 429) await sleep(3000 * (attempt + 1));
    else return false;
  }
  return false;
}

const ids = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(QUERIES);
async function byTitle(title) {
  const url = `${API}?action=query&titles=${encodeURIComponent(title)}&format=json&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=600`;
  const json = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const info = Object.values(json.query.pages)[0]?.imageinfo?.[0];
  return info?.thumburl ? { title, info } : null;
}

for (const id of ids) {
  let done = false;
  if (OVERRIDES[id]) {
    const h = await byTitle(OVERRIDES[id]);
    if (h && (await download(h.info.thumburl, path.join(outDir, `${id}.jpg`)))) {
      console.log(`${id}  (override) -> ${h.title}`);
      await sleep(2500);
      continue;
    }
  }
  for (const q of QUERIES[id]) {
    const hits = await search(q);
    for (const h of hits.slice(0, 3)) {
      if (await download(h.info.thumburl, path.join(outDir, `${id}.jpg`))) {
        console.log(`${id}  "${q}" -> ${h.title}`);
        done = true;
        break;
      }
    }
    if (done) break;
    await sleep(2000);
  }
  if (!done) console.log(`${id}  FAILED`);
  await sleep(2500);
}
