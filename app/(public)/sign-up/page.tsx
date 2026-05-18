import { redirect } from "next/navigation";
import { getCurrentSignedInUserId } from "@/lib/supabase/user";
import { SignUpPageClient } from "./sign-up-form";

export default async function SignUpPage() {
  // PROD-487: must use getCurrentSignedInUserId — see sign-in/page.tsx
  if (await getCurrentSignedInUserId()) redirect("/record");
  return <SignUpPageClient />;
}
