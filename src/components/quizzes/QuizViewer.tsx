// src/components/quizzes/QuizViewer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/quiz";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";

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
        <p className="text-sm text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-sm text-muted-foreground">
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
            <h1 className="text-lg font-semibold">{quiz.quiz_name}</h1>
            <p className="text-xs text-muted-foreground">
              {quiz.quiz_date}
              {quiz.is_big_quiz && (
                <Badge variant="outline" className="ml-2 border-blue-400/60 bg-blue-400/10 text-blue-300">
                  Big Quiz
                </Badge>
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
              players.length > 0
                ? players.map((p) => p.name).join(", ")
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

      {/* Rounds */}
      <Card className="gap-1">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold">Rounds</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tap a round to view / edit questions
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Round</TableHead>
                <TableHead className="text-right w-16">Score</TableHead>
                <TableHead className="text-right w-16">Max</TableHead>
                <TableHead className="text-center w-20">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => {
                const hasQuestions = roundsWithQuestions.has(r.id);
                const hasNotes = !!r.notes && r.notes.trim().length > 0;

                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => goToRound(r.round_number)}
                  >
                    <TableCell className="text-xs">{r.round_number}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.round_name ?? ""}</span>
                        {r.highest_unique && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400 hover:bg-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                            HU
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.score ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.max_score ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {hasQuestions || hasNotes ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          {hasQuestions && <span>Q</span>}
                          {hasNotes && <span>Notes</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top 3 results */}
      <Card className="gap-1">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold">Results</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Position</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right w-20">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quiz notes */}
      <Card className="gap-1">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-semibold">Quiz notes</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {quiz.notes && quiz.notes.trim() !== "" ? (
            <p className="text-xs whitespace-pre-wrap">{quiz.notes}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No notes for this quiz yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit button */}
      <Button
        onClick={goToEdit}
        className="fixed bottom-16 right-4 rounded-full shadow-lg"
        size="lg"
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit
      </Button>
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
    <Card className="px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          isWin
            ? "text-sm font-semibold text-emerald-400 animate-pulse drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
            : "text-sm font-semibold"
        }
      >
        {value}
      </div>
    </Card>
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

  const isWinRow = label === "1st" && !!isUs;

  return (
    <TableRow className={isWinRow ? "animate-pulse" : ""}>
      <TableCell className="text-xs text-muted-foreground">{label}</TableCell>
      <TableCell className="text-xs">
        <span
          className={
            isWinRow
              ? "font-semibold text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
              : ""
          }
        >
          {teamName ?? "—"}
          {isUs && (
            <Badge
              variant="outline"
              className={
                isWinRow
                  ? "ml-2 text-emerald-400 border-emerald-400"
                  : "ml-2 text-emerald-400 border-emerald-400/50"
              }
            >
              us
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right text-xs">
        <span
          className={
            isWinRow
              ? "font-semibold text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.9)]"
              : ""
          }
        >
          {score != null ? score : "—"}
        </span>
      </TableCell>
    </TableRow>
  );
}
