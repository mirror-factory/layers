"use client";

/**
 * PROD-403: /settings/integrations -- connected MCP clients + API keys.
 *
 * Surfaces the persisted `oauth_clients` rows so the user can see and revoke
 * the AI tools they've connected (Claude Desktop, Cursor, etc.) and -- for
 * power users -- mint a `layers_pat_*` bearer for headless server-to-server
 * scripts that can't run a full OAuth flow.
 *
 * Visual style intentionally matches `app/settings/page.tsx` (Paper Calm
 * tokens, `glass-card`, OKLCH text/border vars). No raw hex.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plug,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { TopBar } from "@/components/top-bar";

interface OAuthClientSummary {
  id: string;
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface ApiKeySummary {
  id: string;
  name: string | null;
  tokenPrefix: string;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface RevokeDialogState {
  open: boolean;
  clientId: string | null;
  clientName: string | null;
}

const REVOKE_DIALOG_CLOSED: RevokeDialogState = {
  open: false,
  clientId: null,
  clientName: null,
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  if (ms < 60_000) return "Just now";
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 24 * 60 * 60_000) return `${Math.round(ms / 3_600_000)}h ago`;
  if (ms < 30 * 24 * 60 * 60_000) {
    return `${Math.round(ms / 86_400_000)}d ago`;
  }
  return new Date(iso).toLocaleDateString();
}

function clientLabel(client: OAuthClientSummary): string {
  if (client.clientName && client.clientName.trim()) return client.clientName;
  if (client.clientId.startsWith("mcp-")) return "MCP Client";
  return client.clientId;
}

export default function IntegrationsPage() {
  const [clients, setClients] = useState<OAuthClientSummary[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(
    null,
  );
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<RevokeDialogState>(
    REVOKE_DIALOG_CLOSED,
  );
  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  const showToast = useCallback(
    (kind: "success" | "error", text: string) => {
      setToast({ kind, text });
      window.setTimeout(() => setToast(null), 3500);
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setBlockedReason(null);
    try {
      const [clientsRes, keysRes] = await Promise.all([
        fetch("/api/account/oauth-clients"),
        fetch("/api/account/api-keys"),
      ]);

      if (clientsRes.status === 401) {
        setBlockedReason("Sign in to manage connected apps.");
        setClients([]);
        setApiKeys([]);
        return;
      }

      if (!clientsRes.ok) {
        const body = await clientsRes.json().catch(() => ({}));
        setBlockedReason(
          (body as { error?: string }).error ??
            "Connected apps storage is not available in this environment.",
        );
        setClients([]);
        setApiKeys([]);
        return;
      }

      const clientsBody = (await clientsRes.json()) as {
        clients?: OAuthClientSummary[];
      };
      setClients(Array.isArray(clientsBody.clients) ? clientsBody.clients : []);

      if (keysRes.ok) {
        const keysBody = (await keysRes.json()) as { keys?: ApiKeySummary[] };
        setApiKeys(Array.isArray(keysBody.keys) ? keysBody.keys : []);
      } else {
        setApiKeys([]);
      }
    } catch {
      setBlockedReason("Could not load connected apps.");
      setClients([]);
      setApiKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRevokeClick = useCallback((client: OAuthClientSummary) => {
    setRevokeDialog({
      open: true,
      clientId: client.id,
      clientName: clientLabel(client),
    });
  }, []);

  const onCancelRevoke = useCallback(() => {
    setRevokeDialog(REVOKE_DIALOG_CLOSED);
  }, []);

  const onConfirmRevoke = useCallback(async () => {
    if (!revokeDialog.clientId) return;
    setRevokingId(revokeDialog.clientId);
    try {
      const res = await fetch(
        `/api/account/oauth-clients/${revokeDialog.clientId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        showToast("error", body.error ?? "Could not revoke connected app.");
        return;
      }
      showToast(
        "success",
        `Revoked ${revokeDialog.clientName ?? "connected app"}. The app will be signed out across every active session.`,
      );
      await loadAll();
    } finally {
      setRevokingId(null);
      setRevokeDialog(REVOKE_DIALOG_CLOSED);
    }
  }, [revokeDialog, loadAll, showToast]);

  const onCreateKey = useCallback(async () => {
    setCreatingKey(true);
    setNewKeyPlaintext(null);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() || null }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        plaintext?: string;
        error?: string;
      };
      if (!res.ok || !body.plaintext) {
        showToast("error", body.error ?? "Could not mint API key.");
        return;
      }
      setNewKeyPlaintext(body.plaintext);
      setShowNewKey(true);
      setKeyName("");
      await loadAll();
      showToast(
        "success",
        "API key minted. Copy the secret now — it won't be shown again.",
      );
    } finally {
      setCreatingKey(false);
    }
  }, [keyName, loadAll, showToast]);

  const onRevokeKey = useCallback(
    async (key: ApiKeySummary) => {
      setRevokingKeyId(key.id);
      try {
        const res = await fetch(`/api/account/api-keys/${key.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          showToast("error", body.error ?? "Could not revoke API key.");
          return;
        }
        showToast("success", `API key ${key.tokenPrefix}… revoked.`);
        await loadAll();
      } finally {
        setRevokingKeyId(null);
      }
    },
    [loadAll, showToast],
  );

  const visibleClients = useMemo(() => clients, [clients]);

  return (
    <div className="paper-calm-page min-h-screen-safe flex flex-col bg-[var(--bg-primary)]">
      <TopBar title="Integrations" showBack />

      <main className="flex-1 px-4 pb-safe py-6 max-w-2xl mx-auto w-full space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-layers-mint" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Connected apps
            </h1>
          </div>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            AI tools you have approved to read your meetings through the Layers
            MCP server. Revoking signs the app out across every active session.
          </p>
        </header>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 size={14} className="animate-spin text-layers-mint" />
            Loading connected apps…
          </div>
        )}

        {!loading && blockedReason && (
          <div className="glass-card rounded-xl p-4 text-xs leading-5 text-[var(--text-muted)]">
            {blockedReason}
          </div>
        )}

        {!loading && !blockedReason && visibleClients.length === 0 && (
          <EmptyState />
        )}

        {!loading && !blockedReason && visibleClients.length > 0 && (
          <section className="space-y-3" aria-label="Connected apps">
            {visibleClients.map((client) => (
              <ConnectedAppCard
                key={client.id}
                client={client}
                revoking={revokingId === client.id}
                onRevoke={() => onRevokeClick(client)}
              />
            ))}
          </section>
        )}

        <hr className="border-t border-[var(--border-card)]" />

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-layers-mint" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              API keys
            </h2>
          </div>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            For headless server-to-server scripts that cannot run a browser
            OAuth flow. The default integration path is OAuth + DCR —
            use API keys only if you cannot avoid them.
          </p>
        </header>

        <ApiKeyCreator
          name={keyName}
          onNameChange={setKeyName}
          creating={creatingKey}
          onCreate={onCreateKey}
        />

        {newKeyPlaintext && (
          <NewKeyDisplay
            plaintext={newKeyPlaintext}
            visible={showNewKey}
            onToggleVisible={() => setShowNewKey((v) => !v)}
            onDismiss={() => setNewKeyPlaintext(null)}
            onCopy={async () => {
              await navigator.clipboard.writeText(newKeyPlaintext);
              showToast("success", "API key copied.");
            }}
          />
        )}

        {apiKeys.length > 0 && (
          <section className="space-y-2" aria-label="API keys">
            {apiKeys.map((key) => (
              <ApiKeyRow
                key={key.id}
                apiKey={key}
                revoking={revokingKeyId === key.id}
                onRevoke={() => onRevokeKey(key)}
              />
            ))}
          </section>
        )}
      </main>

      {revokeDialog.open && (
        <RevokeConfirmation
          clientName={revokeDialog.clientName ?? "this connected app"}
          revoking={revokingId !== null}
          onCancel={onCancelRevoke}
          onConfirm={onConfirmRevoke}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-xs font-semibold shadow-md ${
            toast.kind === "success"
              ? "border-layers-mint/30 bg-[var(--bg-card)] text-[var(--text-primary)]"
              : "border-signal-live/30 bg-[var(--bg-card)] text-signal-live"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card rounded-xl border border-dashed border-[var(--border-card)] p-5 text-center">
      <Sparkles
        size={18}
        className="mx-auto mb-2 text-layers-mint"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-[var(--text-primary)]">
        No connected apps yet.
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
        Set up an MCP connection from{" "}
        <Link href="/record" className="text-layers-mint hover:underline">
          /record
        </Link>
        . Add the Layers MCP URL to Claude, Cursor, or another OAuth-capable
        AI tool and approve the consent screen.
      </p>
    </div>
  );
}

function ConnectedAppCard({
  client,
  revoking,
  onRevoke,
}: {
  client: OAuthClientSummary;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const revoked = Boolean(client.revokedAt);
  return (
    <article
      className={`glass-card rounded-xl p-4 ${revoked ? "opacity-60" : ""}`}
      aria-label={`Connected app: ${clientLabel(client)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--surface-control)] text-layers-mint"
            aria-hidden="true"
          >
            <Plug size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {clientLabel(client)}
              {revoked && (
                <span className="ml-2 inline-flex items-center rounded-full bg-signal-live/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.08em] text-signal-live">
                  Revoked
                </span>
              )}
            </p>
            <p
              className="mt-1 truncate text-xs text-[var(--text-muted)]"
              title={client.redirectUris.join(", ")}
            >
              {client.redirectUris[0] ?? "(no redirect URI on file)"}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
              First connected {formatRelative(client.createdAt)} · Last used{" "}
              {formatRelative(client.lastUsedAt)}
            </p>
          </div>
        </div>

        {!revoked && (
          <button
            type="button"
            onClick={onRevoke}
            disabled={revoking}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[var(--border-card)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-control-hover)] hover:text-signal-live disabled:opacity-60"
          >
            {revoking ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
            Revoke
          </button>
        )}
      </div>
    </article>
  );
}

function ApiKeyCreator({
  name,
  onNameChange,
  creating,
  onCreate,
}: {
  name: string;
  onNameChange: (v: string) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <label
        htmlFor="api-key-name"
        className="block text-sm font-medium text-[var(--text-primary)]"
      >
        New API key
      </label>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
        Optional label so you can identify this key later. We only store the
        hash — the plaintext is shown exactly once.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="api-key-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="CI pipeline, etc."
          className="signal-input min-h-[44px] flex-1 rounded-lg px-3 text-sm text-[var(--text-primary)] focus:outline-none"
          maxLength={80}
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--paper-calm-ink)] px-4 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50 dark:text-layers-ink"
        >
          {creating && <Loader2 size={14} className="animate-spin" />}
          Generate key
        </button>
      </div>
    </div>
  );
}

function NewKeyDisplay({
  plaintext,
  visible,
  onToggleVisible,
  onDismiss,
  onCopy,
}: {
  plaintext: string;
  visible: boolean;
  onToggleVisible: () => void;
  onDismiss: () => void;
  onCopy: () => void;
}) {
  const masked = `${plaintext.slice(0, 12)}${"•".repeat(8)}${plaintext.slice(-4)}`;
  return (
    <div
      className="glass-card rounded-xl border border-layers-mint/40 p-4"
      role="region"
      aria-label="Newly generated API key"
    >
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        Copy this key now — it won&apos;t be shown again.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-[var(--border-card)] bg-[var(--surface-control)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]">
          {visible ? plaintext : masked}
        </code>
        <button
          type="button"
          onClick={onToggleVisible}
          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-control-hover)]"
          aria-label={visible ? "Hide key" : "Show key"}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-control-hover)]"
          aria-label="Copy key"
        >
          <Copy size={14} />
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      >
        I&apos;ve copied it, dismiss
      </button>
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  revoking,
  onRevoke,
}: {
  apiKey: ApiKeySummary;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const revoked = Boolean(apiKey.revokedAt);
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-[var(--border-card)] bg-[var(--surface-control)] p-3 ${
        revoked ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {apiKey.name ?? "Untitled key"}
          {revoked && (
            <span className="ml-2 inline-flex items-center rounded-full bg-signal-live/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.08em] text-signal-live">
              Revoked
            </span>
          )}
        </p>
        <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
          {apiKey.tokenPrefix}
          {"…".padEnd(12, "•")}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          Created {formatRelative(apiKey.createdAt)} · Last used{" "}
          {formatRelative(apiKey.lastUsedAt)}
        </p>
      </div>
      {!revoked && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-[var(--border-card)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-control-hover)] hover:text-signal-live disabled:opacity-60"
        >
          {revoking ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Trash2 size={13} />
          )}
          Revoke
        </button>
      )}
    </div>
  );
}

function RevokeConfirmation({
  clientName,
  revoking,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  revoking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] p-5 shadow-lg">
        <h2 id="revoke-title" className="text-base font-semibold text-[var(--text-primary)]">
          Revoke {clientName}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          This will sign out <strong>{clientName}</strong> across every active
          session. Continue?
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={revoking}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-signal-live px-4 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {revoking && <Loader2 size={14} className="animate-spin" />}
            Revoke
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={revoking}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--border-card)] bg-[var(--surface-control)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-control-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
