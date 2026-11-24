import { getProduct } from "@/lib/catalog";

const COLORS: Record<string, string> = {
  Electronics: "#3b82f6",
  Clothing: "#ec4899",
  "Home & Kitchen": "#f59e0b",
  Books: "#10b981",
  "Sports & Outdoors": "#8b5cf6",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Generates a deterministic placeholder image per product, so no external image hosting is needed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = getProduct((await params).id);
  if (!p) return new Response("Not found", { status: 404 });
  const color = COLORS[p.category] ?? "#64748b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
<rect width="600" height="400" fill="${color}"/>
<rect x="20" y="20" width="560" height="360" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" rx="16"/>
<text x="300" y="190" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">${esc(p.name)}</text>
<text x="300" y="235" font-family="Arial,sans-serif" font-size="22" fill="#fff" fill-opacity=".85" text-anchor="middle">${esc(p.category)}</text>
</svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
