// COGS & Recipes — unified model + cost engine.
// One concept: Recipe. A recipe with a `yield` ("makes 900 g") can be used as a
// line in any other recipe — this replaces the old ingredients → preparations →
// recipes three-step model from the reference app.
// Demo persistence: localStorage (maps 1:1 to future Supabase tables).

export type Unit = "g" | "kg" | "ml" | "l" | "unit";
export type TaxId = "NOR" | "INT" | "RED" | "ISE";

export const UNITS: Unit[] = ["g", "kg", "ml", "l", "unit"];
export const TAX_RATES: Record<TaxId, number> = { NOR: 0.23, INT: 0.13, RED: 0.06, ISE: 0 };
export const TAX_LABELS: Record<TaxId, string> = {
  NOR: "23% (normal)",
  INT: "13% (intermediate)",
  RED: "6% (reduced)",
  ISE: "Exempt",
};

export type Ingredient = {
  id: string;
  name: string;
  // Package as purchased: `price` € for `qty` × `unit` (e.g. €28.70 for 1 kg).
  price: number;
  qty: number;
  unit: Unit;
  note?: string;
};

export type RecipeLine = {
  kind: "ingredient" | "recipe";
  refId: string;
  qty: number;
  unit: Unit;
};

export type Recipe = {
  id: string;
  name: string;
  lines: RecipeLine[];
  // Set ⇒ usable as a component in other recipes ("this batch makes 900 g").
  yield: { qty: number; unit: Unit } | null;
  sellPrice: number | null; // gross, incl. VAT
  taxId: TaxId;
  vendusProductId: number | null;
  notes?: string;
};

export type CogsState = { ingredients: Ingredient[]; recipes: Recipe[] };

// ── Units ───────────────────────────────────────────────────────────────────

const DIMENSION: Record<Unit, "mass" | "volume" | "count"> = {
  g: "mass",
  kg: "mass",
  ml: "volume",
  l: "volume",
  unit: "count",
};
const TO_BASE: Record<Unit, number> = { g: 1, kg: 1000, ml: 1, l: 1000, unit: 1 };

export const toBase = (qty: number, unit: Unit) => qty * TO_BASE[unit];
export const sameDimension = (a: Unit, b: Unit) => DIMENSION[a] === DIMENSION[b];

/** € per base unit (g / ml / unit) of the package. */
export function ingredientUnitCost(i: Ingredient): number | null {
  const base = toBase(i.qty, i.unit);
  return base > 0 ? i.price / base : null;
}

/** Human display of unit cost: €/kg, €/l or €/unit. */
export function unitCostLabel(i: Ingredient): string {
  const c = ingredientUnitCost(i);
  if (c == null) return "—";
  const dim = DIMENSION[i.unit];
  if (dim === "mass") return `€${(c * 1000).toFixed(2)}/kg`;
  if (dim === "volume") return `€${(c * 1000).toFixed(2)}/l`;
  return `€${c.toFixed(2)}/unit`;
}

// ── Cost engine ─────────────────────────────────────────────────────────────

export type CostedLine = { line: RecipeLine; name: string; cost: number | null; error?: string };
export type RecipeCost = { total: number; lines: CostedLine[]; hasError: boolean };

export function recipeCost(
  recipe: Recipe,
  state: CogsState,
  visited: Set<string> = new Set()
): RecipeCost {
  visited.add(recipe.id);
  const lines: CostedLine[] = recipe.lines.map((line) => {
    if (line.kind === "ingredient") {
      const ing = state.ingredients.find((i) => i.id === line.refId);
      if (!ing) return { line, name: "(deleted ingredient)", cost: null, error: "missing" };
      if (!sameDimension(line.unit, ing.unit))
        return { line, name: ing.name, cost: null, error: `unit mismatch (${line.unit} vs ${ing.unit})` };
      const uc = ingredientUnitCost(ing);
      if (uc == null) return { line, name: ing.name, cost: null, error: "package qty is 0" };
      return { line, name: ing.name, cost: round4(toBase(line.qty, line.unit) * uc) };
    }
    // Component (recipe used as ingredient)
    const comp = state.recipes.find((r) => r.id === line.refId);
    if (!comp) return { line, name: "(deleted recipe)", cost: null, error: "missing" };
    if (visited.has(comp.id))
      return { line, name: comp.name, cost: null, error: "circular reference" };
    if (!comp.yield)
      return { line, name: comp.name, cost: null, error: "no yield set on component" };
    if (!sameDimension(line.unit, comp.yield.unit))
      return { line, name: comp.name, cost: null, error: `unit mismatch (${line.unit} vs ${comp.yield.unit})` };
    const sub = recipeCost(comp, state, new Set(visited));
    const yieldBase = toBase(comp.yield.qty, comp.yield.unit);
    if (sub.hasError || yieldBase <= 0)
      return { line, name: comp.name, cost: null, error: "component cost incomplete" };
    return { line, name: comp.name, cost: round4(toBase(line.qty, line.unit) * (sub.total / yieldBase)) };
  });
  const total = round4(lines.reduce((s, l) => s + (l.cost ?? 0), 0));
  return { total, lines, hasError: lines.some((l) => l.cost == null) };
}

export type RecipeEconomics = {
  cost: number;
  hasError: boolean;
  netPrice: number | null;
  foodCostPct: number | null;
  marginEur: number | null;
  marginPct: number | null;
  costPerYieldUnit: number | null; // for components: € per g/ml/unit of yield
};

export function recipeEconomics(recipe: Recipe, state: CogsState): RecipeEconomics {
  const { total, hasError } = recipeCost(recipe, state);
  let netPrice: number | null = null;
  let foodCostPct: number | null = null;
  let marginEur: number | null = null;
  let marginPct: number | null = null;
  if (recipe.sellPrice != null && recipe.sellPrice > 0) {
    netPrice = round4(recipe.sellPrice / (1 + TAX_RATES[recipe.taxId]));
    foodCostPct = netPrice > 0 ? round2((total / netPrice) * 100) : null;
    marginEur = round4(netPrice - total);
    marginPct = foodCostPct != null ? round2(100 - foodCostPct) : null;
  }
  let costPerYieldUnit: number | null = null;
  if (recipe.yield) {
    const yb = toBase(recipe.yield.qty, recipe.yield.unit);
    costPerYieldUnit = yb > 0 ? round4(total / yb) : null;
  }
  return { cost: total, hasError, netPrice, foodCostPct, marginEur, marginPct, costPerYieldUnit };
}

/** Recipe names that use this ingredient/component (delete guard). */
export function usedIn(state: CogsState, kind: "ingredient" | "recipe", refId: string): string[] {
  return state.recipes
    .filter((r) => r.id !== refId && r.lines.some((l) => l.kind === kind && l.refId === refId))
    .map((r) => r.name);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ── Persistence (demo: localStorage) ────────────────────────────────────────

const STORAGE_KEY = "mesa-cogs-v1";

export function loadState(): CogsState {
  if (typeof window === "undefined") return { ingredients: [], recipes: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ingredients: [], recipes: [] };
    const parsed = JSON.parse(raw) as CogsState;
    return {
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
    };
  } catch {
    return { ingredients: [], recipes: [] };
  }
}

export function saveState(state: CogsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const uid = () => Math.random().toString(36).slice(2, 10);

// ── Sample data (café starter) ──────────────────────────────────────────────

export function sampleState(): CogsState {
  const ing = (name: string, price: number, qty: number, unit: Unit): Ingredient => ({
    id: uid(),
    name,
    price,
    qty,
    unit,
  });
  const coffee = ing("Espresso coffee beans", 28.7, 1, "kg");
  const milk = ing("Fresh milk", 1.09, 1, "l");
  const oat = ing("Oat milk (barista)", 1.9, 1, "l");
  const matcha = ing("Matcha powder", 96.0, 1, "kg");
  const oats = ing("Rolled oats", 2.4, 1, "kg");
  const honey = ing("Honey", 8.5, 1, "kg");
  const nuts = ing("Mixed nuts", 14.0, 1, "kg");
  const yogurt = ing("Greek yogurt", 4.2, 1, "kg");

  const granolaBatch: Recipe = {
    id: uid(),
    name: "Granola (batch)",
    lines: [
      { kind: "ingredient", refId: oats.id, qty: 500, unit: "g" },
      { kind: "ingredient", refId: honey.id, qty: 150, unit: "g" },
      { kind: "ingredient", refId: nuts.id, qty: 250, unit: "g" },
    ],
    yield: { qty: 900, unit: "g" },
    sellPrice: null,
    taxId: "INT",
    vendusProductId: null,
    notes: "Oven 160°C · 25 min",
  };

  const recipes: Recipe[] = [
    {
      id: uid(),
      name: "Espresso",
      lines: [{ kind: "ingredient", refId: coffee.id, qty: 18, unit: "g" }],
      yield: null,
      sellPrice: 2.0,
      taxId: "INT",
      vendusProductId: null,
    },
    {
      id: uid(),
      name: "Cappuccino",
      lines: [
        { kind: "ingredient", refId: coffee.id, qty: 18, unit: "g" },
        { kind: "ingredient", refId: milk.id, qty: 150, unit: "ml" },
      ],
      yield: null,
      sellPrice: 4.0,
      taxId: "INT",
      vendusProductId: null,
    },
    {
      id: uid(),
      name: "Iced Matcha Latte (oat)",
      lines: [
        { kind: "ingredient", refId: matcha.id, qty: 4, unit: "g" },
        { kind: "ingredient", refId: oat.id, qty: 200, unit: "ml" },
      ],
      yield: null,
      sellPrice: 5.5,
      taxId: "INT",
      vendusProductId: null,
    },
    granolaBatch,
    {
      id: uid(),
      name: "Granola Bowl",
      lines: [
        { kind: "recipe", refId: granolaBatch.id, qty: 80, unit: "g" },
        { kind: "ingredient", refId: yogurt.id, qty: 150, unit: "g" },
        { kind: "ingredient", refId: honey.id, qty: 15, unit: "g" },
      ],
      yield: null,
      sellPrice: 6.5,
      taxId: "INT",
      vendusProductId: null,
    },
  ];

  return { ingredients: [coffee, milk, oat, matcha, oats, honey, nuts, yogurt], recipes };
}
