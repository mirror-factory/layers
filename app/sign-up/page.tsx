"use client";

import { useState } from "react";
import { Loader2, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      if (!supabase) throw new Error("Auth not configured");

      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">Layer One</h1>
          <p className="text-xs text-white/40 mt-1 tracking-wide uppercase">Audio Intelligence</p>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-[#22c55e] text-4xl">✓</div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-sm text-white/50">
                We sent a confirmation link to <span className="text-white">{email}</span>
              </p>
              <Link href="/sign-in" className="text-sm text-[#14b8a6] hover:text-[#2dd4bf]">
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-white mb-1">Create account</h2>
                <p className="text-sm text-white/40">Get started with 25 free meetings</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-white/[0.05] text-white text-sm border border-white/[0.1] rounded-xl pl-10 pr-3 py-3 min-h-[44px] focus:border-[#14b8a6] focus:outline-none placeholder-white/30 transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    required
                    minLength={6}
                    className="w-full bg-white/[0.05] text-white text-sm border border-white/[0.1] rounded-xl pl-10 pr-3 py-3 min-h-[44px] focus:border-[#14b8a6] focus:outline-none placeholder-white/30 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full py-3 bg-[#14b8a6] hover:bg-[#0d9488] text-white font-medium rounded-xl min-h-[44px] disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Create account"}
                </button>
              </form>

              {error && (
                <p className="text-sm text-red-400 text-center mt-3">{error}</p>
              )}

              <p className="text-xs text-white/30 text-center mt-4">
                Already have an account?{" "}
                <Link href="/sign-in" className="text-[#14b8a6] hover:text-[#2dd4bf]">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
