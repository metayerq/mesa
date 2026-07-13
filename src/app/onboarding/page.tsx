"use client";

import { useState } from "react";
import Dashboard, { type ConnectResult } from "./Dashboard";

export default function OnboardingPage() {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConnectResult | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/vendus/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Une erreur est survenue.");
        setStatus("error");
        return;
      }
      setResult(data as ConnectResult);
      setStatus("idle");
    } catch {
      setError("Connexion impossible. Vérifie ta connexion internet.");
      setStatus("error");
    }
  }

  if (result) {
    return (
      <Dashboard
        result={result}
        apiKey={key.trim()}
        onReset={() => {
          setResult(null);
          setKey("");
          setStatus("idle");
        }}
      />
    );
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div className="label-mono" style={{ marginBottom: 12 }}>
          ◳ Mesa · Connect Vendus
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 650, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Voyez vos vraies données en 30 secondes
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.5, margin: "0 0 24px" }}>
          Collez votre clé API Vendus. On récupère vos ventes des 30 derniers jours et on
          affiche votre dashboard — aucune configuration.
        </p>

        <form onSubmit={connect}>
          <label
            className="label-mono"
            htmlFor="vendus-key"
            style={{ display: "block", marginBottom: 8 }}
          >
            Vendus API key
          </label>
          <input
            id="vendus-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="f47ac10b-58cc-4372-a567-…"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%",
              fontFamily: "var(--mono)",
              fontSize: 13,
              padding: "12px 14px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--bg-card)",
              color: "var(--text)",
            }}
          />

          {status === "error" && (
            <div style={{ color: "var(--red)", fontSize: 13, marginTop: 10, lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading" || !key.trim()}
            style={{
              width: "100%",
              marginTop: 16,
              background: "var(--accent)",
              color: "#fff",
              padding: "13px 20px",
              borderRadius: 10,
              border: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: status === "loading" || !key.trim() ? "default" : "pointer",
              opacity: status === "loading" || !key.trim() ? 0.6 : 1,
            }}
          >
            {status === "loading" ? "Import des ventes…" : "Voir mon dashboard →"}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            background: "var(--bg-hover)",
            borderRadius: 10,
            fontSize: 12.5,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          <b style={{ color: "var(--text)" }}>Lecture seule.</b> Mesa ne peut rien modifier
          dans Vendus. Dans cette démo, la clé sert à l&apos;appel puis est oubliée — elle
          n&apos;est pas stockée.
          <div style={{ marginTop: 8 }}>
            La trouver : Vendus → <b>Configurações</b> → <b>Integrações → API</b>.
          </div>
        </div>
      </div>
    </main>
  );
}
