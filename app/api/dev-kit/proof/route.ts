import { NextResponse } from "next/server";

import { loadLatestProofPacket } from "@/lib/ai-dev-kit/proof-packet";
import { withRoute } from "@/lib/with-route";

export const GET = withRoute(async () => {
  return NextResponse.json(loadLatestProofPacket(process.cwd()));
});
