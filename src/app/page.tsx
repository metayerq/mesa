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
          Vos marges, en temps réel.
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
          Branchez votre POS Vendus et voyez COGS, seuil de rentabilité, mix
          produit et réconciliation — des KPIs qui n&apos;existent sur aucune
          caisse. Sales analytics gratuit pour toujours.
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
          Commencer — 3 min →
        </Link>
      </div>
    </main>
  );
}
