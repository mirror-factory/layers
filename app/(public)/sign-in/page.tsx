import { redirect } from "next/navigation";
import { getCurrentSignedInUserId } from "@/lib/supabase/user";
import { SignInPageClient } from "./sign-in-form";

export default async function SignInPage() {
  // PROD-487: must use getCurrentSignedInUserId — getCurrentUserId returns
  // true for anonymous Supabase sessions, which the site auto-creates on
  // every visit. Using it here made /sign-in unreachable for ALL users.
  if (await getCurrentSignedInUserId()) redirect("/record");
  return <SignInPageClient />;
}
