import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("client API", () => {
  it("renvoie le corps JSON en cas de succès", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ villes: ["Casablanca"] }) })));
    expect(await api<{ villes: string[] }>("/villes")).toEqual({ villes: ["Casablanca"] });
  });

  it("transforme une erreur serveur en ApiError avec le message français", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ erreur: "Magasin inconnu pour cette enseigne et cette ville." }) })));
    const err: ApiError = await api("/contributions", { method: "POST", body: "{}" }).catch((e: ApiError) => e) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/Magasin inconnu/);
  });

  it("envoie le jeton administrateur en Bearer", async () => {
    const spy = vi.fn(async (_url: string, _init: { headers: Record<string, string> }) => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", spy);
    await api("/admin/en-attente", { token: "abc" });
    const init = spy.mock.calls[0][1];
    expect(init.headers.authorization).toBe("Bearer abc");
  });
});
