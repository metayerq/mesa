"use client";

import { useEffect, useState } from "react";

export type ConnectResult = {
  meta: { since: string; until: string; days: number; key_last4: string };
  stats: { ca: number; ca_ht: number; nb: number; ticket: number; ticket_ht: number };
  hourly: { hour: number; label: string; ca: number; nb: number }[];
  payments: { label: string; amount: number }[];
  daily: { day: string; ca: number; nb: number }[];
  weekday: { weekday: number; day: string; avg_ca: number; n_days: number }[];
  wow: {
    cur_ca: number;
    prev_ca: number;
    cur_nb: number;
    prev_nb: number;
    growth_ca: number | null;
    growth_nb: number | null;
  };
  tickets: { median: number | null; distribution: { label: string; count: number; pct: number }[] };
  deadHours: number[];
  heatmap: {
    hours: number[];
    rows: { day: string; cells: number[] }[];
    max: number;
    busiestHours: number[];
    busiestShare: number;
  };
  peaks: { label: string; tx: number }[];
  curve: { time: string; ca_cum: number }[];
  transactions: {
    date: string;
    time: string;
    number: string;
    type: string;
    amount: number;
    payment: string;
    refund: boolean;
  }[];
};

type TxWithItems = {
  date: string;
  time: string;
  number: string;
  type: string;
  amount: number;
  payment: string;
  refund: boolean;
  items: { name: string; qty: number; amount: number }[];
};

type ProductData = {
  productsSold: { name: string; category: string; units: number; revenue: number; unitPrice: number; marginPct: number | null }[];
  categoryMix: { label: string; amount: number; pct: number; marginPct: number | null; marginEur: number | null; coverage: number | null }[];
  tickets: { total: number; multi: number; single: number; attach_rate: number; items_per_ticket: number };
  movers: { name: string; cur: number; prev: number; status: "new" | "dropped" | "changed"; pct: number | null }[];
  transactions: TxWithItems[];
};

type PeriodKey = "today" | "yesterday" | "week" | "lastweek" | "month" | "30d";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "lastweek", label: "Last week" },
  { key: "month", label: "This month" },
  { key: "30d", label: "Last 30 days" },
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function rangeFor(key: PeriodKey): { since: string; until: string } {
  const now = new Date();
  const today = ymd(now);
  switch (key) {
    case "today":
      return { since: today, until: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { since: ymd(y), until: ymd(y) };
    }
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lundi
      return { since: ymd(d), until: today };
    }
    case "lastweek": {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return { since: ymd(d), until: ymd(end) };
    }
    case "month": {
      return { since: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), until: today };
    }
    case "30d":
    default: {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { since: ymd(d), until: today };
    }
  }
}

const eur = (n: number, compact = false) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
};

const mono: React.CSSProperties = { fontFamily: "var(--mono)" };

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="label-mono" style={{ marginBottom: 16 }}>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div style={card}>
      <div className="label-mono" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...mono, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1 }}>
          {value}
        </span>
        {badge}
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function BarRow({
  label,
  value,
  pct,
  strong,
}: {
  label: string;
  value: string;
  pct: number;
  strong?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
        <span style={{ fontWeight: strong ? 600 : 400 }}>{label}</span>
        <span style={mono}>{value}</span>
      </div>
      <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
        <div
          style={{
            width: `${Math.max(2, pct)}%`,
            height: "100%",
            background: "var(--accent)",
            borderRadius: 3,
            opacity: strong ? 1 : 0.55,
            transition: "width .5s ease",
          }}
        />
      </div>
    </div>
  );
}

function DeltaBadge({ pct, suffix }: { pct: number | null; suffix?: string }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      style={{
        ...mono,
        fontSize: 12,
        fontWeight: 600,
        color: up ? "var(--green)" : "var(--red)",
        background: up ? "rgba(68,131,97,0.1)" : "rgba(196,85,77,0.1)",
        padding: "3px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
      }}
    >
      {up ? "▲ +" : "▼ "}
      {pct}%{suffix ? ` · ${suffix}` : ""}
    </span>
  );
}

const pctDelta = (cur: number, prev: number): number | null =>
  prev ? Math.round(((cur - prev) / prev) * 100) : null;

export default function Dashboard({
  result,
  apiKey,
  onReset,
}: {
  result: ConnectResult;
  apiKey: string;
  onReset: () => void;
}) {
  const [data, setData] = useState<ConnectResult>(result);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  async function selectPeriod(key: PeriodKey) {
    if (key === period || switching) return;
    setSwitching(true);
    setSwitchError("");
    try {
      const res = await fetch("/api/vendus/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, ...rangeFor(key) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSwitchError(json?.error ?? "Couldn't load this period.");
        return;
      }
      setData(json as ConnectResult);
      setPeriod(key);
    } catch {
      setSwitchError("Couldn't load this period. Check your connection.");
    } finally {
      setSwitching(false);
    }
  }

  const { stats, hourly, payments, daily, meta, weekday, wow, tickets, deadHours, heatmap, peaks, curve, transactions } = data;

  // Product intelligence — reloaded whenever the period changes.
  const [products, setProducts] = useState<ProductData | null>(null);
  const [prodStatus, setProdStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setProdStatus("loading");
    setProducts(null);
    (async () => {
      try {
        const res = await fetch("/api/vendus/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, since: meta.since, until: meta.until }),
        });
        if (!alive) return;
        if (!res.ok) {
          setProdStatus("error");
          return;
        }
        setProducts((await res.json()) as ProductData);
        setProdStatus("done");
      } catch {
        if (alive) setProdStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [apiKey, meta.since, meta.until]);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Custom";
  const singleDay = meta.days === 1;

  const bestDay = daily.reduce((b, d) => (d.ca > b.ca ? d : b), { day: "—", ca: 0, nb: 0 });
  const peakHour = hourly.reduce((b, h) => (h.ca > b.ca ? h : b), { hour: 0, label: "—", ca: 0, nb: 0 });
  const maxHour = Math.max(1, ...hourly.map((h) => h.ca));
  const maxDay = Math.max(1, ...daily.map((d) => d.ca));
  const payTotal = payments.reduce((s, p) => s + p.amount, 0) || 1;
  const maxWeekday = Math.max(1, ...weekday.map((w) => w.avg_ca));
  const maxDist = Math.max(1, ...tickets.distribution.map((d) => d.count));

  const todayEntry = daily.find((d) => d.day === meta.until);
  const prevOpen = [...daily].filter((d) => d.day < meta.until && d.ca > 0).pop();
  const showTodayStrip = !singleDay && !!todayEntry;

  const dayLabel = (iso: string) =>
    iso === "—"
      ? "—"
      : new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

  const deadSet = new Set(deadHours);

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "28px 20px 64px",
        opacity: switching ? 0.55 : 1,
        pointerEvents: switching ? "none" : "auto",
        transition: "opacity .2s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div className="label-mono">◳ Mesa · live</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 650, margin: 0 }}>
              Your activity — {periodLabel.toLowerCase()}
            </h1>
            {!singleDay && <DeltaBadge pct={wow.growth_ca} suffix="7d" />}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>
          <div className="label-mono">Vendus ····{meta.key_last4}</div>
          <div style={{ marginTop: 4 }}>
            {meta.since === meta.until ? meta.since : `${meta.since} → ${meta.until}`}
          </div>
          <button
            onClick={onReset}
            style={{ marginTop: 6, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0 }}
          >
            Change key
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              onClick={() => selectPeriod(p.key)}
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                padding: "7px 14px",
                borderRadius: 20,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent)" : "var(--bg-card)",
                color: active ? "#fff" : "var(--muted)",
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          );
        })}
        {switching && (
          <span className="label-mono" style={{ alignSelf: "center" }}>
            Loading…
          </span>
        )}
      </div>
      {switchError && (
        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{switchError}</div>
      )}
      <div style={{ marginBottom: 24 }} />

      {/* Today strip (multi-day periods that include today) */}
      {showTodayStrip && todayEntry && (
        <>
          <div className="label-mono" style={{ marginBottom: 10 }}>
            — Today
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatTile
              label="Revenue today"
              value={eur(todayEntry.ca, true)}
              badge={prevOpen && <DeltaBadge pct={pctDelta(todayEntry.ca, prevOpen.ca)} />}
              sub={prevOpen ? `vs ${dayLabel(prevOpen.day)} · ${eur(prevOpen.ca, true)}` : undefined}
            />
            <StatTile
              label="Transactions"
              value={todayEntry.nb.toLocaleString("en-GB")}
              badge={prevOpen && <DeltaBadge pct={pctDelta(todayEntry.nb, prevOpen.nb)} />}
              sub={prevOpen ? `vs ${dayLabel(prevOpen.day)} · ${prevOpen.nb}` : undefined}
            />
            <StatTile
              label="Average ticket"
              value={todayEntry.nb ? eur(todayEntry.ca / todayEntry.nb) : "—"}
              badge={
                prevOpen && todayEntry.nb && prevOpen.nb ? (
                  <DeltaBadge pct={pctDelta(todayEntry.ca / todayEntry.nb, prevOpen.ca / prevOpen.nb)} />
                ) : undefined
              }
              sub={
                prevOpen && prevOpen.nb
                  ? `vs ${dayLabel(prevOpen.day)} · ${eur(prevOpen.ca / prevOpen.nb)}`
                  : undefined
              }
            />
          </div>
          <div className="label-mono" style={{ marginBottom: 10 }}>
            — {periodLabel}
          </div>
        </>
      )}

      {/* Period stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatTile label="Revenue (incl. VAT)" value={eur(stats.ca, true)} sub={`${eur(stats.ca_ht, true)} excl. VAT`} />
        <StatTile label="Transactions" value={stats.nb.toLocaleString("en-GB")} sub="tickets (refunds deducted)" />
        <StatTile
          label="Average ticket"
          value={eur(stats.ticket)}
          sub={tickets.median != null ? `median ${eur(tickets.median)}` : `${eur(stats.ticket_ht)} excl. VAT`}
        />
        {singleDay ? (
          <StatTile label="Peak hour" value={peakHour.label} sub={`${eur(peakHour.ca, true)} in that hour`} />
        ) : (
          <StatTile label="Best day" value={eur(bestDay.ca, true)} sub={dayLabel(bestDay.day)} />
        )}
      </div>

      {/* Activity peaks */}
      {peaks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <span className="label-mono">Activity peaks</span>
          {peaks.map((p) => (
            <span
              key={p.label}
              style={{
                ...mono,
                fontSize: 12.5,
                fontWeight: 600,
                background: "var(--text)",
                color: "var(--bg)",
                padding: "6px 12px",
                borderRadius: 20,
                whiteSpace: "nowrap",
              }}
            >
              ⚡ {p.label} · {p.tx} tx
            </span>
          ))}
        </div>
      )}

      {/* Sales evolution (single day) */}
      {curve.length > 1 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div className="label-mono" style={{ marginBottom: 4 }}>
            Sales evolution — cumulative
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            {curve[0].time} → {curve[curve.length - 1].time} · finished at{" "}
            <b style={{ color: "var(--text)" }}>{eur(curve[curve.length - 1].ca_cum)}</b>
          </div>
          <CumulativeCurve curve={curve} />
        </div>
      )}

      {/* Revenue by hour */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div className="label-mono" style={{ marginBottom: 4 }}>
          Revenue by hour
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Peak at <b style={{ color: "var(--text)" }}>{peakHour.label}</b> · {eur(peakHour.ca, true)}
          {deadHours.length > 0 && (
            <>
              {" · "}dead hours:{" "}
              <b style={{ color: "var(--text)" }}>{deadHours.map((h) => `${h}h`).join(", ")}</b>
            </>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140, minWidth: 520 }}>
            {hourly.map((h) => {
              const isPeak = h.hour === peakHour.hour;
              const isDead = deadSet.has(h.hour);
              return (
                <div
                  key={h.hour}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  title={`${h.label} · ${eur(h.ca)} · ${h.nb} sales`}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.round((h.ca / maxHour) * 118)}px`,
                      minHeight: h.ca > 0 ? 3 : 0,
                      background: isPeak ? "var(--accent)" : "var(--spec-soft)",
                      borderTop: isPeak ? "none" : "2px solid var(--accent)",
                      borderRadius: 3,
                      transition: "height .4s ease",
                    }}
                  />
                  <span style={{ ...mono, fontSize: 10, color: isDead ? "var(--red)" : "var(--faint)" }}>
                    {h.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rush heatmap (multi-day) */}
      {!singleDay && heatmap.rows.length > 1 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div className="label-mono" style={{ marginBottom: 4 }}>
            Rush heatmap — revenue by weekday × hour
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
            <b style={{ color: "var(--text)" }}>{heatmap.busiestShare}%</b> of revenue in your 3
            busiest hours ({heatmap.busiestHours.map((h) => `${h}h`).join(", ")})
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 560 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `44px repeat(${heatmap.hours.length}, 1fr)`,
                  gap: 3,
                  marginBottom: 3,
                }}
              >
                <span />
                {heatmap.hours.map((h) => (
                  <span key={h} style={{ ...mono, fontSize: 10, color: "var(--faint)", textAlign: "center" }}>
                    {h}
                  </span>
                ))}
              </div>
              {heatmap.rows.map((row) => (
                <div
                  key={row.day}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `44px repeat(${heatmap.hours.length}, 1fr)`,
                    gap: 3,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ ...mono, fontSize: 10, color: "var(--faint)", alignSelf: "center" }}>
                    {row.day}
                  </span>
                  {row.cells.map((ca, i) => (
                    <div
                      key={i}
                      title={`${row.day} ${heatmap.hours[i]}h · ${eur(ca)}`}
                      style={{
                        height: 20,
                        borderRadius: 3,
                        background:
                          ca > 0
                            ? `rgba(37, 84, 199, ${0.08 + (ca / heatmap.max) * 0.85})`
                            : "var(--bg-hover)",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments + revenue by day */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
        <div style={card}>
          <Label>Payment methods</Label>
          {payments.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>No breakdown available.</div>}
          {payments.map((p) => (
            <BarRow key={p.label} label={p.label} value={`${eur(p.amount, true)} · ${Math.round((p.amount / payTotal) * 100)}%`} pct={(p.amount / payTotal) * 100} strong />
          ))}
        </div>

        {!singleDay && (
          <div style={card}>
            <Label>Revenue by day</Label>
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, minWidth: Math.max(240, daily.length * 14) }}>
                {daily.map((d) => (
                  <div
                    key={d.day}
                    title={`${dayLabel(d.day)} · ${eur(d.ca)} · ${d.nb} sales`}
                    style={{
                      flex: 1,
                      minWidth: 6,
                      height: `${Math.round((d.ca / maxDay) * 118)}px`,
                      minHeight: d.ca > 0 ? 2 : 0,
                      background: d.day === bestDay.day ? "var(--accent)" : "var(--spec-soft)",
                      borderTop: d.day === bestDay.day ? "none" : "2px solid var(--accent)",
                      borderRadius: 2,
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              {daily.length} days · total {eur(stats.ca, true)}
            </div>
          </div>
        )}
      </div>

      {/* Weekday pattern + ticket distribution (multi-day) */}
      {!singleDay && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 20 }}>
          <div style={card}>
            <Label>Avg revenue by weekday</Label>
            {weekday.map((w, i) => (
              <BarRow
                key={w.weekday}
                label={w.day}
                value={eur(w.avg_ca, true)}
                pct={(w.avg_ca / maxWeekday) * 100}
                strong={i === 0}
              />
            ))}
          </div>

          <div style={card}>
            <Label>Ticket distribution</Label>
            {tickets.median != null && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
                Median ticket <b style={{ color: "var(--text)" }}>{eur(tickets.median)}</b> — robust to outliers
              </div>
            )}
            {tickets.distribution.map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ ...mono, fontSize: 12, width: 56, color: "var(--muted)" }}>{d.label}</span>
                <div style={{ flex: 1, height: 20, background: "var(--bg-hover)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(d.count / maxDist) * 100}%`, height: "100%", background: "var(--spec-soft)", borderRight: "2px solid var(--accent)" }} />
                </div>
                <span style={{ ...mono, fontSize: 12, width: 44, textAlign: "right" }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product intelligence (deferred) */}
      <ProductSection status={prodStatus} products={products} totalCa={stats.ca} />

      {/* Transactions (line items on hover once loaded) */}
      <TransactionsTable
        rows={
          products?.transactions ??
          transactions.map((t) => ({ ...t, items: [] as TxWithItems["items"] }))
        }
        singleDay={singleDay}
      />
    </main>
  );
}

function CumulativeCurve({ curve }: { curve: { time: string; ca_cum: number }[] }) {
  const W = 640;
  const H = 150;
  const PAD = 8;
  const max = curve[curve.length - 1].ca_cum || 1;
  const x = (i: number) => PAD + (i / (curve.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const points = curve.map((p, i) => `${x(i)},${y(p.ca_cum)}`).join(" ");
  const area = `${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 420, display: "block" }}>
        <polygon points={area} fill="rgba(37,84,199,0.08)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(curve.length - 1)} cy={y(max)} r="3.5" fill="var(--accent)" />
      </svg>
    </div>
  );
}

function ProductSection({
  status,
  products,
  totalCa,
}: {
  status: "loading" | "done" | "error";
  products: ProductData | null;
  totalCa: number;
}) {
  if (status === "loading") {
    return (
      <div style={{ ...card, textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 28 }}>
        <span className="label-mono">Analyzing products…</span>
        <div style={{ marginTop: 6 }}>Reading every ticket&apos;s line items (a few seconds)</div>
      </div>
    );
  }
  if (status === "error" || !products) {
    return (
      <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>
        Product detail unavailable right now.
      </div>
    );
  }

  const { productsSold, categoryMix, tickets, movers } = products;
  const maxCat = Math.max(1, ...categoryMix.map((c) => c.amount));
  const topRevenue = [...productsSold].sort((a, b) => b.revenue - a.revenue);
  const top8Share = Math.round(
    (topRevenue.slice(0, 8).reduce((s, p) => s + p.revenue, 0) / (totalCa || 1)) * 100
  );
  const hasMargins = productsSold.some((p) => p.marginPct != null);

  return (
    <>
      {/* Product mix (with margin) */}
      <div style={{ ...card, marginBottom: 20 }}>
        <Label>Product mix</Label>
        {categoryMix.map((c) => (
          <div key={c.label} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 13, marginBottom: 5 }}>
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span style={{ ...mono, color: "var(--muted)", whiteSpace: "nowrap" }}>
                {c.pct}% · {eur(c.amount, true)} incl. VAT
              </span>
            </div>
            <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
              <div style={{ width: `${(c.amount / maxCat) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 3 }} />
            </div>
            {c.marginPct != null ? (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                margin <b style={{ color: foodMarginColor(c.marginPct) }}>{c.marginPct}%</b>
                {c.marginEur != null && ` · ${eur(c.marginEur)}`}
                {c.coverage != null && c.coverage < 100 && ` · ${c.coverage}% costed`}
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 4 }}>
                no recipe cost yet
              </div>
            )}
          </div>
        ))}
        {!hasMargins && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
            Margin per category and per product will show automatically once product costs are set.
          </div>
        )}
      </div>

      {/* Products sold */}
      <div style={{ ...card, marginBottom: 20 }}>
        <Label>Products sold · {productsSold.length}</Label>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  { h: "Product", a: "left" },
                  { h: "Qty", a: "right" },
                  { h: "Unit price", a: "right" },
                  { h: "Revenue", a: "right" },
                  { h: "Margin", a: "right" },
                ].map(({ h, a }) => (
                  <th
                    key={h}
                    className="label-mono"
                    style={{
                      textAlign: a as "left" | "right",
                      padding: "0 8px 10px 0",
                      position: "sticky",
                      top: 0,
                      background: "var(--bg-card)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productsSold.map((p) => (
                <tr key={p.name} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 8px 9px 0", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                    {p.name}
                  </td>
                  <td style={{ ...mono, padding: "9px 8px 9px 0", textAlign: "right" }}>{Math.round(p.units)}</td>
                  <td style={{ ...mono, padding: "9px 8px 9px 0", textAlign: "right", color: "var(--muted)" }}>{eur(p.unitPrice)}</td>
                  <td style={{ ...mono, padding: "9px 8px 9px 0", textAlign: "right" }}>{eur(p.revenue)}</td>
                  <td style={{ ...mono, padding: "9px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                    {p.marginPct != null ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                        <span style={{ width: 40, height: 5, background: "var(--bg-hover)", borderRadius: 3, overflow: "hidden" }}>
                          <span style={{ display: "block", width: `${Math.max(0, Math.min(100, p.marginPct))}%`, height: "100%", background: foodMarginColor(p.marginPct) }} />
                        </span>
                        <span style={{ color: foodMarginColor(p.marginPct), width: 44, textAlign: "right" }}>{p.marginPct}%</span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--faint)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top movers 7d vs 7d */}
      {movers.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <Label>Top movers — last 7 days vs previous 7</Label>
          {movers.map((m) => (
            <div key={m.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 10, gap: 8 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
              <span style={{ ...mono, whiteSpace: "nowrap", fontSize: 12.5 }}>
                {m.status === "new" && <span style={{ color: "var(--green)", fontWeight: 600 }}>new</span>}
                {m.status === "dropped" && <span style={{ color: "var(--red)", fontWeight: 600 }}>▼ −100%</span>}
                {m.status === "changed" && m.pct != null && (
                  <span style={{ color: m.pct >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {m.pct >= 0 ? "▲ +" : "▼ "}
                    {m.pct}%
                  </span>
                )}
                <span style={{ color: "var(--muted)" }}> · {eur(m.cur)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Basket / attach */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatTile label="Items / ticket" value={tickets.items_per_ticket.toLocaleString("en-GB")} sub={`${tickets.total.toLocaleString("en-GB")} tickets`} />
        <StatTile label="Attach rate" value={`${tickets.attach_rate}%`} sub={`${tickets.multi.toLocaleString("en-GB")} tickets with 2+ items`} />
        <StatTile label="Top 8 share of revenue" value={`${top8Share}%`} sub="sales concentration" />
      </div>
    </>
  );
}

function foodMarginColor(pct: number): string {
  if (pct >= 70) return "var(--green)";
  if (pct >= 60) return "var(--amber)";
  return "var(--red)";
}

function TransactionsTable({ rows, singleDay }: { rows: TxWithItems[]; singleDay: boolean }) {
  const [hover, setHover] = useState<{ i: number; top: number; left: number } | null>(null);
  if (rows.length === 0) return null;
  const active = hover != null ? rows[hover.i] : null;

  return (
    <div style={{ ...card, marginTop: 20 }}>
      <Label>
        {singleDay ? "Transactions" : "Latest transactions"} · {rows.length}
      </Label>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Time", "Document", "Type", "Payment", "Amount"].map((h) => (
                <th
                  key={h}
                  className="label-mono"
                  style={{
                    textAlign: h === "Amount" ? "right" : "left",
                    padding: "0 8px 10px 0",
                    position: "sticky",
                    top: 0,
                    background: "var(--bg-card)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr
                key={`${t.number}-${t.date}-${t.time}`}
                style={{ borderTop: "1px solid var(--border)", cursor: t.items.length ? "help" : "default", background: hover?.i === i ? "var(--bg-hover)" : undefined }}
                onMouseEnter={(e) => {
                  if (!t.items.length) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({ i, top: r.top, left: r.left });
                }}
                onMouseLeave={() => setHover(null)}
              >
                <td style={{ ...mono, padding: "9px 8px 9px 0", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {singleDay ? t.time : `${t.date.slice(5)} ${t.time}`}
                </td>
                <td style={{ padding: "9px 8px 9px 0", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{t.number}</td>
                <td style={{ padding: "9px 8px 9px 0" }}>
                  <span style={{ ...mono, fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", color: t.refund ? "var(--red)" : "var(--muted)" }}>
                    {t.type}
                  </span>
                </td>
                <td style={{ padding: "9px 8px 9px 0", color: "var(--muted)", whiteSpace: "nowrap" }}>{t.payment}</td>
                <td style={{ ...mono, padding: "9px 0", textAlign: "right", color: t.refund ? "var(--red)" : "var(--text)", whiteSpace: "nowrap" }}>
                  {eur(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active && active.items.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: Math.min(hover!.top, (typeof window !== "undefined" ? window.innerHeight : 800) - 40 - active.items.length * 22),
            left: Math.min(hover!.left + 12, (typeof window !== "undefined" ? window.innerWidth : 900) - 250),
            width: 230,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(38,36,30,0.18)",
            padding: 12,
            zIndex: 40,
            pointerEvents: "none",
          }}
        >
          <div className="label-mono" style={{ marginBottom: 8 }}>
            {active.number} · {active.time}
          </div>
          {active.items.map((it, k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.qty > 1 && <span style={{ ...mono, color: "var(--muted)" }}>{Math.round(it.qty)}× </span>}
                {it.name}
              </span>
              <span style={{ ...mono, whiteSpace: "nowrap" }}>{eur(it.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontWeight: 600 }}>
            <span>Total</span>
            <span style={mono}>{eur(active.amount)}</span>
          </div>
          {active.payment && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>{active.payment}</div>}
        </div>
      )}
    </div>
  );
}
