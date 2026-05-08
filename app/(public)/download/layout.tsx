import type { ReactNode } from "react";
import { ProductExplainerVideo } from "@/components/product-explainer-video";

export default function DownloadLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ProductExplainerVideo
        eyebrow="See how it works"
        title="Watch Layers capture decisions, memory, and MCP search."
        description="The explainer shows the same flow you install for: live recording, transcript, meeting memory, search across meetings, and AI tool access."
      />
      {children}
    </>
  );
}
