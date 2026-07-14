import { NextResponse } from "next/server";

// Crée un produit dans Vendus (payload validé par l'app de référence :
// title + prices[{gross_price}] + tax_id + supply_price + category_id?).
// unit_id volontairement omis : l'ID "Uni" est propre à chaque compte Vendus.
export const runtime = "nodejs";
export const maxDuration = 15;

const BASE = process.env.VENDUS_API_BASE || "https://www.vendus.pt/ws/v1.1";
const TAX_IDS = new Set(["NOR", "INT", "RED", "ISE"]);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = String(body.apiKey ?? "").trim();
  const title = String(body.title ?? "").trim();
  const grossPrice = Number(body.grossPrice);
  const taxId = String(body.taxId ?? "INT");
  const supplyPrice = Number(body.supplyPrice ?? 0);
  const categoryId = body.categoryId ? Number(body.categoryId) : null;

  if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });
  if (!title || !Number.isFinite(grossPrice) || grossPrice <= 0) {
    return NextResponse.json({ error: "Title and a positive price are required" }, { status: 400 });
  }
  if (!TAX_IDS.has(taxId)) {
    return NextResponse.json({ error: "Invalid tax id" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    title,
    prices: [{ gross_price: grossPrice.toFixed(2) }],
    tax_id: taxId,
    supply_price: Math.round(supplyPrice * 10000) / 10000,
  };
  if (categoryId && Number.isFinite(categoryId)) payload.category_id = categoryId;

  try {
    const res = await fetch(`${BASE}/products/`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${apiKey}:`).toString("base64"),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: "Invalid Vendus API key." }, { status: 401 });
    }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return NextResponse.json({ error: `Vendus rejected the product: ${text}` }, { status: 502 });
    }
    const json = (await res.json()) as { id?: number };
    return NextResponse.json({ ok: true, productId: json.id ?? null });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Vendus right now." }, { status: 502 });
  }
}
