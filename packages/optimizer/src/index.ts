export const ALGORITHM_VERSION = "1.0.0";
export const MAX_SUBSETS = 20_000;

export type Offer = { productId: number; storeId: number; prixMad: number; dateReleve: string; source: string };
export type BasketItem = { productId: number; quantity: number };

export type OptimizeInput = {
  items: BasketItem[];
  offers: Offer[];
  /** null ou undefined = sans limite */
  maxStores?: number | null;
  excludedStoreIds?: number[];
  maxAgeDays?: number;
  /** Date de référence (AAAA-MM-JJ) : passée en paramètre pour rester reproductible. */
  referenceDate: string;
};

export type PlanLine = { productId: number; quantity: number; prixUnitaireMad: number; totalMad: number; dateReleve: string; source: string };
export type PlanStore = { storeId: number; lines: PlanLine[]; subtotalMad: number };
export type Exclusion = { productId: number; reason: "introuvable" | "perime" };
export type OptimizeResult = {
  algorithmVersion: string;
  referenceDate: string;
  maxStores: number | null;
  plan: PlanStore[];
  totalMad: number;
  bestSingleStore: { storeId: number; totalMad: number; coveredProducts: number; optimizedTotalSameItemsMad: number } | null;
  /** Économie face au meilleur mono-magasin, calculée sur les articles que ce magasin couvre. */
  savingsMad: number | null;
  excluded: Exclusion[];
  subsetsEvaluated: number;
};

export class OptimizerLimitError extends Error {
  constructor(public readonly subsets: number) {
    super(`Trop de combinaisons de magasins à évaluer (${subsets} > ${MAX_SUBSETS}). Réduisez le nombre de magasins maximum ou excluez des enseignes.`);
  }
}

const cents = (x: number) => Math.round(x * 100);
const fromCents = (c: number) => c / 100;

function daysBetween(a: string, b: string) {
  return Math.floor((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Nombre de sous-ensembles non vides de taille ≤ k parmi n. */
export function countSubsets(n: number, k: number): number {
  let total = 0;
  let c = 1;
  for (let i = 1; i <= Math.min(k, n); i++) {
    c = (c * (n - i + 1)) / i;
    total += Math.round(c);
    if (total > Number.MAX_SAFE_INTEGER / 2) return Infinity;
  }
  return total;
}

function* subsetsUpTo(ids: number[], k: number): Generator<number[]> {
  const size = Math.min(k, ids.length);
  for (let s = 1; s <= size; s++) {
    const idx = Array.from({ length: s }, (_, i) => i);
    while (true) {
      yield idx.map((i) => ids[i]);
      let i = s - 1;
      while (i >= 0 && idx[i] === ids.length - s + i) i--;
      if (i < 0) break;
      idx[i]++;
      for (let j = i + 1; j < s; j++) idx[j] = idx[j - 1] + 1;
    }
  }
}

type Cell = { prixC: number; offer: Offer };

export function optimize(input: OptimizeInput): OptimizeResult {
  const maxAge = input.maxAgeDays ?? 30;
  const excludedStores = new Set(input.excludedStoreIds ?? []);
  const k = input.maxStores ?? null;
  if (k !== null && (!Number.isInteger(k) || k < 1)) throw new Error("maxStores doit être un entier ≥ 1 ou null");

  // Articles regroupés par produit (quantités cumulées)
  const qty = new Map<number, number>();
  for (const it of input.items) qty.set(it.productId, (qty.get(it.productId) ?? 0) + it.quantity);
  const productIds = [...qty.keys()].sort((a, b) => a - b);

  // Meilleure offre fraîche par (produit, magasin) : la plus récente, puis la moins chère
  const prices = new Map<number, Map<number, Cell>>();
  const hasAny = new Set<number>();
  for (const o of input.offers) {
    if (!qty.has(o.productId) || excludedStores.has(o.storeId)) continue;
    hasAny.add(o.productId);
    if (o.dateReleve > input.referenceDate || daysBetween(o.dateReleve, input.referenceDate) > maxAge) continue;
    const byStore = prices.get(o.productId) ?? new Map<number, Cell>();
    const cur = byStore.get(o.storeId);
    if (!cur || o.dateReleve > cur.offer.dateReleve || (o.dateReleve === cur.offer.dateReleve && cents(o.prixMad) < cur.prixC)) {
      byStore.set(o.storeId, { prixC: cents(o.prixMad), offer: o });
    }
    prices.set(o.productId, byStore);
  }

  const excluded: Exclusion[] = [];
  const coverable: number[] = [];
  for (const p of productIds) {
    if (prices.get(p)?.size) coverable.push(p);
    else excluded.push({ productId: p, reason: hasAny.has(p) ? "perime" : "introuvable" });
  }

  const storeSet = new Set<number>();
  for (const p of coverable) for (const s of prices.get(p)!.keys()) storeSet.add(s);
  const stores = [...storeSet].sort((a, b) => a - b);

  /** Affectation de chaque produit au moins cher du sous-ensemble (égalité : plus petit identifiant). */
  const assign = (subset: number[], products: number[]) => {
    const assigned = new Map<number, { storeId: number; cell: Cell }>();
    let totalC = 0;
    for (const p of products) {
      let pick: { storeId: number; cell: Cell } | undefined;
      for (const s of subset) {
        const cell = prices.get(p)!.get(s);
        if (!cell) continue;
        if (!pick || cell.prixC < pick.cell.prixC || (cell.prixC === pick.cell.prixC && s < pick.storeId)) pick = { storeId: s, cell };
      }
      if (pick) {
        assigned.set(p, pick);
        totalC += pick.cell.prixC * qty.get(p)!;
      }
    }
    return { assigned, totalC };
  };

  let chosen: number[] = stores;
  let evaluated = 0;
  if (k !== null && coverable.length > 0) {
    const count = countSubsets(stores.length, k);
    if (count > MAX_SUBSETS) throw new OptimizerLimitError(count);
    let best: { subset: number[]; covered: number; totalC: number } | null = null;
    for (const subset of subsetsUpTo(stores, k)) {
      evaluated++;
      const { assigned, totalC } = assign(subset, coverable);
      const covered = assigned.size;
      const better =
        !best ||
        covered > best.covered ||
        (covered === best.covered && totalC < best.totalC) ||
        (covered === best.covered && totalC === best.totalC && lexLess(subset, best.subset));
      if (better) best = { subset, covered, totalC };
    }
    chosen = best!.subset;
  }

  const { assigned, totalC } = assign(chosen, coverable);
  const byStore = new Map<number, PlanLine[]>();
  for (const p of coverable) {
    const a = assigned.get(p);
    if (!a) continue;
    const q = qty.get(p)!;
    const line: PlanLine = {
      productId: p,
      quantity: q,
      prixUnitaireMad: fromCents(a.cell.prixC),
      totalMad: fromCents(a.cell.prixC * q),
      dateReleve: a.cell.offer.dateReleve,
      source: a.cell.offer.source,
    };
    byStore.set(a.storeId, [...(byStore.get(a.storeId) ?? []), line]);
  }
  const plan: PlanStore[] = [...byStore.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([storeId, lines]) => ({ storeId, lines, subtotalMad: fromCents(lines.reduce((s, l) => s + cents(l.totalMad), 0)) }));

  // Meilleur mono-magasin (couverture max puis coût min puis identifiant)
  let single: { storeId: number; covered: number; totalC: number } | null = null;
  for (const s of stores) {
    const { assigned: a, totalC: t } = assign([s], coverable);
    if (!single || a.size > single.covered || (a.size === single.covered && t < single.totalC)) single = { storeId: s, covered: a.size, totalC: t };
  }
  let savingsMad: number | null = null;
  let bestSingleStore: OptimizeResult["bestSingleStore"] = null;
  if (single) {
    const sameItems = coverable.filter((p) => prices.get(p)!.has(single!.storeId));
    const { totalC: optC } = assign(chosen, sameItems);
    bestSingleStore = { storeId: single.storeId, totalMad: fromCents(single.totalC), coveredProducts: single.covered, optimizedTotalSameItemsMad: fromCents(optC) };
    savingsMad = fromCents(single.totalC - optC);
  }

  return {
    algorithmVersion: ALGORITHM_VERSION,
    referenceDate: input.referenceDate,
    maxStores: k,
    plan,
    totalMad: fromCents(totalC),
    bestSingleStore,
    savingsMad,
    excluded,
    subsetsEvaluated: evaluated,
  };
}

function lexLess(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
}
