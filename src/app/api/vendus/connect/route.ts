import { NextResponse } from "next/server";
import {
  getDocuments,
  calcStats,
  hourlyBreakdown,
  paymentBreakdown,
  dailyBreakdown,
  VendusAuthError,
} from "@/lib/vendus";

// Buffer (auth Basic) → runtime Node, pas Edge. Import Vendus = quelques appels.
export const runtime = "nodejs";
export const maxDuration = 30;

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
    const docs = await getDocuments(apiKey, ymd(since), ymd(until));
    return NextResponse.json({
      meta: {
        since: ymd(since),
        until: ymd(until),
        days,
        key_last4: apiKey.slice(-4),
      },
      stats: calcStats(docs),
      hourly: hourlyBreakdown(docs),
      payments: paymentBreakdown(docs),
      daily: dailyBreakdown(docs),
    });
  } catch (e) {
    if (e instanceof VendusAuthError) {
      return NextResponse.json(
        { error: "Clé API Vendus invalide. Vérifie-la dans Vendus → Configurações → Integrações → API." },
        { status: 401 }
      );
    }
    console.error("Vendus connect error:", e);
    return NextResponse.json(
      { error: "Impossible de contacter Vendus pour le moment. Réessaie." },
      { status: 502 }
    );
  }
}
