import { getDevKitTheme } from "@/lib/dev-kit-theme";
import { evaluateProjectHarness, type HarnessCheck } from "@/lib/ai-dev-kit/project-profile";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

function badgeColor(status: HarnessCheck["status"], theme: ReturnType<typeof getDevKitTheme>) {
  if (status === "pass") return theme.colors.success;
  if (status === "warn") return theme.colors.warn;
  return theme.colors.error;
}

function Badge({ status, theme }: { status: HarnessCheck["status"]; theme: ReturnType<typeof getDevKitTheme> }) {
  const color = badgeColor(status, theme);
  return (
    <span style={{
      background: `color-mix(in oklch, ${color} 16%, transparent)`,
      color,
      border: `1px solid color-mix(in oklch, ${color} 36%, transparent)`,
      borderRadius: theme.radius("sm"),
      padding: "2px 8px",
      fontFamily: theme.font.mono,
      fontSize: 11,
      textTransform: "uppercase",
    }}>
      {status}
    </span>
  );
}

function Pill({ children, theme }: { children: ReactNode; theme: ReturnType<typeof getDevKitTheme> }) {
  return (
    <span style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius("sm"),
      padding: "4px 8px",
      color: theme.colors.text,
      background: theme.colors.surface,
      fontSize: 12,
      fontFamily: theme.font.mono,
    }}>
      {children}
    </span>
  );
}

export default function ProjectProfilePage() {
  const theme = getDevKitTheme();
  const report = evaluateProjectHarness();
  const grouped = {
    fail: report.checks.filter(check => check.status === "fail"),
    warn: report.checks.filter(check => check.status === "warn"),
    pass: report.checks.filter(check => check.status === "pass"),
  };

  return (
    <main style={{ maxWidth: 1180 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: theme.space(4), marginBottom: theme.space(6) }}>
        <div>
          <h1 style={{ margin: 0, color: theme.colors.text, fontSize: 26 }}>Project operating profile</h1>
          <p style={{ marginTop: theme.space(2), color: theme.colors.textMuted, maxWidth: 760 }}>
            The reusable AI Dev Kit contract plus this project&apos;s local implementation:
            platforms, services, design system, proof policy, and dashboard obligations.
          </p>
        </div>
        <div style={{ alignSelf: "start" }}>
          <Badge status={report.pass ? "pass" : "fail"} theme={theme} />
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: theme.space(3), marginBottom: theme.space(6) }}>
        <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius("md"), padding: theme.space(4), background: theme.colors.surface }}>
          <div style={{ color: theme.colors.textMuted, fontSize: 12 }}>Project</div>
          <div style={{ color: theme.colors.text, fontWeight: 700, marginTop: 6 }}>{report.project?.name ?? "Unknown"}</div>
          <div style={{ color: theme.colors.textMuted, fontFamily: theme.font.mono, fontSize: 12 }}>{report.project?.repo ?? ""}</div>
        </div>
        <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius("md"), padding: theme.space(4), background: theme.colors.surface }}>
          <div style={{ color: theme.colors.textMuted, fontSize: 12 }}>Branches</div>
          <div style={{ color: theme.colors.text, fontFamily: theme.font.mono, marginTop: 6 }}>
            {report.branchModel?.integration} -&gt; {report.branchModel?.releaseCandidate} -&gt; {report.branchModel?.production}
          </div>
        </div>
        <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius("md"), padding: theme.space(4), background: theme.colors.surface }}>
          <div style={{ color: theme.colors.textMuted, fontSize: 12 }}>Platforms</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {report.enabledPlatforms.map(platform => <Pill key={platform} theme={theme}>{platform}</Pill>)}
          </div>
        </div>
        <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius("md"), padding: theme.space(4), background: theme.colors.surface }}>
          <div style={{ color: theme.colors.textMuted, fontSize: 12 }}>Required Tools</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {report.requiredTools.map(tool => <Pill key={tool} theme={theme}>{tool}</Pill>)}
          </div>
        </div>
      </section>

      {(grouped.fail.length > 0 || grouped.warn.length > 0) && (
        <section style={{
          border: `1px solid ${grouped.fail.length > 0 ? theme.colors.error : theme.colors.warn}`,
          borderRadius: theme.radius("md"),
          padding: theme.space(4),
          marginBottom: theme.space(6),
          background: `color-mix(in oklch, ${grouped.fail.length > 0 ? theme.colors.error : theme.colors.warn} 8%, transparent)`,
        }}>
          <h2 style={{ margin: 0, color: theme.colors.text, fontSize: 16 }}>Attention Required</h2>
          <ul style={{ marginBottom: 0, color: theme.colors.text }}>
            {[...grouped.fail, ...grouped.warn].map(check => (
              <li key={check.id} style={{ marginTop: 8 }}>
                <strong>{check.label}:</strong> {check.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 style={{ color: theme.colors.text, fontSize: 18 }}>Harness checks</h2>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: theme.colors.textMuted, textAlign: "left", borderBottom: `1px solid ${theme.colors.border}` }}>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Check</th>
              <th style={{ padding: "10px 8px" }}>Detail</th>
              <th style={{ padding: "10px 8px" }}>Path</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map(check => (
              <tr key={check.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={{ padding: "10px 8px" }}><Badge status={check.status} theme={theme} /></td>
                <td style={{ padding: "10px 8px", color: theme.colors.text, fontWeight: 600 }}>{check.label}</td>
                <td style={{ padding: "10px 8px", color: theme.colors.textMuted }}>{check.detail}</td>
                <td style={{ padding: "10px 8px", color: theme.colors.textMuted, fontFamily: theme.font.mono, fontSize: 12 }}>{check.path ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
