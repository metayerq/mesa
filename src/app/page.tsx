import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <div className="label-mono" style={{ marginBottom: 20 }}>
          ◳ Mesa · beta
        </div>
        <h1
          style={{
            fontSize: "clamp(32px, 6vw, 52px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: "0 0 16px",
            fontWeight: 650,
          }}
        >
          Your margins, in real time.
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.5,
            color: "var(--muted)",
            margin: "0 auto 32px",
            maxWidth: 460,
          }}
        >
          Plug in your Vendus POS and see COGS, daily break-even, product mix and
          reconciliation — KPIs no till gives you. Sales analytics free forever.
        </p>
        <Link
          href="/onboarding"
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: "#fff",
            padding: "13px 24px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Get started — 3 min →
        </Link>
      </div>
    </main>
  );
}
