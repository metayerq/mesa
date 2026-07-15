import { NextResponse } from "next/server";
import {
  getDocumentsWithItems,
  getCatalog,
  productAggregates,
  topMovers,
  transactionsWithItems,
  VendusAuthError,
} from "@/lib/vendus";

// Bloc B : lignes produits (un appel par ticket) → runtime Node, budget large.
export const runtime = "nodejs";
export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function daysBetween(since: string, until: string): number {
  return (
    Math.round(
      (new Date(until + "T00:00:00").getTime() - new Date(since + "T00:00:00").getTime()) /
        86_400_000
    ) + 1
  );
}

export async function POST(req: Request) {
  let apiKey = "";
  let since = "";
  let until = "";
  try {
    const body = await req.json();
    apiKey = String(body?.apiKey ?? "").trim();
    if (DATE_RE.test(String(body?.since ?? "")) && DATE_RE.test(String(body?.until ?? ""))) {
      since = String(body.since);
      until = String(body.until);
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 400 });
  }

  if (!since || !until || since > until) {
    const u = new Date();
    const s = new Date();
    s.setDate(s.getDate() - 29);
    since = ymd(s);
    until = ymd(u);
  }
  const days = daysBetween(since, until);
  if (days > 366) {
    return NextResponse.json({ error: "Period too long (max 12 months)" }, { status: 400 });
  }

  try {
    const [docs, catalog] = await Promise.all([
      getDocumentsWithItems(apiKey, since, until),
      getCatalog(apiKey),
    ]);
    return NextResponse.json({
      ...productAggregates(docs, catalog),
      transactions: transactionsWithItems(docs, 40),
      // 7 j vs 7 j : n'a de sens que si la période couvre les 14 jours.
      movers: days >= 14 ? topMovers(docs, until) : [],
    });
  } catch (e) {
    if (e instanceof VendusAuthError) {
      return NextResponse.json({ error: "Invalid Vendus API key." }, { status: 401 });
    }
    console.error("Vendus products error:", e);
    return NextResponse.json(
      { error: "Couldn't load product detail right now." },
      { status: 502 }
    );
  }
}
