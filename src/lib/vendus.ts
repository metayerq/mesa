// Client Vendus + calculs KPI — port TS de reference/vendus.py.
// Utilisé côté serveur uniquement (la clé API ne doit jamais atteindre le client).

const BASE_URL = process.env.VENDUS_API_BASE || "https://www.vendus.pt/ws/v1.1";

const SALE_TYPES = new Set(["FT", "FS", "FR", "FG"]);
const REFUND_TYPES = new Set(["NC"]); // notas de crédito — soustraites du CA

export class VendusAuthError extends Error {
  constructor() {
    super("Clé API Vendus invalide ou non autorisée");
    this.name = "VendusAuthError";
  }
}

export type VendusPayment = { title?: string; amount?: number | string };
export type VendusDoc = {
  id?: number;
  type?: string;
  number?: string; // ex. "FS 01P2026/475"
  amount_gross?: number | string; // TTC
  amount_net?: number | string; // HT
  local_time?: string; // "YYYY-MM-DD HH:MM:SS"
  payments?: VendusPayment[];
  items?: VendusItem[];
  _refund?: boolean;
};

function authHeader(apiKey: string): string {
  // Vendus : HTTP Basic, username = clé API, mot de passe vide.
  return "Basic " + Buffer.from(`${apiKey}:`).toString("base64");
}

async function vendusGet(
  apiKey: string,
  endpoint: string,
  params?: Record<string, string | number>
): Promise<unknown> {
  const url = new URL(BASE_URL + endpoint);
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: authHeader(apiKey), Accept: "application/json" },
    // Pas de cache : données live.
    cache: "no-store",
  });
  if (res.status === 404) return [];
  if (res.status === 401 || res.status === 403) throw new VendusAuthError();
  if (!res.ok) throw new Error(`Vendus API error ${res.status}`);
  return res.json();
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Négative montants/paiements d'une nota de crédito → soustraction naturelle du CA. */
function negateRefund(d: VendusDoc): VendusDoc {
  d._refund = true;
  for (const k of ["amount_gross", "amount_net"] as const) {
    if (d[k] != null) d[k] = -Math.abs(num(d[k]));
  }
  for (const p of d.payments ?? []) {
    if (p.amount != null) p.amount = -Math.abs(num(p.amount));
  }
  return d;
}

/** Récupère ventes + avoirs (NC négatifs) de la période, pagination complète. */
export async function getDocuments(
  apiKey: string,
  since: string,
  until: string,
  detailed = true
): Promise<VendusDoc[]> {
  const PER_PAGE = 200;
  const MAX_PAGES = 60; // garde-fou
  const raw: VendusDoc[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params: Record<string, string | number> = {
      since,
      until,
      per_page: PER_PAGE,
      page,
    };
    if (detailed) params.view = "detailed";
    const batch = await vendusGet(apiKey, "/documents/", params);
    const list: VendusDoc[] = Array.isArray(batch)
      ? (batch as VendusDoc[])
      : (((batch as Record<string, unknown>)?.docs as VendusDoc[]) ??
        ((batch as Record<string, unknown>)?.data as VendusDoc[]) ??
        []);
    raw.push(...list);
    if (list.length < PER_PAGE) break;
  }

  const out: VendusDoc[] = [];
  for (const d of raw) {
    if (SALE_TYPES.has(d.type ?? "")) out.push(d);
    else if (REFUND_TYPES.has(d.type ?? "")) out.push(negateRefund(d));
  }
  return out;
}

export type VendusStats = {
  ca: number; // CA TTC net
  ca_ht: number; // CA HT net
  nb: number; // nb de ventes (avoirs exclus)
  ticket: number; // panier moyen TTC
  ticket_ht: number;
};

export function calcStats(docs: VendusDoc[]): VendusStats {
  const ca = docs.reduce((s, d) => s + num(d.amount_gross), 0);
  const caHt = docs.reduce((s, d) => s + num(d.amount_net), 0);
  const nb = docs.filter((d) => !d._refund).length;
  return {
    ca: round2(ca),
    ca_ht: round2(caHt),
    nb,
    ticket: nb ? round2(ca / nb) : 0,
    ticket_ht: nb ? round2(caHt / nb) : 0,
  };
}

/** Répartition horaire du CA (7h–22h). */
export function hourlyBreakdown(docs: VendusDoc[]) {
  const byHour = new Map<number, { ca: number; nb: number }>();
  for (const d of docs) {
    let hour = 0;
    const lt = d.local_time ?? "";
    const parsed = parseInt(lt.slice(11, 13), 10);
    if (Number.isFinite(parsed)) hour = parsed;
    const slot = byHour.get(hour) ?? { ca: 0, nb: 0 };
    slot.ca += num(d.amount_gross);
    slot.nb += 1;
    byHour.set(hour, slot);
  }
  const hours: number[] = [];
  for (let h = 7; h <= 22; h++) hours.push(h);
  return hours.map((h) => {
    const slot = byHour.get(h) ?? { ca: 0, nb: 0 };
    return { hour: h, label: `${h}h`, ca: round2(slot.ca), nb: slot.nb };
  });
}

/** Répartition des paiements (nécessite view=detailed). */
export function paymentBreakdown(docs: VendusDoc[]) {
  const byLabel = new Map<string, number>();
  for (const d of docs) {
    for (const p of d.payments ?? []) {
      const label = p.title || "Autre";
      byLabel.set(label, (byLabel.get(label) ?? 0) + num(p.amount));
    }
  }
  return [...byLabel.entries()]
    .map(([label, amount]) => ({ label, amount: round2(amount) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** CA par jour (clé YYYY-MM-DD), trié chronologiquement. */
export function dailyBreakdown(docs: VendusDoc[]) {
  const byDay = new Map<string, { ca: number; nb: number }>();
  for (const d of docs) {
    const day = (d.local_time ?? "").slice(0, 10);
    if (!day) continue;
    const slot = byDay.get(day) ?? { ca: 0, nb: 0 };
    slot.ca += num(d.amount_gross);
    if (!d._refund) slot.nb += 1;
    byDay.set(day, slot);
  }
  return [...byDay.entries()]
    .map(([day, v]) => ({ day, ca: round2(v.ca), nb: v.nb }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Bloc A — intelligence temporelle (dérivée des documents déjà récupérés)
// ───────────────────────────────────────────────────────────────────────────

const WD_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** CA moyen par jour de semaine sur la période (meilleur/pire jour). */
export function weekdayPattern(docs: VendusDoc[]) {
  const byWd = new Map<number, { ca: number; days: Set<string> }>();
  for (const d of docs) {
    const iso = (d.local_time ?? "").slice(0, 10);
    if (!iso) continue;
    const wd = new Date(iso + "T00:00:00").getDay();
    const slot = byWd.get(wd) ?? { ca: 0, days: new Set<string>() };
    slot.ca += num(d.amount_gross);
    slot.days.add(iso);
    byWd.set(wd, slot);
  }
  return [...byWd.entries()]
    .map(([wd, s]) => ({
      weekday: wd,
      day: WD_EN[wd],
      avg_ca: s.days.size ? round2(s.ca / s.days.size) : 0,
      n_days: s.days.size,
    }))
    .sort((a, b) => b.avg_ca - a.avg_ca);
}

/** Croissance des 7 derniers jours vs les 7 précédents. `until` = "YYYY-MM-DD". */
export function wowGrowth(docs: VendusDoc[], until: string) {
  const u = new Date(until + "T00:00:00");
  const dayStr = (offset: number) => {
    const d = new Date(u);
    d.setDate(d.getDate() - offset);
    return ymdLocal(d);
  };
  const sinceCur = dayStr(6);
  const sincePrev = dayStr(13);
  const untilPrev = dayStr(7);

  let curCa = 0,
    prevCa = 0,
    curNb = 0,
    prevNb = 0;
  for (const d of docs) {
    const day = (d.local_time ?? "").slice(0, 10);
    if (!day) continue;
    const ca = num(d.amount_gross);
    if (day >= sinceCur) {
      curCa += ca;
      if (!d._refund) curNb++;
    } else if (day >= sincePrev && day <= untilPrev) {
      prevCa += ca;
      if (!d._refund) prevNb++;
    }
  }
  return {
    cur_ca: round2(curCa),
    prev_ca: round2(prevCa),
    cur_nb: curNb,
    prev_nb: prevNb,
    growth_ca: prevCa ? Math.round(((curCa - prevCa) / prevCa) * 100) : null,
    growth_nb: prevNb ? Math.round(((curNb - prevNb) / prevNb) * 100) : null,
  };
}

/** Ticket médian TTC (robuste) + distribution par tranches. */
export function ticketStats(docs: VendusDoc[]) {
  const amounts = docs
    .filter((d) => !d._refund)
    .map((d) => num(d.amount_gross))
    .sort((a, b) => a - b);
  let median: number | null = null;
  if (amounts.length) {
    const mid = Math.floor(amounts.length / 2);
    median = round2(
      amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2
    );
  }
  const buckets: [string, number, number][] = [
    ["€0–5", 0, 5],
    ["€5–10", 5, 10],
    ["€10–20", 10, 20],
    ["€20+", 20, Infinity],
  ];
  const total = amounts.length || 1;
  const distribution = buckets.map(([label, lo, hi]) => {
    const count = amounts.filter((a) => a >= lo && a < hi).length;
    return { label, count, pct: Math.round((count / total) * 100) };
  });
  return { median, distribution };
}

/** Heatmap CA jour de semaine × heure (lignes Mon→Sun, heures 7–22). */
export function weekdayHourHeatmap(docs: VendusDoc[]) {
  const HOURS: number[] = [];
  for (let h = 7; h <= 22; h++) HOURS.push(h);
  const grid = new Map<number, number[]>();
  const hourTotals = new Map<number, number>();
  for (const d of docs) {
    const lt = d.local_time ?? "";
    const iso = lt.slice(0, 10);
    const hour = parseInt(lt.slice(11, 13), 10);
    if (!iso || !Number.isFinite(hour) || hour < 7 || hour > 22) continue;
    const wd = new Date(iso + "T00:00:00").getDay();
    const row = grid.get(wd) ?? new Array<number>(HOURS.length).fill(0);
    row[hour - 7] += num(d.amount_gross);
    grid.set(wd, row);
    hourTotals.set(hour, (hourTotals.get(hour) ?? 0) + num(d.amount_gross));
  }
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun
  const rows = order
    .filter((wd) => grid.has(wd))
    .map((wd) => ({ day: WD_SHORT[wd], cells: (grid.get(wd) ?? []).map(round2) }));
  const max = Math.max(1, ...rows.flatMap((r) => r.cells));
  const totalAll = [...hourTotals.values()].reduce((s, v) => s + v, 0) || 1;
  const busiest = [...hourTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    hours: HOURS,
    rows,
    max,
    busiestHours: busiest.map(([h]) => h).sort((a, b) => a - b),
    busiestShare: Math.round(
      (busiest.reduce((s, [, v]) => s + v, 0) / totalAll) * 100
    ),
  };
}

/** Heures creuses : dans la plage d'ouverture, les heures à CA ~nul. */
export function deadHours(hourly: { hour: number; ca: number }[]): number[] {
  const active = hourly.filter((h) => h.ca > 0);
  if (active.length < 2) return [];
  const peak = Math.max(...hourly.map((h) => h.ca));
  const first = active[0].hour;
  const last = active[active.length - 1].hour;
  return hourly
    .filter((h) => h.hour > first && h.hour < last && h.ca < peak * 0.05)
    .map((h) => h.hour);
}

/** Dernières transactions, triées de la plus récente à la plus ancienne. */
export function transactionList(docs: VendusDoc[], limit = 30) {
  return [...docs]
    .filter((d) => d.local_time)
    .sort((a, b) => ((b.local_time ?? "") > (a.local_time ?? "") ? 1 : -1))
    .slice(0, limit)
    .map((d) => ({
      date: (d.local_time ?? "").slice(0, 10),
      time: (d.local_time ?? "").slice(11, 16),
      number: d.number ?? String(d.id ?? ""),
      type: d.type ?? "",
      amount: round2(num(d.amount_gross)),
      payment: d.payments?.[0]?.title ?? "",
      refund: !!d._refund,
    }));
}

/** Fenêtres de rush : ≥ threshold tx dans une fenêtre glissante (max 3, sans chevauchement). */
export function rushWindows(docs: VendusDoc[], windowMinutes = 60, threshold = 5) {
  const times = docs
    .filter((d) => !d._refund && d.local_time)
    .map((d) => new Date((d.local_time as string).replace(" ", "T")))
    .filter((t) => !Number.isNaN(t.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const win = windowMinutes * 60 * 1000;
  const candidates: { start: Date; end: Date; n: number }[] = [];
  for (let i = 0; i < times.length; i++) {
    let j = i;
    while (j + 1 < times.length && times[j + 1].getTime() - times[i].getTime() <= win) j++;
    const n = j - i + 1;
    if (n >= threshold) candidates.push({ start: times[i], end: times[j], n });
  }
  candidates.sort((a, b) => b.n - a.n);
  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.length >= 3) break;
    if (picked.every((p) => c.end < p.start || c.start > p.end)) picked.push(c);
  }
  picked.sort((a, b) => a.start.getTime() - b.start.getTime());
  const fmt = (t: Date) =>
    `${String(t.getHours()).padStart(2, "0")}h${String(t.getMinutes()).padStart(2, "0")}`;
  return picked.map((p) => ({ label: `${fmt(p.start)}–${fmt(p.end)}`, tx: p.n }));
}

/** Courbe cumulée intraday (pertinente sur une période d'un seul jour). */
export function cumulativeCurve(docs: VendusDoc[]) {
  const pts = docs
    .filter((d) => d.local_time)
    .map((d) => ({ time: (d.local_time as string).slice(11, 16), ca: num(d.amount_gross) }))
    .sort((a, b) => a.time.localeCompare(b.time));
  let cum = 0;
  return pts.map((p) => ({ time: p.time, ca_cum: round2((cum += p.ca)) }));
}

// ───────────────────────────────────────────────────────────────────────────
// Bloc B — intelligence produit (nécessite les lignes de chaque ticket)
// ───────────────────────────────────────────────────────────────────────────

export type VendusItem = {
  title?: string;
  qty?: number | string;
  amounts?: { net_total?: number | string; gross_total?: number | string };
};

export type CatalogProduct = { id: number; name: string; category: string; price: number };

function asArray(batch: unknown, keys: string[]): unknown[] {
  if (Array.isArray(batch)) return batch;
  const obj = (batch ?? {}) as Record<string, unknown>;
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k] as unknown[];
  return [];
}

/** Catalogue des produits actifs, avec catégorie réelle (résolue dynamiquement). */
export async function getCatalog(apiKey: string): Promise<CatalogProduct[]> {
  const catNames = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const batch = await vendusGet(apiKey, "/products/categories/", { page, per_page: 200 });
    const list = asArray(batch, ["categories", "data", "items"]) as Record<string, unknown>[];
    for (const c of list) {
      if (c.id == null) continue;
      catNames.set(String(c.id), String(c.title ?? c.name ?? c.description ?? c.id));
    }
    if (list.length < 200) break;
  }

  const products: CatalogProduct[] = [];
  for (let page = 1; page <= 40; page++) {
    const batch = await vendusGet(apiKey, "/products/", { page, per_page: 200 });
    const list = asArray(batch, ["products", "data"]) as Record<string, unknown>[];
    for (const p of list) {
      if (p.status !== "on") continue;
      products.push({
        id: Number(p.id),
        name: String(p.title ?? "").trim(),
        category:
          catNames.get(String(p.category_id)) || String(p.class_name ?? "") || "Autre",
        price: num(p.gross_price),
      });
    }
    if (list.length < 200) break;
  }
  return products;
}

async function getDocumentDetail(apiKey: string, id: number): Promise<VendusDoc | null> {
  try {
    return (await vendusGet(apiKey, `/documents/${id}/`)) as VendusDoc;
  } catch {
    return null;
  }
}

/** Documents de vente enrichis de leurs lignes produits (appels parallèles, concurrence limitée). */
export async function getDocumentsWithItems(
  apiKey: string,
  since: string,
  until: string
): Promise<VendusDoc[]> {
  const docs = await getDocuments(apiKey, since, until);
  const CONCURRENCY = 24;
  const enriched: VendusDoc[] = new Array(docs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < docs.length) {
      const idx = cursor++;
      const base = docs[idx];
      let detail = base.id != null ? await getDocumentDetail(apiKey, base.id) : null;
      if (!detail) detail = base;
      if (base._refund && !detail._refund) detail = negateRefund(detail);
      enriched[idx] = detail;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, docs.length || 1) }, worker)
  );
  return enriched.filter(Boolean);
}

export type Mover = {
  name: string;
  cur: number;
  prev: number;
  status: "new" | "dropped" | "changed";
  pct: number | null;
};

/** Top movers : CA par produit, 7 derniers jours vs les 7 précédents (docs avec items). */
export function topMovers(docs: VendusDoc[], until: string): Mover[] {
  const u = new Date(until + "T00:00:00");
  const dstr = (off: number) => {
    const d = new Date(u);
    d.setDate(d.getDate() - off);
    return ymdLocal(d);
  };
  const curSince = dstr(6);
  const prevSince = dstr(13);
  const prevUntil = dstr(7);

  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const d of docs) {
    const day = (d.local_time ?? "").slice(0, 10);
    if (!day || day < prevSince || day > until) continue;
    const target = day >= curSince ? cur : day <= prevUntil ? prev : null;
    if (!target) continue;
    for (const it of d.items ?? []) {
      const name = (it.title ?? "").trim();
      if (!name) continue;
      const rev = num(it.amounts?.gross_total ?? it.amounts?.net_total);
      target.set(name, (target.get(name) ?? 0) + rev);
    }
  }

  const names = new Set([...cur.keys(), ...prev.keys()]);
  return [...names]
    .map((name) => {
      const c = round2(cur.get(name) ?? 0);
      const p = round2(prev.get(name) ?? 0);
      const status: Mover["status"] =
        p === 0 && c > 0 ? "new" : c === 0 && p > 0 ? "dropped" : "changed";
      return { name, cur: c, prev: p, status, pct: p ? Math.round(((c - p) / p) * 100) : null };
    })
    .filter((m) => Math.abs(m.cur - m.prev) >= 1)
    .sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev))
    .slice(0, 6);
}

/** Agrégats produit : top/flop, invendus, mix catégorie, articles par ticket. */
export function productAggregates(docs: VendusDoc[], catalog: CatalogProduct[]) {
  const catByName = new Map(catalog.map((p) => [p.name.toLowerCase(), p]));
  const agg = new Map<string, { name: string; category: string; units: number; revenue: number }>();
  let totalLines = 0;
  let multi = 0;

  for (const d of docs) {
    const items = (d.items ?? []) as VendusItem[];
    if (items.length >= 2) multi++;
    totalLines += items.length;
    for (const it of items) {
      const name = (it.title ?? "").trim();
      if (!name) continue;
      const rev = num(it.amounts?.gross_total ?? it.amounts?.net_total);
      const cat = catByName.get(name.toLowerCase())?.category ?? "Autre";
      const cur = agg.get(name) ?? { name, category: cat, units: 0, revenue: 0 };
      cur.units += num(it.qty);
      cur.revenue += rev;
      agg.set(name, cur);
    }
  }

  const all = [...agg.values()].map((p) => ({
    ...p,
    revenue: round2(p.revenue),
    units: Math.round(p.units * 100) / 100,
  }));

  const topByRevenue = [...all].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const slowMovers = [...all]
    .filter((p) => p.units > 0)
    .sort((a, b) => a.units - b.units)
    .slice(0, 6);

  const byCat = new Map<string, number>();
  for (const p of all) byCat.set(p.category, (byCat.get(p.category) ?? 0) + p.revenue);
  const grand = [...byCat.values()].reduce((s, v) => s + v, 0) || 1;
  const categoryMix = [...byCat.entries()]
    .map(([label, amount]) => ({
      label,
      amount: round2(amount),
      pct: Math.round((amount / grand) * 100),
    }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const total = docs.length || 1;
  const tickets = {
    total: docs.length,
    multi,
    single: docs.length - multi,
    attach_rate: Math.round((multi / total) * 100),
    items_per_ticket: round2(totalLines / total),
  };

  return { topByRevenue, slowMovers, categoryMix, tickets };
}
