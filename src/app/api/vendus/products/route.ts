import { NextResponse } from "next/server";
import {
  getDocumentsWithItems,
  getCatalog,
  productAggregates,
  VendusAuthError,
} from "@/lib/vendus";

// Bloc B : lignes produits (un appel par ticket) → runtime Node, budget large.
export const runtime = "nodejs";
export const maxDuration = 60;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  let apiKey = "";
  let days = 30;
  try {
    const body = await req.json();
    apiKey = String(body?.apiKey ?? "").trim();
    if (body?.days) days = Math.min(90, Math.max(1, Number(body.days) || 30));
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API manquante" }, { status: 400 });
  }

  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));

  try {
    const [docs, catalog] = await Promise.all([
      getDocumentsWithItems(apiKey, ymd(since), ymd(until)),
      getCatalog(apiKey),
    ]);
    return NextResponse.json(productAggregates(docs, catalog));
  } catch (e) {
    if (e instanceof VendusAuthError) {
      return NextResponse.json({ error: "Clé API Vendus invalide." }, { status: 401 });
    }
    console.error("Vendus products error:", e);
    return NextResponse.json(
      { error: "Impossible de charger les produits pour le moment." },
      { status: 502 }
    );
  }
}
