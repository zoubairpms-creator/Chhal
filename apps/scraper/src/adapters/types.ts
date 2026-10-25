import type { Unite } from "@chhal/matching";

export type Releve = {
  libelle: string;
  ean?: string;
  marque?: string;
  valeur: number;
  unite: Unite;
  prixMad: number;
};

export type Adapter = {
  /** Identifiant d'enseigne, identique au `slug` de la table chains. */
  slug: string;
  /** Désactivé par défaut : un adaptateur n'est activé qu'après vérification de robots.txt et des conditions d'utilisation. */
  enabled: boolean;
  /** Nature de la source : « scraping » (site de l'enseigne) ou « catalogue » (prospectus ou article tiers). Défaut : scraping. */
  source?: "scraping" | "catalogue";
  /**
   * Pages à lire. `dateReleve` = date de validité des prix lus (ex. date du catalogue) ;
   * absente, c'est la date du jour de lecture qui est utilisée.
   */
  pages: { ville: string; url: string; dateReleve?: string }[];
  parse(html: string): Releve[];
};
