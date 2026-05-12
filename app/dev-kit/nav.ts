import {
  Activity,
  Bug,
  ClipboardCheck,
  DollarSign,
  FlaskConical,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Library,
  Map,
  Palette,
  Play,
  Plug,
  Rocket,
  Settings,
  Shield,
  Layers3,
  Wrench,
  Workflow,
} from "lucide-react";
import type { ComponentType } from "react";

export type DevKitNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  description: string;
};

export type DevKitNavGroup = {
  title: string;
  description: string;
  items: DevKitNavItem[];
};

export const navGroups: DevKitNavGroup[] = [
  {
    title: "Core",
    description: "The top-level map and evidence surfaces.",
    items: [
      {
        label: "Overview",
        href: "/dev-kit",
        icon: LayoutDashboard,
        description: "Live metrics, health, and realtime status.",
      },
      {
        label: "Project",
        href: "/dev-kit/project",
        icon: FolderKanban,
        description: "Project contract, platforms, and obligations.",
      },
      {
        label: "Project map",
        href: "/dev-kit/index",
        icon: Map,
        description: "Registry-of-registries and the project graph.",
      },
      {
        label: "Proof",
        href: "/dev-kit/proof",
        icon: ClipboardCheck,
        description: "Proof packet, artifacts, and test evidence.",
      },
      {
        label: "Registries",
        href: "/dev-kit/registries",
        icon: Library,
        description: "Vendor registry source of truth.",
      },
    ],
  },
  {
    title: "Operations",
    description: "Runtime surfaces that show what is happening now.",
    items: [
      {
        label: "Runs",
        href: "/dev-kit/runs",
        icon: Play,
        description: "Recent runs, durations, and outcomes.",
      },
      {
        label: "Sessions",
        href: "/dev-kit/sessions",
        icon: Activity,
        description: "Agent sessions and handoffs.",
      },
      {
        label: "Status",
        href: "/dev-kit/status",
        icon: Gauge,
        description: "Warnings, coverage, and observability.",
      },
      {
        label: "Tools",
        href: "/dev-kit/tools",
        icon: Wrench,
        description: "Tool registry and contract usage.",
      },
      {
        label: "Coverage",
        href: "/dev-kit/coverage",
        icon: Shield,
        description: "Coverage matrix and gap detection.",
      },
      {
        label: "Dependencies",
        href: "/dev-kit/dependencies",
        icon: Workflow,
        description: "External packages and service dependencies.",
      },
    ],
  },
  {
    title: "Governance",
    description: "Policy surfaces for release, quality, and routing.",
    items: [
      {
        label: "Config",
        href: "/dev-kit/config",
        icon: Settings,
        description: "Config editor and validation state.",
      },
      {
        label: "Design system",
        href: "/dev-kit/design-system",
        icon: Palette,
        description: "Tokens, primitives, and samples.",
      },
      {
        label: "Evaluations",
        href: "/dev-kit/evals",
        icon: FlaskConical,
        description: "Eval suites, model routing, and scores.",
      },
      {
        label: "Cost",
        href: "/dev-kit/cost",
        icon: DollarSign,
        description: "Token spend and budget signals.",
      },
      {
        label: "Deployments",
        href: "/dev-kit/deployments",
        icon: Rocket,
        description: "Promotion history and release state.",
      },
      {
        label: "Features",
        href: "/dev-kit/features",
        icon: Layers3,
        description: "Feature contracts and proof rules.",
      },
      {
        label: "Regressions",
        href: "/dev-kit/regressions",
        icon: Bug,
        description: "Known failures and unresolved breaks.",
      },
      {
        label: "Connectors",
        href: "/dev-kit/connectors",
        icon: Plug,
        description: "API connectors and integration health.",
      },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);

export function resolveNavItem(pathname: string): DevKitNavItem {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact;

  const match = navItems
    .filter((item) => pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return match ?? navItems[0];
}
