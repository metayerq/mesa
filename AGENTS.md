<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mesa

SaaS multi-tenant de pilotage des marges pour cafés/restaurants (cible : POS
Vendus, Portugal). Version commercialisable du dashboard mono-tenant construit
pour le café Estudantina (Lisbonne).

## Stack
- Next.js (App Router) + TypeScript, déployé sur Vercel.
- Supabase : Postgres + Auth + RLS (isolation par établissement).
- Clés API Vendus chiffrées AES-256-GCM (`src/lib/crypto.ts`), déchiffrées côté serveur uniquement.

## Repères
- `reference/` = code Flask d'origine (ESTUSHOP), **référence en lecture** pour le
  port TS. Ne pas déployer. Logique métier : `reference/app.py` (COGS, marges,
  réconciliation) et `reference/vendus.py` (intégration API Vendus, ~1000 l.).
- Prototype du funnel d'onboarding : `reference/static/onboarding.html`.
- Objectif courant : rendre le funnel réel (Supabase Auth → connexion Vendus →
  import ventes → dashboard rempli, time-to-wow < 3 min).

## Conventions
- Tokens de design dans `src/app/globals.css` (papier #EDEAE3, encre #26241E,
  bleu blueprint #2554C7, labels monospace, logo ◳).
- Toute requête data passe par RLS ; le client `admin` (service_role) bypasse la
  RLS et reste strictement serveur.
