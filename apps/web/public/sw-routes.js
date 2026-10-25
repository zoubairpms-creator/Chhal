/* Choix de la stratégie de cache selon la requête. Partagé par le service worker et les tests. */
function chhalStrategy(pathname, method, mode) {
  if (method !== "GET") return "network-only"; // jamais de cache pour les écritures
  if (pathname.indexOf("/api-proxy/admin") === 0) return "network-only"; // jamais de données d'administration en cache
  if (pathname.indexOf("/admin") !== -1 && mode === "navigate") return "network-only";
  if (pathname.indexOf("/_next/static/") === 0 || pathname.indexOf("/icons/") === 0) return "cache-first";
  if (pathname.indexOf("/api-proxy/") === 0) return "network-first-data";
  if (mode === "navigate") return "network-first-page";
  return "network-only";
}

if (typeof module !== "undefined" && module.exports) module.exports = { chhalStrategy: chhalStrategy };
