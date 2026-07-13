"use client";

export type ConnectResult = {
  meta: { since: string; until: string; days: number; key_last4: string };
  stats: { ca: number; ca_ht: number; nb: number; ticket: number; ticket_ht: number };
  hourly: { hour: number; label: string; ca: number; nb: number }[];
  payments: { label: string; amount: number }[];
  daily: { day: string; ca: number; nb: number }[];
};

const eur = (n: number, compact = false) =>
  new Intl.NumberFormat("pt-PT", {
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

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={card}>
      <div className="label-mono" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

export default function Dashboard({
  result,
  onReset,
}: {
  result: ConnectResult;
  onReset: () => void;
}) {
  const { stats, hourly, payments, daily, meta } = result;

  const bestDay = daily.reduce(
    (best, d) => (d.ca > best.ca ? d : best),
    { day: "—", ca: 0, nb: 0 }
  );
  const peakHour = hourly.reduce(
    (best, h) => (h.ca > best.ca ? h : best),
    { hour: 0, label: "—", ca: 0, nb: 0 }
  );
  const maxHour = Math.max(1, ...hourly.map((h) => h.ca));
  const maxDay = Math.max(1, ...daily.map((d) => d.ca));
  const payTotal = payments.reduce((s, p) => s + p.amount, 0) || 1;

  const dayLabel = (iso: string) =>
    iso === "—"
      ? "—"
      : new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px 64px" }}>
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
          <h1 style={{ fontSize: 22, fontWeight: 650, margin: "4px 0 0" }}>
            Votre activité, {meta.days} derniers jours
          </h1>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>
          <div className="label-mono">Vendus ····{meta.key_last4}</div>
          <div style={{ marginTop: 4 }}>
            {meta.since} → {meta.until}
          </div>
          <button
            onClick={onReset}
            style={{
              marginTop: 6,
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
            }}
          >
            Changer de clé
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatTile
          label="CA encaissé (TTC)"
          value={eur(stats.ca, true)}
          sub={`${eur(stats.ca_ht, true)} HT`}
        />
        <StatTile label="Ventes" value={stats.nb.toLocaleString("fr-FR")} sub="tickets (avoirs déduits)" />
        <StatTile label="Panier moyen" value={eur(stats.ticket)} sub={`${eur(stats.ticket_ht)} HT`} />
        <StatTile
          label="Meilleur jour"
          value={eur(bestDay.ca, true)}
          sub={dayLabel(bestDay.day)}
        />
      </div>

      {/* Répartition horaire */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div className="label-mono" style={{ marginBottom: 4 }}>
          CA par heure
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Pic à <b style={{ color: "var(--text)" }}>{peakHour.label}</b> ·{" "}
          {eur(peakHour.ca, true)}
        </div>
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              height: 140,
              minWidth: 520,
            }}
          >
            {hourly.map((h) => (
              <div
                key={h.hour}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                title={`${h.label} · ${eur(h.ca)} · ${h.nb} ventes`}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${Math.round((h.ca / maxHour) * 118)}px`,
                    minHeight: h.ca > 0 ? 3 : 0,
                    background: h.hour === peakHour.hour ? "var(--accent)" : "var(--spec-soft)",
                    borderTop: h.hour === peakHour.hour ? "none" : "2px solid var(--accent)",
                    borderRadius: 3,
                    transition: "height .4s ease",
                  }}
                />
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)" }}>
                  {h.hour}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Moyens de paiement */}
        <div style={card}>
          <div className="label-mono" style={{ marginBottom: 16 }}>
            Moyens de paiement
          </div>
          {payments.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Aucun détail de paiement.</div>
          )}
          {payments.map((p) => {
            const pct = (p.amount / payTotal) * 100;
            return (
              <div key={p.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span>{p.label}</span>
                  <span style={{ fontFamily: "var(--mono)" }}>
                    {eur(p.amount, true)} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "var(--accent)",
                      borderRadius: 3,
                      transition: "width .5s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* CA par jour */}
        <div style={card}>
          <div className="label-mono" style={{ marginBottom: 16 }}>
            CA par jour
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, minWidth: Math.max(240, daily.length * 14) }}>
              {daily.map((d) => (
                <div
                  key={d.day}
                  title={`${dayLabel(d.day)} · ${eur(d.ca)} · ${d.nb} ventes`}
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
            {daily.length} jours · total {eur(stats.ca, true)}
          </div>
        </div>
      </div>

      {/* Teaser Pro */}
      <div
        style={{
          ...card,
          marginTop: 24,
          background: "var(--spec-soft)",
          borderColor: "rgba(37,84,199,0.25)",
        }}
      >
        <div className="label-mono" style={{ color: "var(--accent)", marginBottom: 6 }}>
          Profit analytics · Pro
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          Vous voyez vos <b>ventes</b>. Passez au calcul des <b>marges</b> : COGS par
          produit, seuil de rentabilité quotidien, mix par rentabilité et réconciliation
          Revolut ↔ Vendus. <span style={{ color: "var(--muted)" }}>Bientôt.</span>
        </div>
      </div>
    </main>
  );
}
