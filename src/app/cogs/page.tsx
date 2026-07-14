"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type CogsState,
  type Ingredient,
  type Recipe,
  type RecipeLine,
  type TaxId,
  type Unit,
  UNITS,
  TAX_LABELS,
  TAX_RATES,
  ingredientUnitCost,
  unitCostLabel,
  recipeCost,
  recipeEconomics,
  usedIn,
  loadState,
  saveState,
  sampleState,
  uid,
} from "@/lib/cogs";

const eur = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
};
const mono: React.CSSProperties = { fontFamily: "var(--mono)" };
const inputStyle: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--bg-card)",
  color: "var(--text)",
  width: "100%",
};
const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  color: "var(--muted)",
  cursor: "pointer",
};

function foodCostColor(pct: number | null): string {
  if (pct == null) return "var(--muted)";
  if (pct <= 25) return "var(--green)";
  if (pct <= 35) return "var(--amber)";
  return "var(--red)";
}

export default function CogsPage() {
  const [state, setState] = useState<CogsState>({ ingredients: [], recipes: [] });
  const [loaded, setLoaded] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    setState(loadState());
    setLoaded(true);
  }, []);

  function commit(next: CogsState) {
    setState(next);
    saveState(next);
  }

  const editingRecipe = state.recipes.find((r) => r.id === editingRecipeId) ?? null;

  const pricedEconomics = useMemo(
    () =>
      state.recipes
        .filter((r) => r.lines.length > 0) // shells importés sans recette : exclus de la moyenne
        .map((r) => recipeEconomics(r, state))
        .filter((e) => e.foodCostPct != null && !e.hasError),
    [state]
  );
  const avgFoodCost = pricedEconomics.length
    ? pricedEconomics.reduce((s, e) => s + (e.foodCostPct ?? 0), 0) / pricedEconomics.length
    : null;
  const linkedCount = state.recipes.filter((r) => r.vendusProductId).length;

  if (!loaded) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <span className="label-mono">Loading…</span>
      </main>
    );
  }

  const empty = state.ingredients.length === 0 && state.recipes.length === 0;

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 64px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <div className="label-mono">◳ Mesa · Profit</div>
          <h1 style={{ fontSize: 22, fontWeight: 650, margin: "4px 0 0" }}>COGS & Recipes</h1>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
          <Link href="/onboarding" style={{ color: "var(--accent)", fontSize: 13 }}>
            Sales dashboard →
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!empty && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Stat label="Ingredients" value={String(state.ingredients.length)} />
          <Stat label="Recipes" value={String(state.recipes.length)} />
          <Stat
            label="Avg food cost"
            value={avgFoodCost != null ? `${avgFoodCost.toFixed(1)}%` : "—"}
            color={foodCostColor(avgFoodCost)}
          />
          <Stat label="On Vendus" value={String(linkedCount)} />
        </div>
      )}

      {empty ? (
        <div style={{ ...card, textAlign: "center", padding: 48 }}>
          <div className="label-mono" style={{ marginBottom: 12 }}>
            Nothing here yet
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 420, margin: "0 auto 24px", lineHeight: 1.5 }}>
            Add your ingredients with their purchase price, build recipes on top, and Mesa
            computes the real cost and margin of every item on your menu.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={btnPrimary} onClick={() => setImportOpen(true)}>
              Import my menu from Vendus
            </button>
            <button style={btnGhost} onClick={() => commit(sampleState())}>
              Load sample café data
            </button>
            <button
              style={btnGhost}
              onClick={() =>
                commit({
                  ingredients: [{ id: uid(), name: "", price: 0, qty: 1, unit: "kg" }],
                  recipes: [],
                })
              }
            >
              Start from scratch
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          <IngredientsPanel state={state} commit={commit} />
          {editingRecipe ? (
            <RecipeEditor
              key={editingRecipe.id}
              recipe={editingRecipe}
              state={state}
              commit={commit}
              onClose={() => setEditingRecipeId(null)}
              onOpen={setEditingRecipeId}
            />
          ) : (
            <RecipesPanel
              state={state}
              commit={commit}
              onEdit={setEditingRecipeId}
              onImport={() => setImportOpen(true)}
            />
          )}
        </div>
      )}

      {importOpen && (
        <ImportModal state={state} commit={commit} onClose={() => setImportOpen(false)} />
      )}
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={card}>
      <div className="label-mono" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ ...mono, fontSize: 24, fontWeight: 600, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

// ── Ingredients ─────────────────────────────────────────────────────────────

function IngredientsPanel({ state, commit }: { state: CogsState; commit: (s: CogsState) => void }) {
  const [draft, setDraft] = useState<Ingredient | null>(null);

  function save() {
    if (!draft || !draft.name.trim() || draft.price < 0 || draft.qty <= 0) return;
    const exists = state.ingredients.some((i) => i.id === draft.id);
    commit({
      ...state,
      ingredients: exists
        ? state.ingredients.map((i) => (i.id === draft.id ? draft : i))
        : [...state.ingredients, draft],
    });
    setDraft(null);
  }

  function remove(ing: Ingredient) {
    const users = usedIn(state, "ingredient", ing.id);
    if (users.length > 0) {
      window.alert(`"${ing.name}" is used in: ${users.join(", ")}. Remove it from those recipes first.`);
      return;
    }
    if (!window.confirm(`Delete ingredient "${ing.name}"?`)) return;
    commit({ ...state, ingredients: state.ingredients.filter((i) => i.id !== ing.id) });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span className="label-mono">Ingredients · {state.ingredients.length}</span>
        <button
          style={{ ...btnGhost, padding: "5px 12px" }}
          onClick={() => setDraft({ id: uid(), name: "", price: 0, qty: 1, unit: "kg" })}
        >
          + Add
        </button>
      </div>

      {draft && (
        <div style={{ border: "1px solid var(--accent)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <input
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Name (e.g. Espresso coffee beans)"
            value={draft.name}
            autoFocus
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input
              style={{ ...inputStyle, width: 90 }}
              type="number"
              min={0}
              step="0.01"
              value={draft.price || ""}
              placeholder="Price €"
              onChange={(e) => setDraft({ ...draft, price: parseFloat(e.target.value) || 0 })}
            />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>for</span>
            <input
              style={{ ...inputStyle, width: 70 }}
              type="number"
              min={0}
              step="0.01"
              value={draft.qty || ""}
              placeholder="Qty"
              onChange={(e) => setDraft({ ...draft, qty: parseFloat(e.target.value) || 0 })}
            />
            <select
              style={{ ...inputStyle, width: 76 }}
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={save}>
              Save
            </button>
            <button style={btnGhost} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.ingredients.map((ing) => {
        const users = usedIn(state, "ingredient", ing.id);
        return (
          <div
            key={ing.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "9px 0",
              borderTop: "1px solid var(--border)",
              cursor: "pointer",
            }}
            onClick={() => setDraft({ ...ing })}
            title="Click to edit"
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ing.name || <em style={{ color: "var(--faint)" }}>unnamed</em>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {eur(ing.price)} / {ing.qty} {ing.unit}
                {users.length > 0 && ` · in ${users.length} recipe${users.length > 1 ? "s" : ""}`}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ ...mono, fontSize: 12, color: "var(--muted)" }}>{unitCostLabel(ing)}</span>
              <button
                style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 15, padding: 2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(ing);
                }}
                aria-label={`Delete ${ing.name}`}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Recipes list ────────────────────────────────────────────────────────────

function RecipesPanel({
  state,
  commit,
  onEdit,
  onImport,
}: {
  state: CogsState;
  commit: (s: CogsState) => void;
  onEdit: (id: string) => void;
  onImport: () => void;
}) {
  function addRecipe(preset: "menu" | "prep") {
    const r: Recipe = {
      id: uid(),
      name: "",
      lines: [],
      yield: preset === "prep" ? { qty: 1, unit: "kg" } : null,
      sellPrice: null,
      taxId: "INT",
      vendusProductId: null,
    };
    commit({ ...state, recipes: [...state.recipes, r] });
    onEdit(r.id);
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span className="label-mono">Recipes · {state.recipes.length}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...btnGhost, padding: "5px 12px" }} onClick={() => addRecipe("menu")}>
            + Menu item
          </button>
          <button style={{ ...btnGhost, padding: "5px 12px" }} onClick={() => addRecipe("prep")}>
            + Prep / batch
          </button>
        </div>
      </div>
      <button
        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0, marginBottom: 12 }}
        onClick={onImport}
      >
        Import my menu from Vendus →
      </button>
      {state.recipes.map((r) => {
        const eco = recipeEconomics(r, state);
        return (
          <div
            key={r.id}
            onClick={() => onEdit(r.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name || <em style={{ color: "var(--faint)" }}>unnamed recipe</em>}
                {r.yield && (
                  <span
                    className="label-mono"
                    style={{ marginLeft: 8, fontSize: 10, color: "var(--accent)", background: "var(--spec-soft)", padding: "2px 6px", borderRadius: 4 }}
                  >
                    prep
                  </span>
                )}
                {r.vendusProductId && (
                  <span
                    className="label-mono"
                    style={{ marginLeft: 6, fontSize: 10, color: "var(--green)", background: "rgba(68,131,97,0.1)", padding: "2px 6px", borderRadius: 4 }}
                  >
                    vendus
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {r.lines.length === 0
                  ? "no ingredients yet"
                  : `cost ${eco.hasError ? "⚠ incomplete" : eur(eco.cost)}`}
                {r.lines.length > 0 && r.yield && eco.costPerYieldUnit != null && ` · €${eco.costPerYieldUnit.toFixed(4)}/${r.yield.unit}`}
                {r.sellPrice != null && ` · sells ${eur(r.sellPrice)}`}
              </div>
            </div>
            {eco.foodCostPct != null && r.lines.length > 0 && (
              <span style={{ ...mono, fontSize: 12.5, fontWeight: 600, color: foodCostColor(eco.foodCostPct), whiteSpace: "nowrap" }}>
                {eco.foodCostPct.toFixed(1)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Recipe editor ───────────────────────────────────────────────────────────

function RecipeEditor({
  recipe,
  state,
  commit,
  onClose,
  onOpen,
}: {
  recipe: Recipe;
  state: CogsState;
  commit: (s: CogsState) => void;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Recipe>({ ...recipe, lines: recipe.lines.map((l) => ({ ...l })) });
  const [vendusOpen, setVendusOpen] = useState(false);
  // Les preps démarrent sans bloc prix ; un item de menu l'affiche d'emblée.
  const [showPricing, setShowPricing] = useState(recipe.sellPrice != null || recipe.yield == null);

  // Économie calculée sur le draft, dans l'état où il serait une fois sauvé.
  const previewState: CogsState = {
    ...state,
    recipes: state.recipes.map((r) => (r.id === draft.id ? draft : r)),
  };
  const costed = recipeCost(draft, previewState);
  const eco = recipeEconomics(draft, previewState);

  const components = state.recipes.filter((r) => r.id !== draft.id && r.yield);

  function save(next?: Recipe) {
    const toSave = next ?? draft;
    commit({ ...state, recipes: state.recipes.map((r) => (r.id === toSave.id ? toSave : r)) });
  }

  function remove() {
    const users = usedIn(state, "recipe", draft.id);
    if (users.length > 0) {
      window.alert(`"${draft.name}" is used as a component in: ${users.join(", ")}. Remove it there first.`);
      return;
    }
    if (!window.confirm(`Delete recipe "${draft.name || "unnamed"}"?`)) return;
    commit({ ...state, recipes: state.recipes.filter((r) => r.id !== draft.id) });
    onClose();
  }

  function duplicate() {
    const copy: Recipe = {
      ...draft,
      id: uid(),
      name: draft.name ? `${draft.name} (copy)` : "",
      vendusProductId: null,
      lines: draft.lines.map((l) => ({ ...l })),
      yield: draft.yield ? { ...draft.yield } : null,
    };
    commit({
      ...state,
      recipes: [...state.recipes.map((r) => (r.id === draft.id ? draft : r)), copy],
    });
    onOpen(copy.id);
  }

  function setLine(idx: number, patch: Partial<RecipeLine>) {
    setDraft({
      ...draft,
      lines: draft.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    });
  }

  return (
    <div style={{ ...card, borderColor: "var(--accent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button style={{ ...btnGhost, padding: "5px 12px" }} onClick={() => { save(); onClose(); }}>
          ← Save & back
        </button>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12 }}
            onClick={duplicate}
          >
            Duplicate
          </button>
          <button
            style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12 }}
            onClick={remove}
          >
            Delete
          </button>
        </div>
      </div>

      <input
        style={{ ...inputStyle, fontSize: 16, fontWeight: 600, marginBottom: 14 }}
        placeholder="Recipe name (e.g. Cappuccino)"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />

      {/* Lines */}
      <div className="label-mono" style={{ marginBottom: 8 }}>
        Ingredients
      </div>
      {costed.lines.map((cl, idx) => (
        <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
          <select
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            value={`${cl.line.kind}:${cl.line.refId}`}
            onChange={(e) => {
              const [kind, refId] = e.target.value.split(":");
              setLine(idx, { kind: kind as RecipeLine["kind"], refId });
            }}
          >
            <optgroup label="Ingredients">
              {state.ingredients.map((i) => (
                <option key={i.id} value={`ingredient:${i.id}`}>
                  {i.name || "unnamed"}
                </option>
              ))}
            </optgroup>
            {components.length > 0 && (
              <optgroup label="Recipe components">
                {components.map((r) => (
                  <option key={r.id} value={`recipe:${r.id}`}>
                    {r.name || "unnamed"}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <input
            style={{ ...inputStyle, width: 64 }}
            type="number"
            min={0}
            step="0.1"
            value={cl.line.qty || ""}
            onChange={(e) => setLine(idx, { qty: parseFloat(e.target.value) || 0 })}
          />
          <select
            style={{ ...inputStyle, width: 66 }}
            value={cl.line.unit}
            onChange={(e) => setLine(idx, { unit: e.target.value as Unit })}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <span style={{ ...mono, fontSize: 12, width: 60, textAlign: "right", color: cl.error ? "var(--red)" : "var(--muted)" }} title={cl.error}>
            {cl.cost != null ? eur(cl.cost) : "⚠"}
          </span>
          <button
            style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 15 }}
            onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== idx) })}
            aria-label="Remove line"
          >
            ×
          </button>
        </div>
      ))}
      {costed.lines.some((l) => l.error) && (
        <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>
          {costed.lines.filter((l) => l.error).map((l, i) => (
            <div key={i}>
              {l.name}: {l.error}
            </div>
          ))}
        </div>
      )}
      <button
        style={{ ...btnGhost, marginBottom: 16 }}
        onClick={() => {
          const first = state.ingredients[0];
          if (!first) {
            window.alert("Add an ingredient first.");
            return;
          }
          setDraft({ ...draft, lines: [...draft.lines, { kind: "ingredient", refId: first.id, qty: 0, unit: "g" }] });
        }}
      >
        + Add line
      </button>

      {/* Component toggle */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.yield != null}
            onChange={(e) =>
              setDraft({ ...draft, yield: e.target.checked ? { qty: 1, unit: "kg" } : null })
            }
          />
          Usable as ingredient in other recipes (batch / prep)
        </label>
        {draft.yield && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>This recipe makes</span>
            <input
              style={{ ...inputStyle, width: 80 }}
              type="number"
              min={0}
              step="0.1"
              value={draft.yield.qty || ""}
              onChange={(e) =>
                setDraft({ ...draft, yield: { ...draft.yield!, qty: parseFloat(e.target.value) || 0 } })
              }
            />
            <select
              style={{ ...inputStyle, width: 76 }}
              value={draft.yield.unit}
              onChange={(e) => setDraft({ ...draft, yield: { ...draft.yield!, unit: e.target.value as Unit } })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {eco.costPerYieldUnit != null && (
              <span style={{ ...mono, fontSize: 12, color: "var(--muted)" }}>
                → €{eco.costPerYieldUnit.toFixed(4)}/{draft.yield.unit}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pricing */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
        {showPricing ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Selling price (incl. VAT)</span>
              <input
                style={{ ...inputStyle, width: 90 }}
                type="number"
                min={0}
                step="0.1"
                value={draft.sellPrice ?? ""}
                placeholder="—"
                onChange={(e) =>
                  setDraft({ ...draft, sellPrice: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })
                }
              />
              <select
                style={{ ...inputStyle, width: 170 }}
                value={draft.taxId}
                onChange={(e) => setDraft({ ...draft, taxId: e.target.value as TaxId })}
              >
                {(Object.keys(TAX_LABELS) as TaxId[]).map((t) => (
                  <option key={t} value={t}>
                    VAT {TAX_LABELS[t]}
                  </option>
                ))}
              </select>
              {draft.yield && (
                <button
                  style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 12 }}
                  onClick={() => {
                    setShowPricing(false);
                    setDraft({ ...draft, sellPrice: null });
                  }}
                >
                  not sold ×
                </button>
              )}
            </div>
            {eco.cost > 0 && !costed.hasError && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                Suggested price for food cost{" "}
                {[25, 30, 35]
                  .map((t) => `${t}%: ${eur((eco.cost / (t / 100)) * (1 + TAX_RATES[draft.taxId]))}`)
                  .join(" · ")}{" "}
                (incl. VAT)
              </div>
            )}
          </>
        ) : (
          <button style={btnGhost} onClick={() => setShowPricing(true)}>
            + Also sold on the menu
          </button>
        )}
      </div>

      {/* Economics */}
      <div
        style={{
          background: "var(--bg-hover)",
          borderRadius: 10,
          padding: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <EcoCell label="Total cost" value={costed.hasError ? "⚠" : eur(eco.cost, 3)} />
        {eco.netPrice != null && <EcoCell label="Net price" value={eur(eco.netPrice)} />}
        {eco.marginEur != null && <EcoCell label="Margin" value={eur(eco.marginEur)} color={eco.marginEur >= 0 ? "var(--green)" : "var(--red)"} />}
        {eco.foodCostPct != null && (
          <EcoCell label="Food cost" value={`${eco.foodCostPct.toFixed(1)}%`} color={foodCostColor(eco.foodCostPct)} />
        )}
      </div>

      {/* Vendus */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        {draft.vendusProductId ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Linked to Vendus · <span style={mono}>#{draft.vendusProductId}</span>
            </span>
            <button style={btnGhost} onClick={() => setVendusOpen(true)} disabled={costed.hasError}>
              Sync cost & price to Vendus…
            </button>
          </div>
        ) : draft.sellPrice ? (
          <button
            style={{ ...btnPrimary, opacity: !costed.hasError && draft.name.trim() ? 1 : 0.5 }}
            disabled={costed.hasError || !draft.name.trim()}
            onClick={() => setVendusOpen(true)}
            title={costed.hasError ? "Fix recipe errors first" : ""}
          >
            Create product on Vendus…
          </button>
        ) : draft.yield ? (
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Preps stay in Mesa — nothing is pushed to Vendus. Use{" "}
            <b style={{ color: "var(--text)" }}>+ Also sold on the menu</b> if you also sell it.
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Set a selling price to create this product on Vendus.
          </div>
        )}
      </div>

      {vendusOpen && (
        <VendusModal
          draft={draft}
          cost={eco.cost}
          onDone={(productId) => {
            const next = productId ? { ...draft, vendusProductId: productId } : draft;
            setDraft(next);
            save(next);
            setVendusOpen(false);
          }}
          onCancel={() => setVendusOpen(false)}
        />
      )}
    </div>
  );
}

function EcoCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="label-mono" style={{ marginBottom: 4, fontSize: 10 }}>
        {label}
      </div>
      <div style={{ ...mono, fontSize: 17, fontWeight: 600, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

// ── Vendus push modal ───────────────────────────────────────────────────────

function VendusModal({
  draft,
  cost,
  onDone,
  onCancel,
}: {
  draft: Recipe;
  cost: number;
  onDone: (productId: number | null) => void;
  onCancel: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const isUpdate = draft.vendusProductId != null;

  async function submit() {
    if (!apiKey.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(isUpdate ? "/api/vendus/product-update" : "/api/vendus/product-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isUpdate
            ? {
                apiKey: apiKey.trim(),
                productId: draft.vendusProductId,
                grossPrice: draft.sellPrice,
                supplyPrice: cost,
              }
            : {
                apiKey: apiKey.trim(),
                title: draft.name.trim(),
                grossPrice: draft.sellPrice,
                taxId: draft.taxId,
                supplyPrice: cost,
                categoryId: categoryId.trim() || undefined,
              }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      onDone(isUpdate ? draft.vendusProductId : (json.productId as number | null));
    } catch {
      setError("Connection failed.");
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(38,36,30,0.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div style={{ ...card, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="label-mono" style={{ marginBottom: 12 }}>
          {isUpdate ? "Sync to Vendus" : "Create product on Vendus"}
        </div>

        <div style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 14 }}>
          <Row k="Product" v={draft.name} />
          {draft.sellPrice != null && <Row k="Price (incl. VAT)" v={eur(draft.sellPrice)} />}
          {!isUpdate && <Row k="VAT" v={TAX_LABELS[draft.taxId]} />}
          <Row k="Supply price (cost)" v={eur(cost, 4)} />
          {isUpdate && <Row k="Vendus product" v={`#${draft.vendusProductId}`} />}
        </div>

        {!isUpdate && (
          <input
            style={{ ...inputStyle, marginBottom: 10 }}
            placeholder="Vendus category id (optional)"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
        )}

        <input
          style={{ ...inputStyle, fontFamily: "var(--mono)", marginBottom: 10 }}
          type="password"
          placeholder="Vendus API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 }}>
          This writes to your real Vendus account — one product,{" "}
          {isUpdate ? "updated" : "created"} only when you click. Your key is used for this
          call and not stored.
        </div>

        {status === "error" && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12, lineHeight: 1.4 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={{ ...btnPrimary, opacity: apiKey.trim() && status !== "loading" ? 1 : 0.6 }}
            disabled={!apiKey.trim() || status === "loading"}
            onClick={submit}
          >
            {status === "loading" ? "Sending…" : isUpdate ? "Sync now" : "Create product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--muted)" }}>{k}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{v}</span>
    </div>
  );
}

// ── Import menu from Vendus ─────────────────────────────────────────────────

type CatalogProduct = { id: number; name: string; category: string; price: number };

function ImportModal({
  state,
  commit,
  onClose,
}: {
  state: CogsState;
  commit: (s: CogsState) => void;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<CatalogProduct[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hiddenCount, setHiddenCount] = useState(0);

  async function load() {
    if (!apiKey.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/vendus/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      const all = (json.products ?? []) as CatalogProduct[];
      const existingIds = new Set(state.recipes.map((r) => r.vendusProductId).filter(Boolean));
      const existingNames = new Set(state.recipes.map((r) => r.name.trim().toLowerCase()));
      const fresh = all.filter(
        (p) => !existingIds.has(p.id) && !existingNames.has(p.name.trim().toLowerCase())
      );
      setHiddenCount(all.length - fresh.length);
      setProducts(fresh);
      setSelected(new Set(fresh.filter((p) => p.price > 0).map((p) => p.id)));
      setStatus("idle");
    } catch {
      setError("Connection failed.");
      setStatus("error");
    }
  }

  function importSelected() {
    if (!products) return;
    const newRecipes: Recipe[] = products
      .filter((p) => selected.has(p.id))
      .map((p) => ({
        id: uid(),
        name: p.name,
        lines: [],
        yield: null,
        sellPrice: p.price > 0 ? p.price : null,
        taxId: "INT" as TaxId,
        vendusProductId: p.id,
      }));
    commit({ ...state, recipes: [...state.recipes, ...newRecipes] });
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(38,36,30,0.45)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div style={{ ...card, maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="label-mono" style={{ marginBottom: 12 }}>
          Import my menu from Vendus
        </div>

        {!products ? (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
              Pulls your product catalog (read-only) and creates a recipe shell for each item —
              name, price and Vendus link prefilled. You only add the ingredients.
            </p>
            <input
              style={{ ...inputStyle, fontFamily: "var(--mono)", marginBottom: 10 }}
              type="password"
              placeholder="Vendus API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              autoFocus
            />
            {status === "error" && (
              <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{ ...btnPrimary, opacity: apiKey.trim() && status !== "loading" ? 1 : 0.6 }}
                disabled={!apiKey.trim() || status === "loading"}
                onClick={load}
              >
                {status === "loading" ? "Loading catalog…" : "Load catalog"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
              {products.length} products found
              {hiddenCount > 0 && ` · ${hiddenCount} already in Mesa (hidden)`}
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
              {products.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 0",
                    borderTop: "1px solid var(--border)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      setSelected(next);
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                    {p.category && (
                      <span style={{ color: "var(--faint)", fontSize: 11.5 }}> · {p.category}</span>
                    )}
                  </span>
                  <span style={{ ...mono, fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>
                    {p.price > 0 ? eur(p.price) : "—"}
                  </span>
                </label>
              ))}
              {products.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: "12px 0" }}>
                  Nothing new to import — your whole catalog is already in Mesa.
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", marginRight: "auto" }}>
                {selected.size} selected
              </span>
              <button style={btnGhost} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{ ...btnPrimary, opacity: selected.size > 0 ? 1 : 0.6 }}
                disabled={selected.size === 0}
                onClick={importSelected}
              >
                Import {selected.size} product{selected.size === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
