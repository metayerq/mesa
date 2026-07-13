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
  amount_gross?: number | string; // TTC
  amount_net?: number | string; // HT
  local_time?: string; // "YYYY-MM-DD HH:MM:SS"
  payments?: VendusPayment[];
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
