// src/components/quizzes/QuizList.tsx
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

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("quizzes")
        .select(
          "id, quiz_date, quiz_name, is_big_quiz, position, teams_total"
        )
        .order("quiz_date", { ascending: false });

      if (error) {
        console.error("[QuizList] Error loading quizzes:", error);
        setQuizzes([]);
      } else {
        setQuizzes((data as QuizRow[]) ?? []);
      }
      setLoading(false);
    }

    load();
  }, []);

  const filtered = quizzes.filter((q) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      q.quiz_name.toLowerCase().includes(term) ||
      q.quiz_date.includes(term)
    );
  });

  return (
    <div className="space-y-3">
      <h1 className="text-sm font-semibold mb-1">Quizzes</h1>

      <input
        type="text"
        className="w-full border border-neutral-800 rounded px-2 py-1 text-sm bg-neutral-950"
        placeholder="Search by date or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-xs text-neutral-400 mt-2">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-neutral-400 mt-2">
          No quizzes found.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-800 text-xs">
          {filtered.map((q) => (
            <li key={q.id}>
              <Link
                href={`/quizzes/${q.id}`}
                className="flex flex-col px-2 py-2 hover:bg-neutral-900 rounded"
              >
                <span className="font-medium text-neutral-100">
                  {q.quiz_name} – {q.quiz_date}
                </span>
                <span className="text-[11px] text-neutral-400">
                  {q.is_big_quiz ? "Big quiz" : "Small quiz"}{" "}
                  {q.position != null &&
                    `· Pos ${q.position}${
                      q.teams_total ? `/${q.teams_total}` : ""
                    }`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
