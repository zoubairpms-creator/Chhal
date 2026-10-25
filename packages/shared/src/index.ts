import { z } from "zod";

export const prixItemSchema = z.object({
  enseigne: z.string(),
  enseigneAr: z.string().nullable(),
  ville: z.string(),
  prixMad: z.number().positive(),
  dateReleve: z.string(),
  source: z.enum(["scraping", "manuel", "crowd", "photo", "catalogue", "fixture"]),
  confiance: z.enum(["haute", "moyenne", "basse"]),
});

export const prixReponseSchema = z.object({
  produit: z.object({ id: z.number(), nom: z.string(), format: z.string() }),
  ville: z.string(),
  resultats: z.array(prixItemSchema),
});
export type PrixReponse = z.infer<typeof prixReponseSchema>;

export const prixQuerySchema = z.object({
  ville: z.string().min(1),
  enseigne: z.string().optional(),
});
