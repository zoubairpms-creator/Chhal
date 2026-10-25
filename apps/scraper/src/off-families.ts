/**
 * Familles à rechercher dans Open Food Facts (produits vendus au Maroc).
 * `unites` : classes de format attendues (un format d'une autre classe est écarté : jamais de comparaison masse/volume).
 * `exclure` : noms à écarter (cosmétiques, produits hors famille…).
 * Les produits ménagers et d'hygiène ne sont pas dans Open Food Facts (autres bases du même projet) : hors périmètre ici.
 */
export type Classe = "masse" | "volume" | "piece";
export type FamilleOff = {
  slug: string;
  nom: string;
  categorie: "epicerie" | "frais" | "cremerie" | "boissons" | "charcuterie";
  termes: string[];
  unites: Classe[];
  exclure?: RegExp;
  /** Le nom, la marque ou les catégories doivent évoquer la famille : la recherche d'Open Food Facts est large (« eau de table » remonte pour « huile de table »). */
  pertinent?: RegExp;
};

const HORS_ALIMENTAIRE = /argan|ricin|cosm|shampo|massage|capillaire|apres-?shampo|savon|d[eé]odorant|parfum|cr[eè]me (pour|de) (peau|corps|visage)|bougie|encens/i;

export const FAMILLES_OFF: FamilleOff[] = [
  { slug: "riz", nom: "Riz", categorie: "epicerie", termes: ["riz"], unites: ["masse"], exclure: /gateau|dessert|lait de riz|galette|farine de riz|vinaigre/i },
  { slug: "sucre", nom: "Sucre", categorie: "epicerie", termes: ["sucre"], unites: ["masse"], exclure: /sans sucre|canne a sucre|bonbon/i },
  { slug: "farine", nom: "Farine", categorie: "epicerie", termes: ["farine"], unites: ["masse"] },
  { slug: "semoule", nom: "Semoule", categorie: "epicerie", termes: ["semoule"], unites: ["masse"] },
  { slug: "couscous", nom: "Couscous", categorie: "epicerie", termes: ["couscous"], unites: ["masse"] },
  { slug: "pates", nom: "Pâtes", categorie: "epicerie", termes: ["spaghetti", "pates alimentaires", "macaroni"], unites: ["masse"] },
  { slug: "vermicelles", nom: "Vermicelles", categorie: "epicerie", termes: ["vermicelle", "cheveux d'ange"], unites: ["masse"] },
  { slug: "huile-de-table", nom: "Huile de table", categorie: "epicerie", termes: ["huile de table", "huile vegetale", "huile de tournesol", "huile de soja"], unites: ["volume"], exclure: HORS_ALIMENTAIRE },
  { slug: "huile-d-olive", nom: "Huile d'olive", categorie: "epicerie", termes: ["huile d'olive"], unites: ["volume"], exclure: HORS_ALIMENTAIRE },
  { slug: "the", nom: "Thé", categorie: "epicerie", termes: ["the vert", "the noir", "the a la menthe"], unites: ["masse", "piece"], exclure: /glac[eé]|boisson|lait/i },
  { slug: "cafe", nom: "Café", categorie: "epicerie", termes: ["cafe moulu", "cafe soluble", "cafe"], unites: ["masse"], exclure: /boisson|glac[eé]|lait|capsule/i },
  { slug: "sel", nom: "Sel", categorie: "epicerie", termes: ["sel fin", "sel de table"], unites: ["masse"], exclure: /bain|dentifrice/i },
  { slug: "concentre-de-tomate", nom: "Concentré de tomate", categorie: "epicerie", termes: ["concentre de tomate", "tomate concentre"], unites: ["masse"] },
  { slug: "lentilles", nom: "Lentilles", categorie: "epicerie", termes: ["lentilles"], unites: ["masse"] },
  { slug: "pois-chiches", nom: "Pois chiches", categorie: "epicerie", termes: ["pois chiches"], unites: ["masse"] },
  { slug: "haricots", nom: "Haricots", categorie: "epicerie", termes: ["haricots blancs", "haricots"], unites: ["masse"] },
  { slug: "sardines", nom: "Sardines en conserve", categorie: "epicerie", termes: ["sardines"], unites: ["masse"] },
  { slug: "thon", nom: "Thon en conserve", categorie: "epicerie", termes: ["thon"], unites: ["masse"] },
  { slug: "confiture", nom: "Confiture", categorie: "epicerie", termes: ["confiture"], unites: ["masse"] },
  { slug: "miel", nom: "Miel", categorie: "epicerie", termes: ["miel"], unites: ["masse"], exclure: /shampo|cosm/i },
  { slug: "olives", nom: "Olives", categorie: "epicerie", termes: ["olives"], unites: ["masse"], exclure: HORS_ALIMENTAIRE },
  { slug: "harissa", nom: "Harissa", categorie: "epicerie", termes: ["harissa"], unites: ["masse"] },
  { slug: "biscuits", nom: "Biscuits", categorie: "epicerie", termes: ["biscuits"], unites: ["masse"] },
  { slug: "chocolat", nom: "Chocolat", categorie: "epicerie", termes: ["chocolat"], unites: ["masse"] },
  { slug: "pate-a-tartiner", nom: "Pâte à tartiner", categorie: "epicerie", termes: ["pate a tartiner"], unites: ["masse"] },
  { slug: "ketchup-mayonnaise", nom: "Ketchup et mayonnaise", categorie: "epicerie", termes: ["mayonnaise", "ketchup"], unites: ["masse", "volume"] },
  { slug: "cereales-petit-dejeuner", nom: "Céréales du petit-déjeuner", categorie: "epicerie", termes: ["cereales petit dejeuner", "corn flakes"], unites: ["masse"] },
  { slug: "lait", nom: "Lait", categorie: "cremerie", termes: ["lait demi-ecreme", "lait entier", "lait uht"], unites: ["volume"], exclure: /poudre|concentr|chocolat|coco|amande|soja|bebe|infantile|nettoyant|demaquillant/i },
  { slug: "lait-en-poudre", nom: "Lait en poudre", categorie: "cremerie", termes: ["lait en poudre"], unites: ["masse"] },
  { slug: "beurre", nom: "Beurre", categorie: "cremerie", termes: ["beurre"], unites: ["masse"], exclure: /cacahu|karit[eé]|corps|cacao|cosm|petit beurre/i },
  { slug: "margarine", nom: "Margarine", categorie: "cremerie", termes: ["margarine"], unites: ["masse"] },
  { slug: "yaourt", nom: "Yaourt", categorie: "cremerie", termes: ["yaourt"], unites: ["masse", "piece", "volume"] },
  { slug: "fromage", nom: "Fromage", categorie: "cremerie", termes: ["fromage"], unites: ["masse", "piece"] },
  { slug: "lben-raib", nom: "Lben et raïb", categorie: "cremerie", termes: ["lben", "raib", "ayran"], unites: ["volume", "masse"] },
  { slug: "creme-fraiche", nom: "Crème fraîche", categorie: "cremerie", termes: ["creme fraiche"], unites: ["masse", "volume"], exclure: /cosm|visage|corps|soin|bebe|baby|johns?on|jhonson/i },
  { slug: "jus", nom: "Jus", categorie: "boissons", termes: ["jus d'orange", "jus de fruits", "nectar"], unites: ["volume"] },
  { slug: "boisson-gazeuse", nom: "Boisson gazeuse", categorie: "boissons", termes: ["soda", "boisson gazeuse", "limonade"], unites: ["volume"] },
  { slug: "eau", nom: "Eau minérale", categorie: "boissons", termes: ["eau minerale", "eau de source"], unites: ["volume"], exclure: /florale|rose|parfum|cosm|micellaire|gaz de/i },
  { slug: "boisson-energisante", nom: "Boisson énergisante", categorie: "boissons", termes: ["boisson energisante", "energy drink"], unites: ["volume"] },
  { slug: "charcuterie-dinde", nom: "Charcuterie de dinde", categorie: "charcuterie", termes: ["dinde"], unites: ["masse"] },
];

/** Mots (français et catégories anglaises d'Open Food Facts) qui rattachent un produit à sa famille. Testés sur le texte sans accents. */
const PERTINENCE: Record<string, RegExp> = {
  riz: /\briz\b|\brice\b|\brices\b/,
  sucre: /\bsucre|\bsugar/,
  farine: /\bfarine|\bflour/,
  semoule: /\bsemoule|\bsemolina/,
  couscous: /couscous/,
  pates: /\bpates\b|spaghetti|macaroni|\bpasta|coquillette|tagliatelle|\bpenne\b|fusilli/,
  vermicelles: /vermicel|cheveux d'ange|chaaria/,
  "huile-de-table": /^(?!.*olive).*(\bhuile|\boils?\b)/,
  "huile-d-olive": /olive/,
  the: /\bthe\b|\bteas?\b|infusion|\bmenthe/,
  cafe: /\bcafe\b|coffee|cappuccino|expresso|espresso|nescafe/,
  sel: /\bsel\b|\bsalt\b/,
  "concentre-de-tomate": /concentre|tomate|tomato/,
  lentilles: /lentille|lentil/,
  "pois-chiches": /pois chiche|chickpea|hommos/,
  haricots: /haricot|\bbeans?\b|loubia/,
  sardines: /sardine/,
  thon: /\bthon\b|\btuna\b/,
  confiture: /confiture|\bjams?\b|marmelade/,
  miel: /\bmiel\b|\bhoney\b/,
  olives: /^(?!.*(huile|\boil)).*olive/,
  harissa: /harissa/,
  biscuits: /biscuit|cookie|gaufrette|wafer|cracker/,
  chocolat: /chocolat|chocolate|cacao|cocoa/,
  "pate-a-tartiner": /tartiner|spread|nutella|noisette/,
  "ketchup-mayonnaise": /ketchup|mayonnaise|\bsauces?\b/,
  "cereales-petit-dejeuner": /cereal|corn flakes|muesli|granola|flocons/,
  lait: /\blait\b|\bmilk\b/,
  "lait-en-poudre": /poudre|powder/,
  beurre: /beurre|butter/,
  margarine: /margarine/,
  yaourt: /yaourt|yogurt|yoghurt/,
  fromage: /fromage|cheese|\bjben\b/,
  "lben-raib": /lben|raib|ayran|buttermilk|lait fermente|fermented-milk/,
  "creme-fraiche": /\bcreme\b|\bcream\b/,
  jus: /\bjus\b|\bjuices?\b|nectar/,
  "boisson-gazeuse": /\bsoda|\bgaz|limonade|\bcola\b|soft-drinks|carbonated|lemonade/,
  eau: /\beau\b|\bwaters?\b/,
  "boisson-energisante": /energ|energy|red bull|monster/,
  "charcuterie-dinde": /dinde|turkey/,
};
for (const f of FAMILLES_OFF) f.pertinent = PERTINENCE[f.slug];
