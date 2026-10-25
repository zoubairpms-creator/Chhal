"use client";
import { useSyncExternalStore } from "react";
import {validItem} from "./shopping";

/** Ligne précise : un produit, une quantité de paquets. */
export type ProduitItem = { produitId: number; nom: string; quantite: number };
/** Ligne famille : « n'importe quelle marque », quantité en kg, litres ou pièces. */
export type FamilleItem = { famille: string; nom: string; noms?: { fr: string; ar: string; en: string }; quantiteBase: number; unite: "kg" | "l" | "piece" };
export type BasketItem = ProduitItem | FamilleItem;

export const estFamille = (i: BasketItem): i is FamilleItem => "famille" in i;
/** Pas de quantité : 0,5 kg ou 0,5 L ; 1 pièce. */
export const pasDeFamille = (unite: FamilleItem["unite"]) => (unite === "piece" ? 1 : 0.5);

const KEY = "chhal_basket";
const EVT = "chhal:basket";
const EMPTY: BasketItem[] = [];

let cache: BasketItem[] = EMPTY;
let loaded = false;

const valide=validItem;

function read(): BasketItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter(valide) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function snapshot(): BasketItem[] {
  if (!loaded) {
    cache = read();
    loaded = true;
  }
  return cache;
}

function write(next: BasketItem[]) {
  cache = next.length ? next : EMPTY;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : le panier reste en mémoire */
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  const onLocal = () => cb();
  const onStorage = () => {
    cache = read();
    cb();
  };
  window.addEventListener(EVT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

/** Corps `articles` attendu par l'API. */
export function toArticles(items: BasketItem[]) {
  return items.map((i) => (estFamille(i) ? { famille: i.famille, quantiteBase: i.quantiteBase, unite: i.unite } : { produitId: i.produitId, quantite: i.quantite }));
}

export function useBasket() {
  const items = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const clamp = (q: number) => Math.max(1, Math.min(99, Math.round(q) || 1));
  const clampBase = (q: number) => Math.max(0.1, Math.min(99, Math.round(q * 100) / 100));
  const produits = items.filter((i): i is ProduitItem => !estFamille(i));
  const famille = (slug: string) => items.find((i): i is FamilleItem => estFamille(i) && i.famille === slug);
  return {
    items,
    /** Nombre de lignes à acheter : paquets des lignes précises + une unité par ligne famille. */
    count: produits.reduce((n, i) => n + i.quantite, 0) + (items.length - produits.length),
    qtyOf: (id: number) => produits.find((i) => i.produitId === id)?.quantite ?? 0,
    qtyOfFamille: (slug: string) => famille(slug)?.quantiteBase ?? 0,
    add: (p: { produitId: number; nom: string }) =>
      write(
        produits.some((i) => i.produitId === p.produitId)
          ? items.map((i) => (!estFamille(i) && i.produitId === p.produitId ? { ...i, quantite: clamp(i.quantite + 1) } : i))
          : [...items, { ...p, quantite: 1 }],
      ),
    setQty: (id: number, q: number) => write(items.map((i) => (!estFamille(i) && i.produitId === id ? { ...i, quantite: clamp(q) } : i))),
    decrement: (id: number) => write(items.flatMap((i) => (estFamille(i) || i.produitId !== id ? [i] : i.quantite <= 1 ? [] : [{ ...i, quantite: i.quantite - 1 }]))),
    remove: (id: number) => write(items.filter((i) => estFamille(i) || i.produitId !== id)),
    addFamille: (f: { famille: string; nom: string; noms?: FamilleItem["noms"]; unite: FamilleItem["unite"] }) => {
      const pas = pasDeFamille(f.unite);
      write(
        famille(f.famille)
          ? items.map((i) => (estFamille(i) && i.famille === f.famille ? { ...i, quantiteBase: clampBase(i.quantiteBase + pas) } : i))
          : [...items, { famille: f.famille, nom: f.nom, ...(f.noms ? { noms: f.noms } : {}), quantiteBase: pas, unite: f.unite }],
      );
    },
    decrementFamille: (slug: string) =>
      write(items.flatMap((i) => (!estFamille(i) || i.famille !== slug ? [i] : i.quantiteBase - pasDeFamille(i.unite) < 0.1 ? [] : [{ ...i, quantiteBase: clampBase(i.quantiteBase - pasDeFamille(i.unite)) }]))),
    removeFamille: (slug: string) => write(items.filter((i) => !estFamille(i) || i.famille !== slug)),
    replaceAll: (next: BasketItem[]) => write(next.filter(valide).slice(0,50)),
    clear: () => write([]),
  };
}
