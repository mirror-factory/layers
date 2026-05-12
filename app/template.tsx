import type { ReactNode } from "react";
import { FloatingAsk } from "@/components/floating-ask";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="route-transition-shell">
      {children}
      <FloatingAsk />
    </div>
  );
}
