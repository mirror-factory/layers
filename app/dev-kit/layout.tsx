import type { ReactNode } from "react";
import DevKitShell from "./dev-kit-shell";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DevKitShell>{children}</DevKitShell>;
}
