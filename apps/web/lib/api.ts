// Par défaut : même origine (/api-proxy, relayé par Next vers l'API). Évite tout réglage pour le téléphone, le tunnel et le mode hors ligne.
export const API = process.env.NEXT_PUBLIC_API_URL ?? "/api-proxy";

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { ...(init?.body ? { "content-type": "application/json" } : {}) };
  if (init?.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const body = await res.json().catch(() => ({}));
  if(res.headers?.get("x-chhal-offline")==="1" && typeof window!=="undefined")window.dispatchEvent(new CustomEvent("chhal:offline-snapshot",{detail:res.headers.get("x-chhal-cached-at")}));
  if (!res.ok) throw new ApiError(body.erreur ?? "Erreur", res.status, body.erreurs);
  return body as T;
}

export type PriceTrace = {validFrom?:string|null;validUntil?:string|null;validityStatus?:string|null;sourceUrl?:string|null;observedAt?:string|null;confianceMotif?:string|null};
export type Prix = PriceTrace & {
  enseigne: string; enseigneAr: string | null; ville: string; prixMad: number;
  prixUnitaire: { prix: number; par: string }; dateReleve: string; source: string; confiance: string; donneesDeTest: boolean;
  rang: number; ecartVsPlusCherPct: number;
};
export type Top3Item = PriceTrace & { rang: number; enseigne: string; prixMad: number; dateReleve: string; source: string; ecartVsPlusCherPct: number };
export type ProduitImage = { url: string; credit: string | null; ficheUrl: string | null };
export type ProduitHit = {
  id: number; nom: string; marque: string | null; categorie: string | null; format: string;
  famille: string | null; image: ProduitImage | null;
  top3: Top3Item[]; nbEnseignes: number;
  meilleurPrix: { enseigne: string; prixMad: number; dateReleve: string; source: string } | null;
};
export type NomsFamille = { fr: string; ar: string; en: string };
export type FamilleTop = PriceTrace & {
  rang: number; produitId: number; produit: string; marque: string | null; format: string; enseigne: string; prixMad: number;
  prixUnitaire: number; par: string; dateReleve: string; source: string; ecartVsPlusCherPct: number;
};
export type Groupe = {
  famille: string; nom: NomsFamille; classe: "masse" | "volume" | "piece"; categorie: string; score: number;
  nbVariantes: number; nbVariantesAvecPrix: number; meilleurPrixUnitaire: FamilleTop | null; top3: FamilleTop[];
  variantes: (ProduitHit & { meilleurPrixUnitaire: { prix: number; par: string | null } | null })[];
};
export type LigneFamille = { nom: NomsFamille; quantiteDemandee: number; unite: string; quantiteAchetee: number; surplus: number; marque: string | null; format: string };
export type BasketResult = {
  ville: string; algorithme: string; dateReference: string; totalMad: number; economieMad: number | null; donneesDeTest: boolean;
  parametres: { ageMaxJours: number };
  plan: { enseigne: string; sousTotalMad: number; articles: (PriceTrace & { produitId: number; nom: string; quantite: number; prixUnitaireMad: number; totalMad: number; dateReleve: string; source: string; famille?: string | null; ligneFamille?: LigneFamille | null })[] }[];
  meilleurMonoMagasin: { enseigne: string; totalMad: number; articlesCouverts: number; totalOptimiseMemesArticlesMad: number } | null;
  exclus: { produitId: number | null; famille?: string | null; nom: string; raison: string }[];
};
export type BasketOption =
  | { cle: string; maxMagasins: number | null; disponible: true; nbMagasins: number; totalMad: number; articlesCouverts: number; articlesDemandes: number; resultat: BasketResult }
  | { cle: string; maxMagasins: number | null; disponible: false; raison: string };
export type Comparison = { ville: string; options: BasketOption[]; recommande: string | null };

export type MatrixCell = { enseigne: string; exclue: boolean; prixMad: number | null; dateReleve: string | null; source: string | null; perime: boolean; donneesDeTest: boolean; detail?: string | null };
export type BasketReport = {
  genereLe: string; dateReference: string; ville: string; algorithme: string; enseignes: string[];
  parametres: { enseignesExclues: string[]; ageMaxJours: number };
  options: BasketOption[]; recommande: string | null;
  matrice: { produitId: number | null; famille?: string | null; nom: string; format: string; quantite: number; meilleur: { enseigne: string; prixMad: number; prixUnitaire: { prix: number; par: string } } | null; prix: MatrixCell[] }[];
  sources: { types: string[]; dateMin: string | null; dateMax: string | null };
  donneesDeTest: boolean;
  panierEnregistre?: { token: string; creeLe: string; algorithme: string };
};
export type ProductReport = {
  genereLe: string; dateReference: string; ville: string;
  produit: { id: number; slug: string; nom: string; marque: string | null; categorie: string | null; format: string };
  prix: (Prix & { ageJours: number })[];
  top3: Prix[];
  stats: { nbEnseignes: number; min: number; max: number; mediane: number; moyenne: number; ecartMad: number; ecartPct: number } | null;
  historique: { enseigne: string; points: { date: string; prixMad: number; source: string }[]; variationPct: number | null }[];
  donneesDeTest: boolean;
};
