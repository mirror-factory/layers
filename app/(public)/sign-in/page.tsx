import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/supabase/user";
import { SignInPageClient } from "./sign-in-form";

export default async function SignInPage() {
  if (await getCurrentUserId()) redirect("/record");
  return <SignInPageClient />;
}
