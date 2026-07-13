# Mesa — Tiers & Pricing

Decided 2026-07-13. Value metric: **per establishment / month**. UI language: **English**.

## The fence

One sentence per tier, and one objective rule: **anything that requires cost data
(recipes, fixed charges, salaries) or write access to Vendus is Profit.**

| | **Free** | **Sales — €14.99/mo** | **Profit — €29.99/mo** |
|---|---|---|---|
| *Pitch* | A snapshot of your sales | Your sales, live | What you actually **earn** |
| 30-day snapshot dashboard (revenue, tickets, avg/median basket, hours, days, payments, top/flop products, unsold, category mix, attach rate) | ✅ | ✅ | ✅ |
| Live Today view + vs yesterday / last week | — | ✅ | ✅ |
| Custom periods + 12-month history | — | ✅ | ✅ |
| Rush heatmap (weekday × hour), activity peaks, intraday cumulative curve | — | ✅ | ✅ |
| Top movers (7d vs 7d), transaction list with line items, revenue per seat | — | ✅ | ✅ |
| Weekly email digest | — | ✅ | ✅ |
| **COGS & recipes, margin per product / category** | — | — | ✅ |
| **Break-even (daily €, tx/day, live progress, calendar), EBITDA + month projection, prime cost** | — | — | ✅ |
| Costs / Expenses / Holidays / Stock / Cashflow | — | — | ✅ |
| **Revolut ↔ Vendus reconciliation** | — | — | ✅ |
| **Write-back to Vendus** (update products/prices from Mesa) | — | — | ✅ |

Plus **Groups** (multi-site, consolidated view, volume pricing): "Contact us" on the
pricing page — build later, on demand.

## Mechanics

- **Trial: 14 days of full Profit** for every new account (not per-tier). Taste
  margins + break-even, then drop to Free — the loss does the selling. No credit
  card during beta; require CC once there's volume.
- **Annual: 2 months free** (€149 / €299 per year).
- **Launch: founding price** — e.g. −30% for life for the first 20 establishments,
  in exchange for a testimonial. Word of mouth between PT restaurateurs is channel #1.
- Highlight **Profit as "recommended"** on the pricing page. Sales exists to catch
  small kiosks and to anchor €29.99 as reasonable.
- Sales pitch writes itself from real screens: *"94.7% prime cost today — you're
  losing €55 without knowing it."* One corrected decision pays for months.

## Watch-outs

1. **Write-back vs the read-only promise.** Onboarding currently says "Mesa can
   never modify anything in Vendus" — a strong trust argument for a non-tech
   audience. When Profit ships write-back, reword to: *"read-only by default; Mesa
   writes only when you click, action by action, reversible"* — and make it opt-in.
2. **Free must stay a photo, not a film**: 30 rolling days, manual refresh, no
   comparisons. The natural frustration ("how does this compare to last week?")
   is the upgrade trigger to Sales.
