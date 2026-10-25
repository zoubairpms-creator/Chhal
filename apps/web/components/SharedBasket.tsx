"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@chhal/i18n";
import { api, type BasketResult } from "@/lib/api";
import { BasketResultView } from "./BasketResultView";

export function SharedBasket({ locale, token }: { locale: Locale; token: string }) {
  const [r, setR] = useState<BasketResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api<BasketResult>(`/paniers/${encodeURIComponent(token)}`)
      .then(setR)
      .catch((e) => setErr(e.message));
  }, [token]);
  if (err)
    return (
      <p className="error" role="alert">
        {err}
      </p>
    );
  if (!r) return <p className="muted">{t(locale, "common.loading")}</p>;
  async function recalculate(){try{setR(await api<BasketResult>("/paniers/"+encodeURIComponent(token)+"/recalculer",{method:"POST"}));}catch(e){setErr((e as Error).message);}}
  return (
    <>
      <h1>
        {t(locale, "basket.title")} — {r.ville}
      </h1>
      <p className="no-print">
        <a href={`/${locale}/rapport/panier/${encodeURIComponent(token)}`}>{t(locale, "report.open")} →</a>
      </p>
      <p className="warn">{t(locale,"v1.snapshot",{date:r.dateReference})}</p><button onClick={recalculate}>{t(locale,"v1.recalculate")}</button>
      <BasketResultView locale={locale} r={r} />
    </>
  );
}
