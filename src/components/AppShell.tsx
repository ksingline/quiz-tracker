// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-50">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-3 border-b border-neutral-800">
        <button
          className="flex items-center gap-1"
          onClick={() => router.push("/dashboard")}
        >
          {/* Tiny logo placeholder */}
          <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-xs font-bold">
            Q
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Quiz Tracker
          </span>
        </button>

        <div className="flex items-center gap-3">
          {/* New quiz (+) */}
          <Button
            onClick={() => router.push("/add-quiz")}
            className="h-8 px-3 bg-emerald-500 text-black hover:bg-emerald-400"
            aria-label="Add new quiz"
            size="sm"
          >
            <span className="text-xs font-semibold">+ Quiz</span>
          </Button>

          {/* Account / auth */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-300">
              {userEmail ?? "Not signed in"}
            </span>
            <button
              className="px-3 h-8 rounded-full border border-neutral-700 text-[11px] flex items-center justify-center hover:border-emerald-500"
              onClick={async () => {
                if (!userEmail) {
                  router.push("/login");
                  return;
                }
                await supabase.auth.signOut();
                router.push("/login");
              }}
            >
              {userEmail ? "Sign out" : "Sign in"}
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-14 px-3 pt-3">
        {children}
      </main>

      {/* Bottom nav – mobile-style */}
      <nav className="h-12 border-t border-neutral-800 flex items-stretch justify-around text-xs bg-neutral-950">
        <TabLink href="/dashboard" label="Dashboard" active={isActive("/dashboard")} />
        <TabLink href="/quizzes" label="Quizzes" active={isActive("/quizzes")} />
        <TabLink href="/analytics" label="Analytics" active={isActive("/analytics")} />
        <TabLink href="/formats" label="Formats" active={isActive("/formats")} />
      </nav>
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center justify-center ${
        active ? "text-emerald-400" : "text-neutral-400"
      }`}
    >
      <span className="text-[11px]">{label}</span>
      {active && <span className="w-6 h-0.5 bg-emerald-400 mt-0.5 rounded-full" />}
    </Link>
  );
}
