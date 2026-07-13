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
};

type ProductData = {
  topByRevenue: { name: string; category: string; units: number; revenue: number }[];
  slowMovers: { name: string; category: string; units: number; revenue: number }[];
  unsold: { name: string; category: string; price: number }[];
  categoryMix: { label: string; amount: number; pct: number }[];
  tickets: { total: number; multi: number; single: number; attach_rate: number; items_per_ticket: number };
};

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

/** Horizontal bar with label + value + %. */
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
  const { stats, hourly, payments, daily, meta, weekday, wow, tickets, deadHours, heatmap } = result;

  // Product intelligence — loaded after first paint.
  const [products, setProducts] = useState<ProductData | null>(null);
  const [prodStatus, setProdStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/vendus/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, days: meta.days }),
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
  }, [apiKey, meta.days]);

  const bestDay = daily.reduce((b, d) => (d.ca > b.ca ? d : b), { day: "—", ca: 0, nb: 0 });
  const peakHour = hourly.reduce((b, h) => (h.ca > b.ca ? h : b), { hour: 0, label: "—", ca: 0, nb: 0 });
  const maxHour = Math.max(1, ...hourly.map((h) => h.ca));
  const maxDay = Math.max(1, ...daily.map((d) => d.ca));
  const payTotal = payments.reduce((s, p) => s + p.amount, 0) || 1;
  const maxWeekday = Math.max(1, ...weekday.map((w) => w.avg_ca));
  const maxDist = Math.max(1, ...tickets.distribution.map((d) => d.count));

  // Today vs previous open day — derived from the daily series.
  const todayEntry = daily.find((d) => d.day === meta.until);
  const prevOpen = [...daily].filter((d) => d.day < meta.until && d.ca > 0).pop();

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
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 64px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <div className="label-mono">◳ Mesa · live</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 650, margin: 0 }}>
              Your activity, last {meta.days} days
            </h1>
            <DeltaBadge pct={wow.growth_ca} suffix="7d" />
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>
          <div className="label-mono">Vendus ····{meta.key_last4}</div>
          <div style={{ marginTop: 4 }}>
            {meta.since} → {meta.until}
          </div>
          <button
            onClick={onReset}
            style={{ marginTop: 6, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0 }}
          >
            Change key
          </button>
        </div>
      </div>

      {/* Today strip */}
      {todayEntry && (
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
                  <DeltaBadge
                    pct={pctDelta(todayEntry.ca / todayEntry.nb, prevOpen.ca / prevOpen.nb)}
                  />
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
            — Last {meta.days} days
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
        <StatTile label="Best day" value={eur(bestDay.ca, true)} sub={dayLabel(bestDay.day)} />
      </div>

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

      {/* Rush heatmap */}
      {heatmap.rows.length > 0 && (
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
      </div>

      {/* Weekday pattern + ticket distribution */}
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

      {/* Product intelligence (deferred) */}
      <ProductSection status={prodStatus} products={products} totalCa={stats.ca} />

      {/* Pro teaser */}
      <div style={{ ...card, marginTop: 24, background: "var(--spec-soft)", borderColor: "rgba(37,84,199,0.25)" }}>
        <div className="label-mono" style={{ color: "var(--accent)", marginBottom: 6 }}>
          Profit analytics · €29.99/mo
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          You&apos;re seeing your <b>sales</b>. Upgrade to <b>margins</b>: COGS per product, daily
          break-even, profitability-ranked mix and Revolut ↔ Vendus reconciliation.{" "}
          <span style={{ color: "var(--muted)" }}>Coming soon — 14-day free trial.</span>
        </div>
      </div>
    </main>
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

  const { topByRevenue, slowMovers, unsold, categoryMix, tickets } = products;
  const maxTop = Math.max(1, ...topByRevenue.map((p) => p.revenue));
  const maxCat = Math.max(1, ...categoryMix.map((c) => c.amount));

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 20 }}>
        {/* Top products */}
        <div style={card}>
          <Label>Top products (revenue)</Label>
          {topByRevenue.map((p, i) => (
            <div key={p.name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ ...mono, color: "var(--faint)", marginRight: 8 }}>{i + 1}</span>
                  {p.name}
                </span>
                <span style={{ ...mono, whiteSpace: "nowrap" }}>
                  {eur(p.revenue, true)} · {Math.round(p.units)}×
                </span>
              </div>
              <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
                <div style={{ width: `${(p.revenue / maxTop) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Category mix + slow movers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <Label>Category mix (revenue)</Label>
            {categoryMix.map((c) => (
              <BarRow key={c.label} label={c.label} value={`${eur(c.amount, true)} · ${c.pct}%`} pct={(c.amount / maxCat) * 100} strong />
            ))}
          </div>
          <div style={card}>
            <Label>Slowest movers</Label>
            {slowMovers.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <span style={{ ...mono, color: "var(--muted)", whiteSpace: "nowrap" }}>{Math.round(p.units)}× · {eur(p.revenue, true)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Basket / attach */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatTile label="Items / ticket" value={tickets.items_per_ticket.toLocaleString("en-GB")} sub={`${tickets.total.toLocaleString("en-GB")} tickets`} />
        <StatTile label="Attach rate" value={`${tickets.attach_rate}%`} sub={`${tickets.multi.toLocaleString("en-GB")} tickets with 2+ items`} />
        <StatTile label="Top 8 share of revenue" value={`${Math.round((topByRevenue.reduce((s, p) => s + p.revenue, 0) / (totalCa || 1)) * 100)}%`} sub="sales concentration" />
        <StatTile label="Unsold products" value={unsold.length.toLocaleString("en-GB")} sub="0 sales this period" />
      </div>

      {/* Unsold */}
      {unsold.length > 0 && (
        <div style={card}>
          <Label>Unsold products · {unsold.length}</Label>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
            Active in your catalog with zero sales this period — candidates to cut from the menu.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 200, overflowY: "auto" }}>
            {unsold.slice(0, 60).map((p) => (
              <span
                key={p.name}
                title={p.category}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  color: "var(--muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
            ))}
            {unsold.length > 60 && (
              <span style={{ fontSize: 12, color: "var(--faint)", padding: "4px 0" }}>
                +{unsold.length - 60} more
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
