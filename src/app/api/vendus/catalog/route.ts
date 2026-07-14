import { NextResponse } from "next/server";
import { getCatalog, VendusAuthError } from "@/lib/vendus";

// Catalogue produits Vendus (lecture seule) — alimente l'import de menu du COGS.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let apiKey = "";
  try {
    const body = await req.json();
    apiKey = String(body?.apiKey ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });

  try {
    const products = await getCatalog(apiKey);
    products.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return NextResponse.json({ products });
  } catch (e) {
    if (e instanceof VendusAuthError) {
      return NextResponse.json({ error: "Invalid Vendus API key." }, { status: 401 });
    }
    console.error("Vendus catalog error:", e);
    return NextResponse.json({ error: "Couldn't load your Vendus catalog." }, { status: 502 });
  }
}
