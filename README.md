# Mesa

Tableau de bord de marges pour cafés & restaurants. Mesa transforme le POS
**Vendus** en pilotage temps réel : COGS, seuil de rentabilité, mix produit par
rentabilité, suivi des dépenses, et réconciliation terminal de paiement ↔
factures certifiées.

Modèle **freemium** : *Sales analytics* gratuit pour toujours, *Profit
analytics* (marges, break-even, mix, EBITDA, réconciliation) en Pro — 29 €/mois
par établissement.

## Stack

- **Next.js** (App Router) + TypeScript — déployé sur Vercel
- **Supabase** — Postgres + Auth + Row Level Security (isolation multi-tenant par établissement)
- Chiffrement **AES-256-GCM** des clés API Vendus (`src/lib/crypto.ts`)

## Développement

```bash
cp .env.example .env.local   # puis renseigner les valeurs (voir ci-dessous)
npm install
npm run dev                  # http://localhost:3000
```

### Variables d'environnement (`.env.local`)

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète serveur — jamais exposée/committée |
| `MESA_ENCRYPTION_KEY` | Clé AES-256 (`openssl rand -base64 32`) pour chiffrer les clés Vendus |

## Structure

- `src/app/` — pages Next (landing, `/onboarding`, dashboard à venir)
- `src/lib/supabase/` — clients Supabase (browser / server / admin)
- `src/lib/crypto.ts` — chiffrement des secrets
- `reference/` — implémentation Flask mono-tenant d'origine (ESTUSHOP), conservée
  comme référence pendant le port en TS (moteur COGS/marges dans `app.py`,
  intégration Vendus dans `vendus.py`).
