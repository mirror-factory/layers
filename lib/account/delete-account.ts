import type { SupabaseClient } from "@supabase/supabase-js";

type DeleteStep = {
  table: string;
  column: string;
};

type DeleteStepResult = {
  table: string;
  status: "deleted" | "skipped";
  detail?: string;
};

export type AccountDeletionResult = {
  deletedUserId: string;
  steps: DeleteStepResult[];
};

const USER_OWNED_TABLES: DeleteStep[] = [
  { table: "calendar_connections", column: "user_id" },
  { table: "oauth_codes", column: "user_id" },
  { table: "oauth_refresh_tokens", column: "user_id" },
  { table: "webhooks", column: "user_id" },
  { table: "meetings", column: "user_id" },
  { table: "profiles", column: "user_id" },
];

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /Could not find the table|does not exist/i.test(error.message ?? "")
  );
}

export async function deleteAccountData(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountDeletionResult> {
  const steps: DeleteStepResult[] = [];

  for (const step of USER_OWNED_TABLES) {
    const { error } = await supabase
      .from(step.table)
      .delete()
      .eq(step.column, userId);

    if (error) {
      if (isMissingTableError(error)) {
        steps.push({
          table: step.table,
          status: "skipped",
          detail: "table is not present in this environment",
        });
        continue;
      }

      throw new Error(`Failed to delete ${step.table}: ${error.message}`);
    }

    steps.push({ table: step.table, status: "deleted" });
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
  }

  return {
    deletedUserId: userId,
    steps,
  };
}
