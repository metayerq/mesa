import { NextResponse } from "next/server";

// Met à jour un produit Vendus existant (PATCH partiel) :
// gross_price (string), title, supply_price — comme l'app de référence.
export const runtime = "nodejs";
export const maxDuration = 15;

const BASE = process.env.VENDUS_API_BASE || "https://www.vendus.pt/ws/v1.1";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = String(body.apiKey ?? "").trim();
  const productId = Number(body.productId);
  if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });
  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (body.grossPrice != null && Number.isFinite(Number(body.grossPrice))) {
    payload.gross_price = Number(body.grossPrice).toFixed(2);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    payload.title = body.title.trim();
  }
  if (body.supplyPrice != null && Number.isFinite(Number(body.supplyPrice))) {
    payload.supply_price = Math.round(Number(body.supplyPrice) * 10000) / 10000;
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/products/${productId}/`, {
      method: "PATCH",
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
      return NextResponse.json({ error: `Vendus rejected the update: ${text}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, updated: payload });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Vendus right now." }, { status: 502 });
  }
}
