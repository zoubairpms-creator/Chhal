import { proxyToApi } from "../../../lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const relay = (request: Request) => proxyToApi(request, {
  apiUrl: process.env.API_INTERNAL_URL,
  production: process.env.NODE_ENV === "production",
  clientIp: process.env.CHHAL_CLOUDFLARE === "1" ? request.headers.get("cf-connecting-ip") : undefined,
});
export { relay as GET, relay as HEAD, relay as POST, relay as PUT, relay as PATCH, relay as DELETE, relay as OPTIONS };
