// src/components/quizzes/QuizViewer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/quiz";

type QuizRow = {
  id: string;
  quiz_date: string;
  quiz_name: string;
  is_big_quiz: boolean;
  teams_total: number | null;
  position: number | null;
  notes: string | null;

  first_team_name: string | null;
  first_team_score: number | null;
  first_team_is_us: boolean | null;
  second_team_name: string | null;
  second_team_score: number | null;
  second_team_is_us: boolean | null;
  third_team_name: string | null;
  third_team_score: number | null;
  third_team_is_us: boolean | null;
};

type RoundRow = {
  id: string;
  quiz_id: string;
  round_number: number;
  round_name: string | null;
  score: number | null;
  max_score: number | null;
  notes: string | null;
  highest_unique: boolean | null;
};

type PlayerRow = {
  id: string;
  name: string;
};

export default function QuizViewer() {
  const params = useParams<{ quizId: string }>();
  const quizId = params?.quizId as string | undefined;
  const router = useRouter();

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [roundsWithQuestions, setRoundsWithQuestions] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!quizId) {
        setMessage("Invalid quiz id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        // 1) Quiz
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select(
            `
            id,
            quiz_date,
            quiz_name,
            is_big_quiz,
            teams_total,
            position,
            notes,
            first_team_name,
            first_team_score,
            first_team_is_us,
            second_team_name,
            second_team_score,
            second_team_is_us,
            third_team_name,
            third_team_score,
            third_team_is_us
          `
          )
          .eq("id", quizId)
          .maybeSingle();

        if (quizError) {
          console.error("[QuizViewer] quiz error:", quizError);
          throw quizError;
        }
        if (!quizData) {
          setMessage("Quiz not found.");
          setLoading(false);
          return;
        }
        setQuiz(quizData as QuizRow);

        // 2) Rounds
        const { data: roundsData, error: roundsError } = await supabase
          .from("rounds")
          .select(
            "id, quiz_id, round_number, round_name, score, max_score, notes, highest_unique"
          )
          .eq("quiz_id", quizId)
          .order("round_number", { ascending: true });

        if (roundsError) {
          console.error("[QuizViewer] rounds error:", roundsError);
          throw roundsError;
        }
        const roundsList = (roundsData as RoundRow[]) ?? [];
        setRounds(roundsList);

        const roundIds = roundsList.map((r) => r.id);

        // 3) Attendees (quiz_players + players)
        const { data: qpData, error: qpError } = await supabase
          .from("quiz_players")
          .select("player_id")
          .eq("quiz_id", quizId);

        if (qpError) {
          console.error("[QuizViewer] quiz_players error:", qpError);
        }

        const playerIds =
          (qpData ?? []).map((qp: any) => qp.player_id as string) ?? [];

        if (playerIds.length > 0) {
          const { data: playersData, error: playersError } = await supabase
            .from("players")
            .select("id, name")
            .in("id", playerIds);

          if (playersError) {
            console.error("[QuizViewer] players error:", playersError);
          } else {
            const list = (playersData as PlayerRow[]) ?? [];
            list.sort((a, b) => a.name.localeCompare(b.name));
            setPlayers(list);
          }
        } else {
          setPlayers([]);
        }

        // 4) Which rounds have questions
        if (roundIds.length > 0) {
          const { data: questionsData, error: questionsError } =
            await supabase
              .from("questions")
              .select("round_id")
              .in("round_id", roundIds);

          if (questionsError) {
            console.error("[QuizViewer] questions error:", questionsError);
          } else {
            const ids = new Set<string>();
            (questionsData ?? []).forEach((q: any) =>
              ids.add(q.round_id as string)
            );
            setRoundsWithQuestions(ids);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error("[QuizViewer] unexpected error:", err);
        setMessage(err.message ?? "Error loading quiz. Try again later.");
        setLoading(false);
      }
    }

    load();
  }, [quizId]);

  const totalScore =
    rounds.reduce((sum, r) => sum + (r.score ?? 0), 0) || 0;
  const totalMax =
    rounds.reduce((sum, r) => sum + (r.max_score ?? 0), 0) || 0;

  const attendeesCount = players.length;
  const winText = useMemo(() => {
    if (!quiz?.position) return null;
    if (quiz.position === 1) return "Win";
    if (quiz.position === 2) return "2nd place";
    if (quiz.position === 3) return "3rd place";
    return `${quiz.position} place`;
  }, [quiz]);

  function goToEdit() {
    if (!quiz) return;
    router.push(`/quizzes/${quiz.id}/edit`);
  }

  function goToRound(roundNumber: number) {
    if (!quiz) return;
    router.push(`/quizzes/${quiz.id}/edit?round=${roundNumber}`);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-sm text-neutral-300">Loading quiz…</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-sm text-neutral-300">
          {message ?? "Quiz not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative max-w-2xl mx-auto p-4 space-y-4">
      {/* Summary at top */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-neutral-50">
              {quiz.quiz_name}
            </h1>
            <p className="text-xs text-neutral-400">
              {quiz.quiz_date}
              {quiz.is_big_quiz && (
                <span className="inline-flex items-center px-2 py-[2px] ml-1.5 rounded-md border border-blue-400/60 bg-blue-400/10 text-[10px] font-medium uppercase tracking-wide text-blue-200">
                  Big Quiz
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <StatCard
            label="Placement"
            value={
              winText ?? (quiz.position != null ? `${quiz.position}` : "—")
            }
            isWin={quiz.position === 1}
          />
          <StatCard
            label="Points"
            value={
              totalMax > 0
                ? `${totalScore}/${totalMax} (${(
                    (totalScore / totalMax) *
                    100
                  ).toFixed(1)}%)`
                : "—"
            }
          />
          <StatCard
            label="Attendees"
            value={
              attendeesCount > 0
                ? `${attendeesCount} player${
                    attendeesCount === 1 ? "" : "s"
                  }`
                : "—"
            }
          />
          <StatCard
            label="Teams"
            value={
              quiz.teams_total != null ? `${quiz.teams_total} total` : "—"
            }
          />
        </div>
      </section>

      {/* Attendees */}
      <section className="border border-neutral-800 rounded-lg p-3 space-y-1">
        <h2 className="text-xs font-semibold text-neutral-200 mb-1">
          Attendees
        </h2>
        {players.length === 0 ? (
          <p className="text-[11px] text-neutral-400">
            No attendees recorded.
          </p>
        ) : (
          <p className="text-[11px] text-neutral-200">
            {players.map((p) => p.name).join(", ")}
          </p>
        )}
      </section>

      {/* Rounds */}
      <section className="border border-neutral-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-neutral-200">Rounds</h2>
          <p className="text-[11px] text-neutral-400">
            Tap a round to view / edit questions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left py-1 px-1">#</th>
                <th className="text-left py-1 px-1">Round</th>
                <th className="text-right py-1 px-1">Score</th>
                <th className="text-right py-1 px-1">Max</th>
                <th className="text-center py-1 px-1">Details</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => {
                const hasQuestions = roundsWithQuestions.has(r.id);
                const hasNotes =
                  !!r.notes && r.notes.trim().length > 0;

                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900 cursor-pointer"
                    onClick={() => goToRound(r.round_number)}
                  >
                    <td className="py-1 px-1 align-top">
                      {r.round_number}
                    </td>

                    {/* Round name + HU badge */}
                    <td className="py-1 px-1 align-top">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-100">
                          {r.round_name ?? ""}
                        </span>

                        {r.highest_unique && (
                          <span className="inline-flex items-center px-2 py-[2px] rounded-md border border-emerald-300 bg-emerald-300/20 text-[10px] font-medium uppercase tracking-wide text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.6)]">
                            HU
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-1 px-1 text-right align-top">
                      {r.score ?? "—"}
                    </td>

                    <td className="py-1 px-1 text-right align-top">
                      {r.max_score ?? "—"}
                    </td>

                    <td className="py-1 px-1 text-center align-top">
                      {hasQuestions || hasNotes ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                          {hasQuestions && <span>Q</span>}
                          {hasNotes && <span>Notes</span>}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top 3 results */}
      <section className="border border-neutral-800 rounded-lg p-3 space-y-2">
        <h2 className="text-xs font-semibold text-neutral-200 mb-1">
          Results
        </h2>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="text-left py-1 px-1">Position</th>
              <th className="text-left py-1 px-1">Team</th>
              <th className="text-right py-1 px-1">Score</th>
            </tr>
          </thead>
          <tbody>
            <ResultRow
              label="1st"
              teamName={quiz.first_team_name}
              score={quiz.first_team_score}
              isUs={quiz.first_team_is_us}
            />
            <ResultRow
              label="2nd"
              teamName={quiz.second_team_name}
              score={quiz.second_team_score}
              isUs={quiz.second_team_is_us}
            />
            <ResultRow
              label="3rd"
              teamName={quiz.third_team_name}
              score={quiz.third_team_score}
              isUs={quiz.third_team_is_us}
            />
          </tbody>
        </table>
      </section>

      {/* Quiz notes */}
      <section className="border border-neutral-800 rounded-lg p-3 space-y-1">
        <h2 className="text-xs font-semibold text-neutral-200 mb-1">
          Quiz notes
        </h2>
        {quiz.notes && quiz.notes.trim() !== "" ? (
          <p className="text-[11px] text-neutral-200 whitespace-pre-wrap">
            {quiz.notes}
          </p>
        ) : (
          <p className="text-[11px] text-neutral-500">
            No notes for this quiz yet.
          </p>
        )}
      </section>

      {/* Edit button */}
      <button
        type="button"
        onClick={goToEdit}
        className="fixed bottom-16 right-4 bg-emerald-500 text-black text-sm font-semibold px-4 py-2 rounded-full shadow-lg"
      >
        Edit
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  isWin = false,
}: {
  label: string;
  value: string;
  isWin?: boolean;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg px-3 py-2">
      <div className="text-[11px] text-neutral-400">{label}</div>
      <div
        className={
          isWin
            ? "inline-block text-sm font-semibold text-emerald-300 animate-pulse drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
            : "text-sm font-semibold text-neutral-50"
        }
      >
        {value}
      </div>
    </div>
  );
}

function ResultRow({
  label,
  teamName,
  score,
  isUs,
}: {
  label: string;
  teamName: string | null;
  score: number | null;
  isUs: boolean | null;
}) {
  if (!teamName && score == null) {
    return null;
  }

  // Highlight 1st place when it's us, matching the "Win" styling
  const isWinRow = label === "1st" && !!isUs;

  return (
    <tr
      className={
        "border-b border-neutral-900 last:border-0" +
        (isWinRow ? " animate-pulse" : "")
      }
    >
      <td className="py-1 px-1 text-neutral-300">{label}</td>
      <td className="py-1 px-1">
        <span
          className={
            isWinRow
              ? "inline-block font-semibold text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
              : "text-neutral-100"
          }
        >
          {teamName ?? "—"}
          {isUs && (
            <span
              className={
                isWinRow
                  ? "ml-1 text-[10px] font-semibold"
                  : "ml-1 text-[10px] text-emerald-300"
              }
            >
              (us)
            </span>
          )}
        </span>
      </td>
      <td className="py-1 px-1 text-right">
        <span
          className={
            isWinRow
              ? "inline-block font-semibold text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
              : "text-neutral-100"
          }
        >
          {score != null ? score : "—"}
        </span>
      </td>
    </tr>
  );
}
