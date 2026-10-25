/**
 * Familles de produits : regroupent les variantes (marques, formats) d'un même article.
 * `classe` = classe de format commune à TOUTES les variantes (masse, volume ou pièce) : jamais de comparaison entre classes.
 * Source de vérité unique : la migration 0005 et les semis en sont dérivés (un test vérifie leur cohérence).
 */
export type Classe = "masse" | "volume" | "piece";
export type Langue = "fr" | "ar" | "darija" | "en";
export type FamilleDef = {
  slug: string;
  nom: { fr: string; ar: string; en: string };
  categorie: string;
  classe: Classe;
  alias: { texte: string; langue: Langue }[];
};

const F = (slug: string, fr: string, ar: string, en: string, categorie: string, classe: Classe, darija: string[] = [], extra: { texte: string; langue: Langue }[] = []): FamilleDef => ({
  slug, nom: { fr, ar, en }, categorie, classe,
  alias: [{ texte: fr, langue: "fr" }, { texte: ar, langue: "ar" }, { texte: en, langue: "en" }, ...darija.map((texte) => ({ texte, langue: "darija" as const })), ...extra],
});

export const FAMILLES: FamilleDef[] = [
  // Épicerie
  F("riz", "Riz", "رز", "Rice", "epicerie", "masse", ["rouz"]),
  F("sucre", "Sucre", "سكر", "Sugar", "epicerie", "masse", ["skkar"]),
  F("farine", "Farine", "دقيق", "Flour", "epicerie", "masse", ["d9i9"]),
  F("semoule", "Semoule", "سميد", "Semolina", "epicerie", "masse", ["smid"]),
  F("couscous", "Couscous", "كسكس", "Couscous", "epicerie", "masse", ["kseksou"]),
  F("pates", "Pâtes", "معكرونة", "Pasta", "epicerie", "masse", ["makarona"], [{ texte: "spaghetti", langue: "fr" }]),
  F("vermicelles", "Vermicelles", "شعرية", "Vermicelli", "epicerie", "masse", ["chaaria"]),
  F("huile-de-table", "Huile de table", "زيت المائدة", "Cooking oil", "epicerie", "volume", ["zit"], [{ texte: "huile", langue: "fr" }, { texte: "زيت", langue: "ar" }, { texte: "oil", langue: "en" }]),
  F("huile-d-olive", "Huile d'olive", "زيت الزيتون", "Olive oil", "epicerie", "volume", ["zit zitoun"]),
  F("the", "Thé", "شاي", "Tea", "epicerie", "masse", ["atay"], [{ texte: "the", langue: "fr" }]),
  F("cafe", "Café", "قهوة", "Coffee", "epicerie", "masse", ["qahwa"], [{ texte: "cafe", langue: "fr" }]),
  F("sel", "Sel", "ملح", "Salt", "epicerie", "masse", ["melha"]),
  F("concentre-de-tomate", "Concentré de tomate", "معجون الطماطم", "Tomato paste", "epicerie", "masse", ["tmatich m3ajen"]),
  F("lentilles", "Lentilles", "عدس", "Lentils", "epicerie", "masse", ["3ads"]),
  F("pois-chiches", "Pois chiches", "حمص", "Chickpeas", "epicerie", "masse", ["hommos"]),
  F("haricots", "Haricots", "لوبيا", "Beans", "epicerie", "masse", ["loubia"]),
  F("sardines", "Sardines en conserve", "سردين معلب", "Canned sardines", "epicerie", "masse", ["sardine"]),
  F("thon", "Thon en conserve", "تونة", "Canned tuna", "epicerie", "masse", ["tun"]),
  F("confiture", "Confiture", "مربى", "Jam", "epicerie", "masse", ["mrabba"]),
  F("miel", "Miel", "عسل", "Honey", "epicerie", "masse", ["3assel"]),
  F("olives", "Olives", "زيتون", "Olives", "epicerie", "masse", ["zitoun"]),
  F("harissa", "Harissa", "هريسة", "Harissa", "epicerie", "masse", ["harissa"]),
  F("biscuits", "Biscuits", "بسكويت", "Biscuits", "epicerie", "masse", ["biscuit"]),
  F("chocolat", "Chocolat", "شوكولاطة", "Chocolate", "epicerie", "masse", ["chocolat"]),
  F("pate-a-tartiner", "Pâte à tartiner", "معجون الشوكولاطة", "Chocolate spread", "epicerie", "masse", ["nutella"]),
  F("ketchup-mayonnaise", "Ketchup et mayonnaise", "كاتشاب ومايونيز", "Ketchup and mayonnaise", "epicerie", "masse", ["ketchup", "mayonnaise"]),
  F("cereales-petit-dejeuner", "Céréales du petit-déjeuner", "رقائق الحبوب", "Breakfast cereals", "epicerie", "masse", ["corn flakes"]),
  // Crèmerie et frais
  F("lait", "Lait", "حليب", "Milk", "cremerie", "volume", ["halib"]),
  F("lait-en-poudre", "Lait en poudre", "حليب مجفف", "Powdered milk", "cremerie", "masse", ["halib poudre"]),
  F("beurre", "Beurre", "زبدة", "Butter", "cremerie", "masse", ["zebda"]),
  F("margarine", "Margarine", "مرغرين", "Margarine", "cremerie", "masse", ["margarine"]),
  F("yaourt", "Yaourt", "زبادي", "Yogurt", "cremerie", "piece", ["yaourt"]),
  F("fromage", "Fromage", "جبن", "Cheese", "cremerie", "masse", ["jben"]),
  F("lben-raib", "Lben et raïb", "لبن ورايب", "Lben and raïb", "cremerie", "volume", ["lben", "raib", "ayran"]),
  F("creme-fraiche", "Crème fraîche", "كريمة طرية", "Cream", "cremerie", "masse", ["creme"]),
  F("oeufs", "Œufs", "بيض", "Eggs", "frais", "piece", ["bid"], [{ texte: "oeufs", langue: "fr" }]),
  F("charcuterie-dinde", "Charcuterie de dinde", "لحم الديك الرومي", "Turkey cold cuts", "charcuterie", "masse", ["dinde"]),
  F("poulet", "Poulet", "دجاج", "Chicken", "frais", "masse", ["djaj"]),
  F("viande-hachee", "Viande hachée", "لحم مفروم", "Minced beef", "frais", "masse", ["kefta"]),
  F("viande-boeuf", "Viande de bœuf", "لحم بقري", "Beef", "frais", "masse", ["lham"]),
  F("pain", "Pain", "خبز", "Bread", "frais", "piece", ["khobz"]),
  // Fruits et légumes
  F("pommes-de-terre", "Pommes de terre", "بطاطس", "Potatoes", "frais", "masse", ["batata"]),
  F("tomates", "Tomates", "طماطم", "Tomatoes", "frais", "masse", ["matisha"]),
  F("oignons", "Oignons", "بصل", "Onions", "frais", "masse", ["bsla"]),
  F("carottes", "Carottes", "جزر", "Carrots", "frais", "masse", ["khizzou"]),
  F("bananes", "Bananes", "موز", "Bananas", "frais", "masse", ["banane"]),
  F("pommes", "Pommes", "تفاح", "Apples", "frais", "masse", ["tefah"]),
  F("oranges", "Oranges", "برتقال", "Oranges", "frais", "masse", ["limoun"]),
  // Boissons
  F("jus", "Jus", "عصير", "Juice", "boissons", "volume", ["3asir"]),
  F("boisson-gazeuse", "Boisson gazeuse", "مشروب غازي", "Soft drink", "boissons", "volume", ["gazouz"], [{ texte: "soda", langue: "fr" }]),
  F("eau", "Eau minérale", "ماء", "Mineral water", "boissons", "volume", ["lma"], [{ texte: "eau", langue: "fr" }]),
  F("boisson-energisante", "Boisson énergisante", "مشروب الطاقة", "Energy drink", "boissons", "volume", ["energy"]),
  // Entretien et hygiène
  F("lessive", "Lessive", "مسحوق الغسيل", "Laundry detergent", "menage", "masse", ["lessive", "tide"]),
  F("liquide-vaisselle", "Liquide vaisselle", "سائل الأطباق", "Dish soap", "menage", "volume", ["sabon dyal lmwaa3en"]),
  F("eau-de-javel", "Eau de Javel", "ماء جافيل", "Bleach", "menage", "volume", ["javel"]),
  F("nettoyant-sol", "Nettoyant sol", "منظف الأرضية", "Floor cleaner", "menage", "volume", ["nettoyant"]),
  F("savon", "Savon de toilette", "صابون", "Bar soap", "hygiene", "masse", ["saboun"]),
  F("savon-liquide", "Savon liquide", "صابون سائل", "Liquid soap", "hygiene", "volume", ["saboun"]),
  F("dentifrice", "Dentifrice", "معجون الأسنان", "Toothpaste", "hygiene", "volume", ["dentifrice"]),
  F("shampoing", "Shampoing", "شامبو", "Shampoo", "hygiene", "volume", ["shampooing"]),
  F("papier-toilette", "Papier toilette", "ورق المرحاض", "Toilet paper", "hygiene", "piece", ["papier"]),
];

/**
 * Rattrapage : slug de produit → famille. Les produits absents (ambigus ou d'une autre classe de format que leur famille probable)
 * restent SANS famille : mieux vaut ne pas comparer que comparer des produits non équivalents.
 */
export const FAMILLE_DE_PRODUIT: Record<string, string> = {
  // Catalogue de base
  "riz-long-grain-1kg": "riz", "sucre-1kg": "sucre", "farine-ble-5kg": "farine", "semoule-fine-1kg": "semoule", "couscous-1kg": "couscous",
  "pates-spaghetti-500g": "pates", "vermicelles-500g": "vermicelles", "huile-table-1l": "huile-de-table", "huile-olive-1l": "huile-d-olive",
  "the-vert-200g": "the", "cafe-moulu-250g": "cafe", "sel-fin-1kg": "sel", "concentre-tomate-400g": "concentre-de-tomate", "lentilles-1kg": "lentilles",
  "pois-chiches-1kg": "pois-chiches", "haricots-blancs-1kg": "haricots", "sardines-conserve-125g": "sardines", "thon-conserve-160g": "thon",
  "confiture-370g": "confiture", "miel-500g": "miel", "olives-500g": "olives",
  "lait-demi-ecreme-1l": "lait", "beurre-1kg": "beurre", "oeufs-plateau-30": "oeufs", "yaourt-nature-x4": "yaourt", "poulet-frais-1kg": "poulet",
  "viande-hachee-1kg": "viande-hachee", "viande-boeuf-1kg": "viande-boeuf", "pain-baguette": "pain", "pommes-de-terre-1kg": "pommes-de-terre",
  "tomates-1kg": "tomates", "oignons-1kg": "oignons", "carottes-1kg": "carottes", "bananes-1kg": "bananes", "pommes-1kg": "pommes", "oranges-1kg": "oranges",
  "eau-minerale-1-5l": "eau", "eau-minerale-5l": "eau", "soda-1l": "boisson-gazeuse", "jus-orange-1l": "jus",
  "lessive-poudre-3kg": "lessive", "liquide-vaisselle-1l": "liquide-vaisselle", "eau-de-javel-1l": "eau-de-javel", "nettoyant-sol-1l": "nettoyant-sol",
  "savon-liquide-250ml": "savon-liquide", "shampoing-400ml": "shampoing", "dentifrice-75ml": "dentifrice", "papier-toilette-x12": "papier-toilette",
  // Relevé de référence (beurre)
  "beurre-centrale-1kg": "beurre",
  // Catalogue BIM du 1er septembre 2026 (slugs dérivés des noms)
  "eau-minerale-ain-saiss": "eau", "coca-cola-vanille-ou-cerise": "boisson-gazeuse", "monster-mangue": "boisson-energisante", "ayran-piknik": "lben-raib",
  "margarine-luxmar": "margarine", "tranches-de-dinde-genial": "charcuterie-dinde", "supreme-filet-de-dinde-dindy": "charcuterie-dinde", "harissa-oualili": "harissa",
};
