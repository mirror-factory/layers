import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/supabase/user";
import { SignUpPageClient } from "./sign-up-form";

export default async function SignUpPage() {
  if (await getCurrentUserId()) redirect("/record");
  return <SignUpPageClient />;
}
