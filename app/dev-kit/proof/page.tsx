import type { ReactNode } from "react";

import { loadLatestProofPacket, type ProofArtifact } from "@/lib/ai-dev-kit/proof-packet";
import { getDevKitTheme } from "@/lib/dev-kit-theme";

export const dynamic = "force-dynamic";

type Theme = ReturnType<typeof getDevKitTheme>;

function Card({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <section style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius("md"),
      padding: theme.space(4),
      background: theme.colors.surface,
    }}>
      {children}
    </section>
  );
}

function Metric({ label, value, theme }: { label: string; value: ReactNode; theme: Theme }) {
  return (
    <Card theme={theme}>
      <div style={{ color: theme.colors.textMuted, fontSize: 12 }}>{label}</div>
      <div style={{ color: theme.colors.text, fontSize: 22, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </Card>
  );
}

function StatusPill({ pass, theme }: { pass: boolean | null; theme: Theme }) {
  const color = pass === null ? theme.colors.textMuted : pass ? theme.colors.success : theme.colors.error;
  const label = pass === null ? "missing" : pass ? "pass" : "fail";
  return (
    <span style={{
      background: `color-mix(in oklch, ${color} 14%, transparent)`,
      color,
      border: `1px solid color-mix(in oklch, ${color} 34%, transparent)`,
      borderRadius: theme.radius("sm"),
      padding: "2px 8px",
      fontFamily: theme.font.mono,
      fontSize: 11,
      textTransform: "uppercase",
    }}>
      {label}
    </span>
  );
}

function ArtifactTable({ title, artifacts, theme }: { title: string; artifacts: ProofArtifact[]; theme: Theme }) {
  const visible = artifacts.slice(0, 12);
  return (
    <Card theme={theme}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: theme.space(3), alignItems: "baseline" }}>
        <h2 style={{ color: theme.colors.text, margin: 0, fontSize: 17 }}>{title}</h2>
        <span style={{ color: theme.colors.textMuted, fontFamily: theme.font.mono, fontSize: 12 }}>{artifacts.length}</span>
      </div>
      {artifacts.length === 0 ? (
        <p style={{ color: theme.colors.textMuted, marginBottom: 0 }}>No artifacts recorded in the latest packet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", marginTop: theme.space(3), fontSize: 12 }}>
          <thead>
            <tr style={{ color: theme.colors.textMuted, textAlign: "left", borderBottom: `1px solid ${theme.colors.border}` }}>
              <th style={{ padding: "8px 6px" }}>Path</th>
              <th style={{ padding: "8px 6px" }}>Bytes</th>
              <th style={{ padding: "8px 6px" }}>Modified</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(artifact => (
              <tr key={artifact.path} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={{ padding: "8px 6px", color: theme.colors.text, fontFamily: theme.font.mono }}>{artifact.path}</td>
                <td style={{ padding: "8px 6px", color: theme.colors.textMuted, fontFamily: theme.font.mono }}>{artifact.bytes}</td>
                <td style={{ padding: "8px 6px", color: theme.colors.textMuted }}>{artifact.modifiedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {artifacts.length > visible.length && (
        <p style={{ color: theme.colors.textMuted, marginBottom: 0, fontSize: 12 }}>
          Showing {visible.length} of {artifacts.length}. Open the proof packet JSON for the full list.
        </p>
      )}
    </Card>
  );
}

export default function ProofPage() {
  const theme = getDevKitTheme();
  const latest = loadLatestProofPacket();
  const packet = latest.packet;
  const harnessPass = packet?.projectHarness?.pass ?? null;
  const changedFiles = packet?.git?.changedFiles ?? [];
  const evidence = packet?.evidence ?? [];
  const tests = packet?.testResults ?? [];
  const browser = packet?.browserArtifacts ?? [];
  const native = packet?.nativeArtifacts ?? [];
  const featureProof = packet?.featureProof ?? null;
  const matchedFeatures = featureProof?.matchedFeatures ?? [];
  const requiredLanes = featureProof?.requiredLanes ?? [];
  const unmatchedUserFacingFiles = featureProof?.unmatchedUserFacingFiles ?? [];

  return (
    <main style={{ maxWidth: 1180 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: theme.space(4), marginBottom: theme.space(6) }}>
        <div>
          <h1 style={{ margin: 0, color: theme.colors.text, fontSize: 26 }}>Proof center</h1>
          <p style={{ marginTop: theme.space(2), color: theme.colors.textMuted, maxWidth: 760 }}>
            The latest local evidence packet for review: harness status, git scope,
            tier outputs, browser proof, native build artifacts, and test reports.
            This proof center shows artifact lane truth for operator review.
          </p>
        </div>
        <StatusPill pass={latest.present && !latest.error ? true : null} theme={theme} />
      </header>

      {!latest.present && (
        <Card theme={theme}>
          <h2 style={{ color: theme.colors.text, marginTop: 0 }}>No proof packet yet</h2>
          <p style={{ color: theme.colors.textMuted, marginBottom: 0 }}>
            Run <code style={{ fontFamily: theme.font.mono }}>pnpm test:proof</code> after the relevant tier checks.
          </p>
        </Card>
      )}

      {latest.error && (
        <Card theme={theme}>
          <h2 style={{ color: theme.colors.error, marginTop: 0 }}>Proof packet parse failed</h2>
          <p style={{ color: theme.colors.textMuted, marginBottom: 0 }}>{latest.error}</p>
        </Card>
      )}

      {packet && (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: theme.space(3), marginBottom: theme.space(6) }}>
            <Metric label="Harness" value={<StatusPill pass={harnessPass} theme={theme} />} theme={theme} />
            <Metric label="Changed files" value={changedFiles.length} theme={theme} />
            <Metric label="Matched features" value={matchedFeatures.length} theme={theme} />
            <Metric label="Required proof" value={requiredLanes.length} theme={theme} />
            <Metric label="Evidence files" value={evidence.length} theme={theme} />
            <Metric label="Browser artifacts" value={browser.length} theme={theme} />
            <Metric label="Native artifacts" value={native.length} theme={theme} />
          </section>

          <Card theme={theme}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: theme.space(3), alignItems: "baseline" }}>
              <h2 style={{ color: theme.colors.text, margin: 0, fontSize: 17 }}>Feature proof requirements</h2>
              <StatusPill pass={typeof featureProof?.pass === "boolean" ? featureProof.pass : null} theme={theme} />
            </div>
            <p style={{ color: theme.colors.textMuted, marginTop: theme.space(2) }}>
              Registry-driven proof for this ticket. User-facing feature changes require Expect proof plus the lanes declared by the matched feature.
            </p>
            {matchedFeatures.length === 0 ? (
              <p style={{ color: theme.colors.textMuted, marginBottom: 0 }}>No registered feature matched the latest changed-file scope.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: theme.space(3) }}>
                {matchedFeatures.map(feature => (
                  <div key={feature.id} style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius("sm"),
                    padding: theme.space(3),
                    background: theme.colors.bg,
                  }}>
                    <strong style={{ color: theme.colors.text }}>{feature.name}</strong>
                    <div style={{ color: theme.colors.textMuted, fontFamily: theme.font.mono, fontSize: 12, marginTop: 4 }}>{feature.id}</div>
                    <div style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 8 }}>
                      {(feature.proof ?? []).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {requiredLanes.length > 0 && (
              <div style={{ overflowX: "auto", marginTop: theme.space(4) }}>
                <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: theme.colors.textMuted, textAlign: "left", borderBottom: `1px solid ${theme.colors.border}` }}>
                      <th style={{ padding: "8px 6px" }}>Lane</th>
                      <th style={{ padding: "8px 6px" }}>Artifact</th>
                      <th style={{ padding: "8px 6px" }}>Command</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredLanes.map(lane => (
                      <tr key={lane.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                        <td style={{ padding: "8px 6px", color: theme.colors.text }}>{lane.label}</td>
                        <td style={{ padding: "8px 6px" }}>
                          <StatusPill pass={typeof lane.satisfied === "boolean" ? lane.satisfied : null} theme={theme} />
                        </td>
                        <td style={{ padding: "8px 6px", color: theme.colors.textMuted, fontFamily: theme.font.mono }}>{lane.command}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {unmatchedUserFacingFiles.length > 0 && (
              <pre style={{
                marginTop: theme.space(3),
                padding: theme.space(3),
                borderRadius: theme.radius("sm"),
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.error,
                background: theme.colors.bg,
                overflow: "auto",
                fontSize: 12,
              }}>{unmatchedUserFacingFiles.join("\n")}</pre>
            )}
          </Card>

          <Card theme={theme}>
            <h2 style={{ color: theme.colors.text, marginTop: 0, fontSize: 17 }}>Review scope</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: theme.space(3), color: theme.colors.textMuted, fontSize: 13 }}>
              <div><strong style={{ color: theme.colors.text }}>Generated</strong><br />{packet.generatedAt}</div>
              <div><strong style={{ color: theme.colors.text }}>Branch</strong><br />{packet.git?.branch ?? "unknown"}</div>
              <div><strong style={{ color: theme.colors.text }}>Head</strong><br />{packet.git?.head ?? "unknown"}</div>
            </div>
            {changedFiles.length > 0 && (
              <pre style={{
                marginTop: theme.space(3),
                padding: theme.space(3),
                borderRadius: theme.radius("sm"),
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
                background: theme.colors.bg,
                overflow: "auto",
                fontSize: 12,
              }}>{changedFiles.join("\n")}</pre>
            )}
          </Card>

          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: theme.space(4), marginTop: theme.space(4) }}>
            <ArtifactTable title="Evidence" artifacts={evidence} theme={theme} />
            <ArtifactTable title="Test results" artifacts={tests} theme={theme} />
            <ArtifactTable title="Browser proof" artifacts={browser} theme={theme} />
            <ArtifactTable title="Native artifacts" artifacts={native} theme={theme} />
          </section>
        </>
      )}
    </main>
  );
}
