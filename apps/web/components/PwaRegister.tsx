"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@chhal/i18n";

/** Enregistre le service worker (HTTPS ou localhost, production) et signale le mode hors ligne. */
export function PwaRegister({ locale }: { locale: Locale }) {
  const [online, setOnline] = useState(true);
  const [back, setBack] = useState(false);
  const [cachedAt,setCachedAt]=useState<string|null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non bloquant : l'app fonctionne sans mode hors ligne */
      });
    }
    setOnline(navigator.onLine);
    const goOffline = () => {
      setOnline(false);
      setBack(false);
    };
    const goOnline = () => {
      setOnline(true);
      setBack(true);
      setTimeout(() => setBack(false), 3000);
    };
    const snapshot=(e:Event)=>setCachedAt((e as CustomEvent<string>).detail);
    window.addEventListener("chhal:offline-snapshot",snapshot);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("chhal:offline-snapshot",snapshot);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if(cachedAt)return <div className="net-banner" role="status">{t(locale,"v1.cacheSnapshot",{date:new Date(cachedAt).toLocaleString(locale==="ar"?"ar-MA":locale)})}</div>;
  if (online && !back) return null;
  return (
    <div className={`net-banner no-print ${online ? "ok" : ""}`} role="status" aria-live="polite">
      {online ? t(locale, "pwa.online") : t(locale, "pwa.offline")}
    </div>
  );
}
