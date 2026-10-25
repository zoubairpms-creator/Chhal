"use client";
import { useState } from "react";
import type { ProduitImage } from "@/lib/api";

const ICONS: Record<string, string> = { epicerie: "🛒", frais: "🥬", cremerie: "🥛", boissons: "🥤", charcuterie: "🥩", menage: "🧴", hygiene: "🧼" };

/** Photo du produit (hotlink sécurisé, chargement différé) ; repli sur une icône de catégorie si absente ou en erreur. */
export function ProductPhoto({ image, categorie, nom, size = 64 }: { image: ProduitImage | null; categorie: string | null; nom: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: 10, background: "var(--ok-bg)", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" } as const;
  if (!image || failed) {
    return (
      <div style={{ ...box, fontSize: size * 0.5 }} aria-hidden="true">
        {ICONS[categorie ?? ""] ?? "🛒"}
      </div>
    );
  }
  return (
    <div style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={nom} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ objectFit: "contain", width: "100%", height: "100%", background: "#fff" }} />
    </div>
  );
}

/** Mention de licence obligatoire (CC BY-SA) avec lien vers la fiche d'origine. */
export function PhotoCredit({ image }: { image: ProduitImage | null }) {
  if (!image) return null;
  return (
    <p className="muted small">
      {image.credit ?? "Photo : Open Food Facts, CC BY-SA"}
      {image.ficheUrl && (
        <>
          {" · "}
          <a href={image.ficheUrl} target="_blank" rel="noopener noreferrer">
            fiche
          </a>
        </>
      )}
    </p>
  );
}
