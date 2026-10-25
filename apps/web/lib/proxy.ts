type ProxyOptions = {
  apiUrl?: string;
  production?: boolean;
  fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  /** Only set by the Workers route when Cloudflare supplied CF-Connecting-IP. */
  clientIp?: string | null;
};
const MAX_BODY = 1_048_576;
const error = (status: number, erreur: string) =>
  Response.json({ erreur }, { status, headers: { "cache-control": "no-store" } });

/** Same-origin transport shared by Next Node and the OpenNext Worker. No admin secret is read here. */
export async function proxyToApi(request: Request, options: ProxyOptions = {}): Promise<Response> {
  let target: URL;
  try {
    target = new URL(options.apiUrl ?? (options.production ? "" : "http://127.0.0.1:3001"));
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password ||
        target.pathname !== "/" || target.search || target.hash ||
        (options.production && target.protocol !== "https:")) throw new Error();
  } catch {
    return error(503, "Service de comparaison non configuré.");
  }
  const incoming = new URL(request.url);
  const prefix = "/api-proxy/";
  if (!incoming.pathname.startsWith(prefix)) return error(400, "Chemin API invalide.");
  const path = incoming.pathname.slice(prefix.length);
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.startsWith("/") || decoded.includes("\\") || decoded.split("/").some(p => p === "." || p === "..")) throw new Error();
  } catch {
    return error(400, "Chemin API invalide.");
  }
  target.pathname = "/" + path;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "authorization"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (options.clientIp && /^[0-9a-fA-F:.]+$/.test(options.clientIp)) headers.set("x-forwarded-for", options.clientIp);
  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (Number(request.headers.get("content-length")) > MAX_BODY) return error(413, "Requête trop volumineuse.");
    // Read in bounded chunks, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) {
          await reader.cancel();
          return error(413, "Requête trop volumineuse.");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = bytes.buffer;
    }
  }
  try {
    const upstream = await (options.fetcher ?? fetch)(target.toString(), {
      method: request.method, headers, body, redirect: "manual", cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
    if (upstream.status >= 300 && upstream.status < 400) return error(502, "Redirection inattendue du service de comparaison.");
    const responseHeaders = new Headers({ "cache-control": "no-store" });
    for (const name of ["content-type", "retry-after", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(request.method === "HEAD" || [204, 205, 304].includes(upstream.status) ? null : upstream.body, {
      status: upstream.status, headers: responseHeaders,
    });
  } catch (err) {
    return error(err instanceof Error && ["TimeoutError", "AbortError"].includes(err.name) ? 504 : 502,
      "Service de comparaison temporairement indisponible. Réessayez dans un instant.");
  }
}
