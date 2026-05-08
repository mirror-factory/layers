import { getLogs } from "@/lib/ai/telemetry";
import {
  getSpendBurnRows,
  summarizeAiGatewayDailyBurn,
  type SpendBurnRow,
  type SpendCapStatus,
} from "@/lib/ops/spend-caps";

export const dynamic = "force-dynamic";

function formatUsd(amount: number | null): string {
  if (amount === null) return "n/a";
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

function formatPercent(percent: number | null): string {
  return percent === null ? "n/a" : `${percent.toFixed(1)}%`;
}

function statusClass(status: SpendCapStatus): string {
  switch (status) {
    case "at-cap":
    case "danger":
      return "text-signal-live bg-signal-live/10";
    case "watch":
      return "text-signal-warning bg-signal-warning/10";
    case "not-applicable":
      return "text-ink-200/40 bg-white/10";
    default:
      return "text-signal-success bg-signal-success/10";
  }
}

function burnSource(row: SpendBurnRow): string {
  const source =
    row.source === "live-ai-logs"
      ? "AI logs"
      : row.source === "vendor-dashboard"
        ? "Vendor dashboard"
        : row.source === "not-applicable"
          ? "n/a"
          : "Manual";
  return `${row.burnSource} / ${source}`;
}

async function getBurnRows() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let logs: Awaited<ReturnType<typeof getLogs>> = [];
  try {
    logs = await getLogs({
      since: today.toISOString(),
      limit: 10_000,
    });
  } catch {
    return getSpendBurnRows();
  }

  return getSpendBurnRows(summarizeAiGatewayDailyBurn(logs));
}

export default async function SpendBurnPage() {
  const rows = await getBurnRows();
  const highest = rows.find((row) => row.percentOfCap !== null);
  const atRisk = rows.filter(
    (row) => row.status === "danger" || row.status === "at-cap",
  ).length;
  const observed = rows.filter((row) => row.burnSource === "observed").length;
  const capped = rows.filter((row) => row.capUsdMonthly !== null).length;

  return (
    <main className="min-h-screen bg-layers-ink px-4 py-6 text-ink-200 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-layers-mint/20 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Internal observability
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-layers-mint-soft">
              Vendor Burn Rate
            </h1>
          </div>
          <p className="max-w-xl text-sm text-ink-400">
            Daily burn is sorted by 30-day run-rate as a percentage of the
            configured monthly cap. Live AI rows use today&apos;s AI logs; other
            vendors stay projected until their usage APIs are wired.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Highest cap use"
            value={highest ? formatPercent(highest.percentOfCap) : "n/a"}
            sub={highest?.vendor ?? "No capped vendors"}
            status={highest?.status ?? "not-applicable"}
          />
          <SummaryTile
            label="At or above 80%"
            value={String(atRisk)}
            sub="Rows needing action"
            status={atRisk > 0 ? "danger" : "ok"}
          />
          <SummaryTile
            label="Observed today"
            value={String(observed)}
            sub="Rows using live logs"
            status="ok"
          />
          <SummaryTile
            label="Capped rows"
            value={String(capped)}
            sub="Rows with caps"
            status="ok"
          />
        </section>

        <section className="overflow-x-auto rounded-lg border border-layers-mint/20 bg-[color-mix(in_oklch,var(--layers-ink)_91%,var(--layers-mint)_9%)]">
          <table className="min-w-[1120px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-layers-mint/20 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Daily burn</th>
                <th className="px-4 py-3">30d run</th>
                <th className="px-4 py-3">Cap</th>
                <th className="px-4 py-3">Cap use</th>
                <th className="px-4 py-3">Alerts</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Kill switch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-layers-mint/10">
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-ink-200">
                      {row.vendor}
                    </div>
                    <div className="mt-1 max-w-56 text-xs text-ink-500">
                      {row.usedFor}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top font-semibold text-signal-warning">
                    {formatUsd(row.dailyBurnUsd)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {formatUsd(row.monthlyRunRateUsd)}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-400">
                    {formatUsd(row.capUsdMonthly)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex min-w-36 items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-layers-mint"
                          style={{
                            width: `${Math.min(row.percentOfCap ?? 0, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-14 text-right text-xs font-semibold">
                        {formatPercent(row.percentOfCap)}
                      </span>
                    </div>
                    <span
                      className={`mt-2 inline-flex rounded px-2 py-0.5 text-xs font-semibold uppercase ${statusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="max-w-64 px-4 py-3 align-top text-xs text-ink-400">
                    {row.alertChannel}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-layers-blue-soft">
                    {burnSource(row)}
                  </td>
                  <td className="max-w-72 px-4 py-3 align-top text-xs text-ink-400">
                    {row.killSwitch}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: string;
  sub: string;
  status: SpendCapStatus;
}) {
  return (
    <div className="rounded-lg border border-layers-mint/20 bg-[color-mix(in_oklch,var(--layers-ink)_91%,var(--layers-mint)_9%)] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${statusClass(status).split(" ")[0]}`}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-ink-500">{sub}</div>
    </div>
  );
}
