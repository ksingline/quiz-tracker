"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-50 px-4">
      <div className="w-full max-w-sm border border-neutral-800 rounded-lg p-6 bg-neutral-900/60">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-sm font-bold text-black">
            Q
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Quiz Tracker</h1>
            <p className="text-[11px] text-neutral-400">Sign in to continue</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs text-neutral-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-black font-semibold text-sm py-2 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-[11px] text-neutral-500 mt-4">
          Use the email/password you configured in Supabase Auth.
        </p>
      </div>
    </div>
  );
}
