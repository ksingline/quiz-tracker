// src/app/analytics/page.tsx
"use client";

import AppShell from "@/components/AppShell";

export default function AnalyticsPage() {
  // Later: controls for date range, metric type, charts etc.
  return (
    <AppShell>
      <div className="space-y-3">
        <h1 className="text-sm font-semibold mb-1">Analytics</h1>
        <p className="text-xs text-neutral-400">
          This is where we&apos;ll build the YouTube Studio-style analytics:
          filters for date range, quiz type, charts for score, position,
          joker performance, etc.
        </p>
        <div className="border border-neutral-800 rounded-lg h-40 flex items-center justify-center text-xs text-neutral-500">
          Charts coming soon…
        </div>
      </div>
    </AppShell>
  );
}
