"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { t, type Locale } from "@chhal/i18n";
import { api } from "@/lib/api";
import { useBasket } from "@/lib/basket";

type Names = { fr: string; ar: string; en: string };
type Preset = { slug: string; profil: string; nom: Names; description: Names; menage: number; nbArticles: number };
type Detail = { articles: { produitId: number; nom: string; quantite: number }[]; lignesFamille: { famille: string; nom: Names; quantiteBase: number; unite: "kg" | "l" | "piece" }[]; manquants: string[] };

export function PresetsView({ locale }: { locale: Locale }) {
  const router = useRouter();
  const basket = useBasket();
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    api<{ paniers: Preset[] }>("/paniers-prets")
      .then((r) => setPresets(r.paniers))
      .catch(() => setError(t(locale, "common.error")));
  }, [locale]);

  async function load(slug: string) {
    setLoading(slug);
    try {
      const d = await api<Detail>(`/paniers-prets/${slug}`);
      basket.replaceAll([
        ...d.articles.map((a) => ({ produitId: a.produitId, nom: a.nom, quantite: a.quantite })),
        ...d.lignesFamille.map((l) => ({ famille: l.famille, nom: l.nom[locale], noms: l.nom, quantiteBase: l.quantiteBase, unite: l.unite })),
      ]);
      router.push(`/${locale}/panier`);
    } catch (e) {
      setError((e as Error).message || t(locale, "common.error"));
      setLoading(null);
    }
  }

  const household = presets?.[0]?.menage ?? 4;
  return (
    <>
      <h1>{t(locale, "presets.title")}</h1>
      <p className="muted">{t(locale, "presets.intro")}</p>
      <div className="warn" role="note">
        {t(locale, "presets.indicative", { n: household })}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!presets && !error && (
        <div aria-busy="true">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      )}
      <div className="options">
        {presets?.map((p) => (
          <article className="card" key={p.slug}>
            <h2 style={{ marginTop: 0 }}>{p.nom[locale]}</h2>
            <p>{p.description[locale]}</p>
            <p className="muted">
              {t(locale, "presets.items", { n: p.nbArticles })} · {t(locale, "presets.household", { n: p.menage })}
            </p>
            <button disabled={loading !== null} onClick={() => load(p.slug)}>
              {loading === p.slug ? t(locale, "common.loading") : t(locale, "presets.load")}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
