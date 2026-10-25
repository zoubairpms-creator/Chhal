export type Unite = "g" | "kg" | "ml" | "cl" | "l" | "piece";
export type Famille = "masse" | "volume" | "piece";

const AR_DIACRITICS = /[ً-ٰٟـ]/g;

/** Normalisation commune : minuscules, sans accents latins ni voyelles arabes, alef/ya/ta marbuta unifiés. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ARABIZI_DIGITS: Record<string, string> = { "2": "a", "3": "a", "5": "kh", "7": "h", "8": "gh", "9": "q" };

/** Clé phonétique latine (arabizi/darija) : chiffres → sons, voyelles retirées, doublons réduits. « zit » ≈ « zeit » ≈ « zayt ». */
export function arabiziKey(text: string): string {
  const base = normalize(text)
    .replace(/[2-9]/g, (d) => ARABIZI_DIGITS[d] ?? d)
    .replace(/ou|oo/g, "u")
    .replace(/ch|sh/g, "S")
    .replace(/kh/g, "K")
    .replace(/gh/g, "G");
  return base
    .split(" ")
    .map((w) => (w[0] ?? "") + w.slice(1).replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1"))
    .join(" ");
}

export type Alias = { productId: number; texte: string; langue: string };
export type SearchHit = { productId: number; score: number; via: string };

/** Recherche par alias (FR/AR/darija/EN + arabizi). Score : exact 1, préfixe 0.8, mot 0.7, clé phonétique 0.6. */
export function searchAliases(query: string, aliases: Alias[], limit = 20): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const qk = arabiziKey(query);
  const best = new Map<number, SearchHit>();
  for (const a of aliases) {
    const n = normalize(a.texte);
    let score = 0;
    if (n === q) score = 1;
    else if (n.startsWith(q)) score = 0.8;
    else if (n.split(" ").includes(q)) score = 0.7;
    else if (qk.length >= 2 && /^[a-z0-9 ]+$/i.test(a.texte) && arabiziKey(a.texte) === qk) score = 0.6;
    if (score > 0 && score > (best.get(a.productId)?.score ?? 0)) {
      best.set(a.productId, { productId: a.productId, score, via: a.texte });
    }
  }
  return [...best.values()].sort((x, y) => y.score - x.score || x.productId - y.productId).slice(0, limit);
}

const FACTORS: Record<Unite, { famille: Famille; vers: number }> = {
  g: { famille: "masse", vers: 1 },
  kg: { famille: "masse", vers: 1000 },
  ml: { famille: "volume", vers: 1 },
  cl: { famille: "volume", vers: 10 },
  l: { famille: "volume", vers: 1000 },
  piece: { famille: "piece", vers: 1 },
};

export function toBase(valeur: number, unite: Unite) {
  const f = FACTORS[unite];
  return { famille: f.famille, quantite: valeur * f.vers };
}

/** Deux formats non convertibles (masse vs volume vs pièce) ne sont jamais comparés. */
export function comparable(a: { valeur: number; unite: Unite }, b: { valeur: number; unite: Unite }) {
  return FACTORS[a.unite].famille === FACTORS[b.unite].famille;
}

/** Prix par kg, par litre ou par pièce, arrondi à 2 décimales. */
export function unitPrice(prix: number, valeur: number, unite: Unite) {
  const { famille, quantite } = toBase(valeur, unite);
  const ref = famille === "piece" ? 1 : 1000;
  return {
    famille,
    prix: Math.round((prix / quantite) * ref * 100) / 100,
    par: famille === "masse" ? "kg" : famille === "volume" ? "l" : "piece",
  };
}

export type Candidate = { id: number; ean?: string | null; marque?: string | null; valeur: number; unite: Unite; nom: string };

/** Appariement : EAN d'abord, sinon marque + format normalisé + nom normalisé. Tout doute → « incertain » (jamais publié automatiquement). */
export function matchProduct(
  src: Omit<Candidate, "id">,
  catalog: Candidate[],
): { kind: "certain" | "incertain" | "aucun"; productId?: number; score: number } {
  if (src.ean) {
    const hit = catalog.find((c) => c.ean === src.ean);
    if (hit) {
      const a=toBase(src.valeur,src.unite),b=toBase(hit.valeur,hit.unite);
      if(a.famille!==b.famille||Math.abs(a.quantite-b.quantite)>1e-6)return {kind:"incertain",productId:hit.id,score:0.5};
      return { kind: "certain", productId: hit.id, score: 1 };
    }
  }
  const sb = toBase(src.valeur, src.unite);
  let bestId: number | undefined;
  let best = 0;
  for (const c of catalog) {
    const cb = toBase(c.valeur, c.unite);
    const sameFormat = cb.famille === sb.famille && Math.abs(cb.quantite - sb.quantite) < 1e-6;
    const sameBrand = !!src.marque && !!c.marque && normalize(src.marque) === normalize(c.marque);
    const sameName = normalize(src.nom) === normalize(c.nom);
    const score = (sameFormat ? 0.3 : 0) + (sameBrand ? 0.3 : 0) + (sameName ? 0.4 : 0);
    if (score > best) {
      best = score;
      bestId = c.id;
    }
  }
  if (best >= 0.999) return { kind: "certain", productId: bestId, score: best };
  if (best > 0.3) return { kind: "incertain", productId: bestId, score: best };
  return { kind: "aucun", score: best };
}

/** Code-barres GTIN (EAN-8, UPC-12, EAN-13, GTIN-14) : chiffres uniquement et clé de contrôle correcte. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Une photo n'est acceptée que si elle vient des serveurs d'images d'Open Food Facts, en HTTPS. */
export function isOffImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "images.openfoodfacts.org";
  } catch {
    return false;
  }
}
