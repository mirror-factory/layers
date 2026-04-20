"use client";

import { useState } from "react";
import { Loader2, Mail, Lock } from "lucide-react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowser();
      if (!supabase) throw new Error("Auth not configured");

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;

      // Full page reload so server reads the new session cookies
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
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
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
            <p className="text-sm text-white/40">Enter your email and password</p>
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
                placeholder="Password"
                required
                className="w-full bg-white/[0.05] text-white text-sm border border-white/[0.1] rounded-xl pl-10 pr-3 py-3 min-h-[44px] focus:border-[#14b8a6] focus:outline-none placeholder-white/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full py-3 bg-[#14b8a6] hover:bg-[#0d9488] text-white font-medium rounded-xl min-h-[44px] disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Sign in"}
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-400 text-center mt-3">{error}</p>
          )}

          <p className="text-xs text-white/30 text-center mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-[#14b8a6] hover:text-[#2dd4bf]">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
