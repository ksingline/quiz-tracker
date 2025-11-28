// src/app/quizzes/[quizId]/QuizRoundsClient.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/quiz";

type QuizRow = {
  id: string;
  quiz_date: string;
  quiz_name: string;
  is_big_quiz: boolean;
  teams_total: number | null;
  position: number | null;
  notes: string | null;
};

type RoundRow = {
  id: string;
  quiz_id: string;
  round_number: number;
  round_name: string | null;
  score: number | null;
  max_score: number | null;
};

export default function QuizRoundsClient() {
  const params = useParams<{ quizId: string }>();
  const quizId = params?.quizId as string | undefined;

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!quizId) {
        console.error("[QuizRoundsClient] quizId is falsy from useParams:", params);
        setMessage("Invalid quiz id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage(null);

      console.log("[QuizRoundsClient] quizId =", quizId);

      // Fetch quiz
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .maybeSingle();

      console.log("[QuizRoundsClient] quizData =", quizData);
      console.log("[QuizRoundsClient] quizError =", quizError);

      if (quizError) {
        console.error("[QuizRoundsClient] Error loading quiz:", quizError);
        setMessage(
          `Failed to load quiz: ${
            (quizError as any).message ?? "unknown error"
          }`
        );
        setLoading(false);
        return;
      }

      if (!quizData) {
        console.error("[QuizRoundsClient] No quiz found for id:", quizId);
        setMessage("No quiz found for this id.");
        setLoading(false);
        return;
      }

      setQuiz(quizData as QuizRow);

      // Fetch rounds
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("quiz_id", quizId)
        .order("round_number", { ascending: true });

      console.log("[QuizRoundsClient] roundsData =", roundsData);
      console.log("[QuizRoundsClient] roundsError =", roundsError);

      if (roundsError) {
        console.error("[QuizRoundsClient] Error loading rounds:", roundsError);
        setMessage(
          `Failed to load rounds: ${
            (roundsError as any).message ?? "unknown error"
          }`
        );
        setLoading(false);
        return;
      }

      setRounds((roundsData as RoundRow[]) ?? []);
      setLoading(false);
    }

    load();
  }, [quizId, params]);

  function handleRoundFieldChange(
    index: number,
    field: "round_name" | "score" | "max_score",
    value: string
  ) {
    setRounds((prev) => {
      const copy = [...prev];
      const round = { ...copy[index] };

      if (field === "round_name") {
        round.round_name = value;
      } else {
        const num = value === "" ? null : Number(value);
        round[field] = Number.isNaN(num) ? null : num;
      }

      copy[index] = round;
      return copy;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      for (const round of rounds) {
        const { error } = await supabase
          .from("rounds")
          .update({
            round_name: round.round_name,
            score: round.score,
            max_score: round.max_score,
          })
          .eq("id", round.id);

        if (error) {
          console.error("[QuizRoundsClient] Error updating round:", error);
          throw error;
        }
      }

      setMessage("Rounds saved ✅");
    } catch (err: any) {
      console.error("[QuizRoundsClient] Save error:", err);
      setMessage(`Error saving: ${err.message ?? "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  const totalScore =
    rounds.reduce((sum, r) => sum + (r.score ?? 0), 0) || 0;
  const totalMax =
    rounds.reduce((sum, r) => sum + (r.max_score ?? 0), 0) || 0;

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-4">
        <p>Loading quiz…</p>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="max-w-2xl mx-auto p-4">
        <p>{message ?? "Quiz not found."}</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">
          {quiz.quiz_name} – {quiz.quiz_date}
        </h1>
        <p className="text-sm text-gray-600">
          {quiz.is_big_quiz ? "Big quiz" : "Small quiz"}
          {quiz.position != null ? ` · Position: ${quiz.position}` : ""}
          {quiz.teams_total != null ? ` of ${quiz.teams_total} teams` : ""}
        </p>
        {quiz.notes && (
          <p className="text-sm text-gray-600">Notes: {quiz.notes}</p>
        )}
      </header>

      <section className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">Round</th>
              <th className="text-right py-1 px-2">Score</th>
              <th className="text-right py-1 px-2">Max</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, idx) => (
              <tr key={round.id} className="border-b last:border-0">
                <td className="py-1 pr-2 align-top">
                  {round.round_number}
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="text"
                    className="w-full border rounded px-1 py-0.5 text-sm"
                    value={round.round_name ?? ""}
                    onChange={(e) =>
                      handleRoundFieldChange(
                        idx,
                        "round_name",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-2 text-right">
                  <input
                    type="number"
                    className="w-16 border rounded px-1 py-0.5 text-right text-sm"
                    value={round.score ?? ""}
                    onChange={(e) =>
                      handleRoundFieldChange(
                        idx,
                        "score",
                        e.target.value
                      )
                    }
                    min={0}
                  />
                </td>
                <td className="py-1 px-2 text-right">
                  <input
                    type="number"
                    className="w-16 border rounded px-1 py-0.5 text-right text-sm"
                    value={round.max_score ?? ""}
                    onChange={(e) =>
                      handleRoundFieldChange(
                        idx,
                        "max_score",
                        e.target.value
                      )
                    }
                    min={0}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium">
            Total: {totalScore} / {totalMax}
          </span>
          {totalMax > 0 && (
            <span className="ml-2 text-gray-600">
              ({((totalScore / totalMax) * 100).toFixed(1)}%)
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-black text-white px-3 py-1 rounded disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save rounds"}
        </button>
      </section>

      {message && quiz && (
        <p className="text-sm text-gray-700">{message}</p>
      )}
    </main>
  );
}
