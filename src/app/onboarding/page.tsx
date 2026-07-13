export default function OnboardingPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div className="label-mono" style={{ marginBottom: 16 }}>
          ◳ Onboarding · step 1 / 4
        </div>
        <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Funnel à câbler</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>
          Prochaine étape : brancher Supabase Auth (compte), collecter le
          business, puis connecter Vendus (valider la clé, la chiffrer,
          importer les ventes). Basé sur le prototype{" "}
          <code>reference/static/onboarding.html</code>.
        </p>
      </div>
    </main>
  );
}
