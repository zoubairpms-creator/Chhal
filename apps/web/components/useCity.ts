"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const KEY = "chhal_ville";

/** Villes et enseignes ; la ville choisie est mémorisée dans le navigateur. */
export function useRefs() {
  const [villes, setVilles] = useState<string[]>([]);
  const [enseignes, setEnseignes] = useState<{ slug: string; nom: string }[]>([]);
  const [ville, setVilleState] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([api<{ villes: string[] }>("/villes"), api<{ enseignes: { slug: string; nom: string }[] }>("/enseignes")])
      .then(([v, e]) => {
        setVilles(v.villes);
        setEnseignes(e.enseignes);
        let saved = "";
        try {
          saved = localStorage.getItem(KEY) ?? "";
        } catch {
          /* ignoré */
        }
        setVilleState((cur) => cur || (v.villes.includes(saved) ? saved : v.villes[0] || ""));
      })
      .catch(() => setError(true));
  }, []);

  const setVille = (v: string) => {
    setVilleState(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignoré */
    }
  };
  return { villes, enseignes, ville, setVille, error };
}
