// src/app/formats/page.tsx
"use client";

import AppShell from "@/components/AppShell";

export default function FormatsPage() {
  return (
    <AppShell>
      <div className="space-y-3">
        <h1 className="text-sm font-semibold mb-1">Quiz formats</h1>
        <p className="text-xs text-neutral-400">
          Here you&apos;ll be able to define different quiz types: round
          names, question counts, joker rules, etc. For now, the app uses
          the built-in Chelsea format.
        </p>
        <div className="border border-neutral-800 rounded-lg p-3 text-xs text-neutral-300">
          <p className="font-medium mb-1">Chelsea (default)</p>
          <p className="text-[11px] text-neutral-400">
            10 rounds, Facebook &amp; Pictures special rules, one Joker
            per quiz (non-pictures).
          </p>
        </div>
      </div>
    </AppShell>
  );
}
