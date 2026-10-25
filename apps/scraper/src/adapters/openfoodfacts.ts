/**
 * Adaptateur Open Food Facts — enrichissement du catalogue par EAN.
 *
 * Open Food Facts est une base de données ouverte (licence ODbL) contenant
 * des informations descriptives sur les produits alimentaires : EAN, nom, marque,
 * catégorie, ingrédients, nutrition, images.
 *
 * IMPORTANT : Open Food Facts ne contient PAS de prix de supermarché.
 * Ce connecteur sert uniquement à l'enrichissement du catalogue canonique.
 *
 * API : https://world.openfoodfacts.org/api/v2/product/{ean}.json
 * Rate limit : 15 req/min/IP pour les requêtes produit.
 * User-Agent obligatoire : AppName/Version (ContactEmail).
 */

// Le contact est configurable (SCRAPER_CONTACT) : aucune adresse personnelle n'est inscrite en dur dans le code.
export const USER_AGENT_OFF = `Chhal/1.0 (comparateur de prix Maroc; contact: ${process.env.SCRAPER_CONTACT ?? "non configuré"})`;

export type OffProduct = {
  code: string;
  product_name: string;
  brands: string;
  categories: string;
  quantity: string;
  image_url: string | null;
  ean: string;
};

/**
 * Recherche un produit par EAN sur Open Food Facts.
 * Retourne null si le produit n'est pas trouvé.
 */
export async function lookupByEan(ean: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=code,product_name,brands,categories,quantity,image_front_url`;
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT_OFF },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  return {
    code: p.code || ean,
    product_name: p.product_name || "",
    brands: p.brands || "",
    categories: p.categories || "",
    quantity: p.quantity || "",
    image_url: p.image_front_url || null,
    ean: p.code || ean,
  };
}

/**
 * Recherche des produits par nom sur search-a-licious.
 * Retourne une liste de produits correspondants.
 */
export async function searchByName(query: string, size = 5): Promise<OffProduct[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&size=${size}&fields=code,product_name,brands,quantity,categories_tags`;
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT_OFF },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const hits = data.hits || [];
  return hits.map((h: any) => ({
    code: h.code || "",
    product_name: h.product_name || h.product_name_fr || h.product_name_en || "",
    brands: (h.brands_tags || []).join(", "),
    categories: (h.categories_tags || []).join(", "),
    quantity: h.quantity || "",
    image_url: h.image_front_url || null,
    ean: h.code || "",
  }));
}
