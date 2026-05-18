export function formatCompletedActionDueLabel(
  dueDate: string | null | undefined,
): string | null {
  const raw = typeof dueDate === "string" ? dueDate.trim() : "";
  if (!raw) return null;

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(raw);

  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(parsed);
}
