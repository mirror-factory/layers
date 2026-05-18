import { NextResponse } from "next/server";
import { evaluateProjectHarness } from "@/lib/ai-dev-kit/project-profile";
import { withRoute } from "@/lib/with-route";

export const GET = withRoute(async () => {
  return NextResponse.json(evaluateProjectHarness(process.cwd()));
});
