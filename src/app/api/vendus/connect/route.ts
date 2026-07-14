import { NextResponse } from "next/server";
import {
  getDocuments,
  calcStats,
  hourlyBreakdown,
  paymentBreakdown,
  dailyBreakdown,
  weekdayPattern,
  wowGrowth,
  ticketStats,
  deadHours,
  weekdayHourHeatmap,
  rushWindows,
  cumulativeCurve,
  transactionList,
  VendusAuthError,
} from "@/lib/vendus";

// Buffer (auth Basic) → runtime Node, pas Edge. Import Vendus = quelques appels.
export const runtime = "nodejs";
export const maxDuration = 30;

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

  // Défaut : 30 derniers jours.
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
    const docs = await getDocuments(apiKey, since, until);
    const hourly = hourlyBreakdown(docs);
    return NextResponse.json({
      meta: { since, until, days, key_last4: apiKey.slice(-4) },
      stats: calcStats(docs),
      hourly,
      payments: paymentBreakdown(docs),
      daily: dailyBreakdown(docs),
      weekday: weekdayPattern(docs),
      wow: wowGrowth(docs, until),
      tickets: ticketStats(docs),
      deadHours: deadHours(hourly),
      heatmap: weekdayHourHeatmap(docs),
      peaks: rushWindows(docs),
      curve: days === 1 ? cumulativeCurve(docs) : [],
      transactions: transactionList(docs, 30),
    });
  } catch (e) {
    if (e instanceof VendusAuthError) {
      return NextResponse.json(
        { error: "Invalid Vendus API key. Check it in Vendus → Configurações → Integrações → API." },
        { status: 401 }
      );
    }
    console.error("Vendus connect error:", e);
    return NextResponse.json(
      { error: "Couldn't reach Vendus right now. Please try again." },
      { status: 502 }
    );
  }
}
