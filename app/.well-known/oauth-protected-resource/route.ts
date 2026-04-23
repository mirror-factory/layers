export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { protectedResourceHandler } from "mcp-handler";

const BASE_URL = "https://audio-layer.vercel.app";

const handler = protectedResourceHandler({
  authServerUrls: [BASE_URL],
  resourceUrl: `${BASE_URL}/api/mcp/mcp`,
});

export { handler as GET };
