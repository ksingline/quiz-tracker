// src/components/dashboard/DashboardContent.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/quiz";
import Link from "next/link";

type QuizRow = {
  id: string;
  quiz_date: string;
  quiz_name: string;
  is_big_quiz: boolean;
  position: number | null;
  teams_total: number | null;
};

type RoundRow = {
  id: string;
  quiz_id: string;
  score: number | null;
  max_score: number | null;
};

type QuizWithStats = QuizRow & {
  totalScore: number;
  totalMax: number;
  percentage: number | null;
};

export default function DashboardContent() {
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [{ data: quizData }, { data: roundData }] = await Promise.all([
        supabase
          .from("quizzes")
          .select("id, quiz_date, quiz_name, is_big_quiz, position, teams_total")
          .order("quiz_date", { ascending: true }),
        supabase.from("rounds").select("id, quiz_id, score, max_score"),
      ]);

      const quizzesRaw = (quizData ?? []) as QuizRow[];
      const roundsRaw = (roundData ?? []) as RoundRow[];

      const byQuiz: Record<string, { score: number; max: number }> = {};

      for (const r of roundsRaw) {
        if (!byQuiz[r.quiz_id]) byQuiz[r.quiz_id] = { score: 0, max: 0 };
        byQuiz[r.quiz_id].score += r.score ?? 0;
        byQuiz[r.quiz_id].max += r.max_score ?? 0;
      }

      const withStats: QuizWithStats[] = quizzesRaw.map((q) => {
        const agg = byQuiz[q.id] ?? { score: 0, max: 0 };
        const pct = agg.max > 0 ? (agg.score / agg.max) * 100 : null;
        return {
          ...q,
          totalScore: agg.score,
          totalMax: agg.max,
          percentage: pct,
        };
      });

      setQuizzes(withStats);
      setLoading(false);
    }

    load();
  }, []);

  const totalQuizzes = quizzes.length;
  const avgPercentage =
    quizzes.length > 0
      ? quizzes.reduce((sum, q) => sum + (q.percentage ?? 0), 0) /
        quizzes.filter((q) => q.percentage != null).length
      : 0;
  const positions = quizzes
    .map((q) => q.position)
    .filter((p): p is number => p != null);
  const avgPosition =
    positions.length > 0
      ? positions.reduce((s, p) => s + p, 0) / positions.length
      : null;
  const winCount = quizzes.filter((q) => q.position === 1).length;

  const chartQuizzes = [...quizzes].sort((a, b) =>
    a.quiz_date.localeCompare(b.quiz_date)
  );
  const last5 = [...quizzes]
    .sort((a, b) => b.quiz_date.localeCompare(a.quiz_date))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* "Chart" area */}
      <section className="border border-neutral-800 rounded-lg p-3">
        <h2 className="text-xs font-semibold text-neutral-200 mb-2">
          Performance over time
        </h2>
        {loading ? (
          <p className="text-xs text-neutral-400">Loading…</p>
        ) : chartQuizzes.length === 0 ? (
          <p className="text-xs text-neutral-400">
            No quizzes yet. Tap + to add your first one.
          </p>
        ) : (
          <div className="space-y-1">
            {chartQuizzes.map((q) => {
              const pct = q.percentage ?? 0;
              const width = Math.max(5, Math.min(100, pct));
              return (
                <div key={q.id} className="flex items-center gap-2">
                  <div className="w-20 text-[11px] text-neutral-400 shrink-0">
                    {q.quiz_date.slice(5)} {/* MM-DD */}
                  </div>
                  <div className="flex-1 h-3 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="w-10 text-[11px] text-right text-neutral-300 shrink-0">
                    {q.percentage != null
                      ? `${q.percentage.toFixed(0)}%`
                      : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Stats cards */}
      <section className="grid grid-cols-2 gap-2">
        <StatCard
          label="Total quizzes"
          value={loading ? "…" : totalQuizzes.toString()}
        />
        <StatCard
          label="Average score"
          value={
            loading || totalQuizzes === 0
              ? "—"
              : `${avgPercentage.toFixed(1)}%`
          }
        />
        <StatCard
          label="Average position"
          value={
            loading || avgPosition == null
              ? "—"
              : avgPosition.toFixed(1)
          }
        />
        <StatCard
          label="Wins"
          value={loading ? "…" : winCount.toString()}
        />
      </section>

      {/* Recent quizzes */}
      <section className="border border-neutral-800 rounded-lg">
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
          <h2 className="text-xs font-semibold text-neutral-200">
            Recent quizzes
          </h2>
          <Link
            href="/quizzes"
            className="text-[11px] text-emerald-400 underline"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <p className="px-3 py-2 text-xs text-neutral-400">
            Loading…
          </p>
        ) : last5.length === 0 ? (
          <p className="px-3 py-2 text-xs text-neutral-400">
            No quizzes yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-800 text-xs">
            {last5.map((q) => {
              const summaryParts: string[] = [];
              if (q.position != null) {
                summaryParts.push(
                  q.position === 1
                    ? "Win"
                    : `Pos ${q.position}${
                        q.teams_total ? `/${q.teams_total}` : ""
                      }`
                );
              }
              if (q.totalScore && q.totalMax) {
                summaryParts.push(
                  `${q.totalScore}/${q.totalMax} pts`
                );
              }
              return (
                <li key={q.id}>
                  <Link
                    href={`/quizzes/${q.id}`}
                    className="flex flex-col px-3 py-2 hover:bg-neutral-900"
                  >
                    <span className="font-medium text-neutral-100">
                      {q.quiz_name} – {q.quiz_date}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {summaryParts.join(" · ") || "Tap to edit"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-800 rounded-lg px-3 py-2">
      <div className="text-[11px] text-neutral-400">{label}</div>
      <div className="text-lg font-semibold text-neutral-50">
        {value}
      </div>
    </div>
  );
}
