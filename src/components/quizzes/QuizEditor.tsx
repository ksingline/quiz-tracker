// src/components/quizzes/QuizEditor.tsx (or src/app/quizzes/[quizId]/QuizEditor.tsx)

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

  joker_round_number: number | null;
};

type RoundRow = {
  id: string;
  quiz_id: string;
  round_number: number;
  round_name: string | null;
  score: number | null;
  max_score: number | null;
  notes: string | null;
};

type QuestionRow = {
  id?: string;
  round_id: string;
  question_number: number;
  question_text: string | null;
  our_answer: string | null;
  is_correct: boolean | null;
  question_type: "normal" | "killer" | "wipeout";
  points_value: number | null;
  points_scored: number | null;
};

export default function QuizEditor() {
  const params = useParams<{ quizId: string }>();
  const quizId = params?.quizId as string | undefined;
  const searchParams = useSearchParams();
  const initialRoundParam = searchParams.get("round");

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRounds, setSavingRounds] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Joker state: which round_number is joker
  const [jokerRoundNumber, setJokerRoundNumber] = useState<number | null>(
    null
  );

  // Quiz-level notes state
  const [quizNotes, setQuizNotes] = useState<string>("");
  const [quizNotesOpen, setQuizNotesOpen] = useState(false);
  const [quizNotesSaving, setQuizNotesSaving] = useState(false);
  const [quizNotesMessage, setQuizNotesMessage] = useState<string | null>(
    null
  );

  // Results / podium state
  const [results, setResults] = useState({
    firstTeamName: "",
    firstTeamScore: "",
    firstTeamIsUs: false,
    secondTeamName: "",
    secondTeamScore: "",
    secondTeamIsUs: false,
    thirdTeamName: "",
    thirdTeamScore: "",
    thirdTeamIsUs: false,
    teamsTotal: "",
    ourPosition: "",
  });
  const [savingResults, setSavingResults] = useState(false);
  const [resultsMessage, setResultsMessage] = useState<string | null>(null);

  // Questions editor state
  const [editingRoundIndex, setEditingRoundIndex] = useState<number | null>(
    null
  );
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsSaving, setQuestionsSaving] = useState(false);
  const [questionsMessage, setQuestionsMessage] = useState<string | null>(
    null
  );
  const [currentRoundNotes, setCurrentRoundNotes] = useState<string>("");

  // ---- Load quiz & rounds ----
  useEffect(() => {
    async function load() {
      if (!quizId) {
        console.error("[QuizEditor] quizId is falsy from useParams:", params);
        setMessage("Invalid quiz id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage(null);

      console.log("[QuizEditor] quizId =", quizId);

      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .maybeSingle();

      console.log("[QuizEditor] quizData =", quizData);
      console.log("[QuizEditor] quizError =", quizError);

      if (quizError) {
        console.error("[QuizEditor] Error loading quiz:", quizError);
        setMessage(
          `Failed to load quiz: ${(quizError as any).message ?? "unknown error"
          }`
        );
        setLoading(false);
        return;
      }

      if (!quizData) {
        console.error("[QuizEditor] No quiz found for id:", quizId);
        setMessage("No quiz found for this id.");
        setLoading(false);
        return;
      }

      const quizRow = quizData as QuizRow;
      setQuiz(quizRow);
      setJokerRoundNumber(quizRow.joker_round_number ?? null);

      // Initialise quiz-level notes
      setQuizNotes(quizRow.notes ?? "");
      setQuizNotesMessage(null);

      setResults({
        firstTeamName: quizRow.first_team_name ?? "",
        firstTeamScore:
          quizRow.first_team_score != null
            ? String(quizRow.first_team_score)
            : "",
        firstTeamIsUs: Boolean(quizRow.first_team_is_us),
        secondTeamName: quizRow.second_team_name ?? "",
        secondTeamScore:
          quizRow.second_team_score != null
            ? String(quizRow.second_team_score)
            : "",
        secondTeamIsUs: Boolean(quizRow.second_team_is_us),
        thirdTeamName: quizRow.third_team_name ?? "",
        thirdTeamScore:
          quizRow.third_team_score != null
            ? String(quizRow.third_team_score)
            : "",
        thirdTeamIsUs: Boolean(quizRow.third_team_is_us),
        teamsTotal:
          quizRow.teams_total != null
            ? String(quizRow.teams_total)
            : "",
        ourPosition:
          quizRow.position != null
            ? String(quizRow.position)
            : "",
      });


      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("quiz_id", quizId)
        .order("round_number", { ascending: true });

      console.log("[QuizEditor] roundsData =", roundsData);
      console.log("[QuizEditor] roundsError =", roundsError);

      if (roundsError) {
        console.error("[QuizEditor] Error loading rounds:", roundsError);
        setMessage(
          `Failed to load rounds: ${(roundsError as any).message ?? "unknown error"
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

  useEffect(() => {
    if (!initialRoundParam) return;
    if (!rounds.length) return;
    if (editingRoundIndex != null) return;

    const roundNumber = Number(initialRoundParam);
    if (!Number.isFinite(roundNumber)) return;

    const idx = rounds.findIndex(
      (r) => r.round_number === roundNumber
    );
    if (idx >= 0) {
      // open the questions editor for that round
      void openQuestionsEditor(idx);
    }
  }, [initialRoundParam, rounds, editingRoundIndex]);

  // ---- Quiz notes handler ----

  async function handleSaveQuizNotes() {
    if (!quiz) return;
    setQuizNotesSaving(true);
    setQuizNotesMessage(null);

    try {
      const trimmed = quizNotes.trim();
      const { error } = await supabase
        .from("quizzes")
        .update({ notes: trimmed === "" ? null : trimmed })
        .eq("id", quiz.id);

      if (error) {
        console.error("[QuizEditor] Save quiz notes error:", error);
        throw error;
      }

      setQuiz((prev) =>
        prev
          ? {
            ...prev,
            notes: trimmed === "" ? null : trimmed,
          }
          : prev
      );

      setQuizNotesMessage("Notes saved ✅");
    } catch (err: any) {
      setQuizNotesMessage(
        `Error saving notes: ${err.message ?? "unknown error"}`
      );
    } finally {
      setQuizNotesSaving(false);
    }
  }

  // ---- Round editor handlers ----

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

  async function handleSaveRounds() {
    setSavingRounds(true);
    setMessage(null);

    try {
      // Save round-level fields
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
          console.error("[QuizEditor] Error updating round:", error);
          throw error;
        }
      }

      // Save joker selection on the quiz
      if (quiz) {
        const { error: quizError } = await supabase
          .from("quizzes")
          .update({
            joker_round_number: jokerRoundNumber,
          })
          .eq("id", quiz.id);

        if (quizError) {
          console.error("[QuizEditor] Error saving joker:", quizError);
          throw quizError;
        }

        setQuiz((prev) =>
          prev ? { ...prev, joker_round_number: jokerRoundNumber } : prev
        );
      }

      setMessage("Rounds & joker saved ✅");
    } catch (err: any) {
      console.error("[QuizEditor] Save rounds error:", err);
      setMessage(`Error saving: ${err.message ?? "unknown error"}`);
    } finally {
      setSavingRounds(false);
    }
  }

  const totalScore =
    rounds.reduce((sum, r) => sum + (r.score ?? 0), 0) || 0;
  const totalMax =
    rounds.reduce((sum, r) => sum + (r.max_score ?? 0), 0) || 0;

  // ---- Results handlers ----

  function handleResultsChange(
    field:
      | "firstTeamName"
      | "firstTeamScore"
      | "firstTeamIsUs"
      | "secondTeamName"
      | "secondTeamScore"
      | "secondTeamIsUs"
      | "thirdTeamName"
      | "thirdTeamScore"
      | "thirdTeamIsUs"
      | "teamsTotal"
      | "ourPosition",
    value: string | boolean
  ) {
    setResults((prev) => {
      const next: typeof prev = { ...prev, [field]: value };

      // Only one "our team?" can be true
      if (field === "firstTeamIsUs" && value === true) {
        next.secondTeamIsUs = false;
        next.thirdTeamIsUs = false;
      } else if (field === "secondTeamIsUs" && value === true) {
        next.firstTeamIsUs = false;
        next.thirdTeamIsUs = false;
      } else if (field === "thirdTeamIsUs" && value === true) {
        next.firstTeamIsUs = false;
        next.secondTeamIsUs = false;
      }

      return next;
    });
  }

  async function handleSaveResults() {
    if (!quiz) return;
    setSavingResults(true);
    setResultsMessage(null);

    try {
      const toInt = (val: string) =>
        val.trim() === "" ? null : Number(val);

      // Derive position from "our team?" flags
      // Derive position:
      // 1) from "our team?" flags if set
      let derivedPosition: number | null = null;
      if (results.firstTeamIsUs) derivedPosition = 1;
      else if (results.secondTeamIsUs) derivedPosition = 2;
      else if (results.thirdTeamIsUs) derivedPosition = 3;

      // 2) else from explicit ourPosition field
      const explicitPosition = toInt(results.ourPosition);

      const finalPosition =
        derivedPosition != null
          ? derivedPosition
          : explicitPosition != null
            ? explicitPosition
            : quiz.position;

      const updatePayload = {
        first_team_name:
          results.firstTeamName.trim() === ""
            ? null
            : results.firstTeamName.trim(),
        first_team_score: toInt(results.firstTeamScore),
        first_team_is_us: results.firstTeamIsUs || null,

        second_team_name:
          results.secondTeamName.trim() === ""
            ? null
            : results.secondTeamName.trim(),
        second_team_score: toInt(results.secondTeamScore),
        second_team_is_us: results.secondTeamIsUs || null,

        third_team_name:
          results.thirdTeamName.trim() === ""
            ? null
            : results.thirdTeamName.trim(),
        third_team_score: toInt(results.thirdTeamScore),
        third_team_is_us: results.thirdTeamIsUs || null,

        teams_total: toInt(results.teamsTotal),

        position: finalPosition,
      };


      const { error } = await supabase
        .from("quizzes")
        .update(updatePayload)
        .eq("id", quiz.id);

      if (error) {
        console.error("[QuizEditor] Save results error:", error);
        throw error;
      }

      setQuiz((prev) =>
        prev
          ? {
            ...prev,
            first_team_name: updatePayload.first_team_name,
            first_team_score: updatePayload.first_team_score,
            first_team_is_us: updatePayload.first_team_is_us,
            second_team_name: updatePayload.second_team_name,
            second_team_score: updatePayload.second_team_score,
            second_team_is_us: updatePayload.second_team_is_us,
            third_team_name: updatePayload.third_team_name,
            third_team_score: updatePayload.third_team_score,
            third_team_is_us: updatePayload.third_team_is_us,
            teams_total: updatePayload.teams_total,
            position: updatePayload.position ?? prev.position,
          }
          : prev
      );

      setResultsMessage("Results saved ✅");
    } catch (err: any) {
      setResultsMessage(
        `Error saving results: ${err.message ?? "unknown error"}`
      );
    } finally {
      setSavingResults(false);
    }
  }

  // ---- Questions editor ----

  const currentRound =
    editingRoundIndex != null ? rounds[editingRoundIndex] : null;

  async function openQuestionsEditor(roundIndex: number) {
    const round = rounds[roundIndex];
    setEditingRoundIndex(roundIndex);
    setQuestionsLoading(true);
    setQuestionsMessage(null);

    // Initialise round notes for this round
    setCurrentRoundNotes(round.notes ?? "");

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("round_id", round.id)
      .order("question_number", { ascending: true });

    if (error) {
      console.error("[QuizEditor] Error loading questions:", error);
      setQuestionsMessage(
        `Failed to load questions: ${(error as any).message ?? "unknown error"
        }`
      );
      setQuestions([]);
      setQuestionsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      const count =
        (round.max_score && round.max_score > 0 && round.max_score <= 50
          ? round.max_score
          : 10) || 10;

      const initial: QuestionRow[] = Array.from(
        { length: count },
        (_, i) => ({
          round_id: round.id,
          question_number: i + 1,
          question_text: "",
          our_answer: "",
          is_correct: null,
          question_type: "normal",
          points_value: 1,
          points_scored: null,
        })
      );

      setQuestions(initial);
    } else {
      const rows = (data as any[]).map((q) => ({
        id: q.id as string,
        round_id: q.round_id as string,
        question_number: q.question_number as number,
        question_text: (q.question_text ?? "") as string | null,
        our_answer: (q.our_answer ?? "") as string | null,
        is_correct:
          q.is_correct === null
            ? null
            : Boolean(q.is_correct),
        question_type: (q.question_type ??
          "normal") as QuestionRow["question_type"],
        points_value:
          q.points_value === null ? null : Number(q.points_value),
        points_scored:
          q.points_scored === null ? null : Number(q.points_scored),
      }));
      setQuestions(rows);
    }

    setQuestionsLoading(false);
  }

  function handleQuestionFieldChange(
    index: number,
    field:
      | "question_text"
      | "our_answer"
      | "is_correct"
      | "question_type"
      | "points_value"
      | "points_scored",
    value: string | boolean
  ) {
    setQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[index] };

      if (field === "question_text" || field === "our_answer") {
        q[field] = (value as string) || "";
      } else if (field === "is_correct") {
        q.is_correct = value as boolean;
        if (q.question_type === "normal") {
          const pv = q.points_value ?? 1;
          q.points_scored = q.is_correct ? pv : 0;
        }
      } else if (field === "question_type") {
        q.question_type = value as QuestionRow["question_type"];
        if (q.question_type === "normal") {
          const pv = q.points_value ?? 1;
          q.points_scored =
            q.is_correct == null
              ? null
              : q.is_correct
                ? pv
                : 0;
        }
      } else {
        const str = value as string;
        const num = str === "" ? null : Number(str);
        (q as any)[field] = Number.isNaN(num) ? null : num;
      }

      copy[index] = q;
      return copy;
    });
  }

  function addQuestionRow() {
    if (!currentRound) return;
    setQuestions((prev) => {
      const nextNum =
        prev.length > 0
          ? Math.max(...prev.map((q) => q.question_number)) + 1
          : 1;
      return [
        ...prev,
        {
          round_id: currentRound.id,
          question_number: nextNum,
          question_text: "",
          our_answer: "",
          is_correct: null,
          question_type: "normal",
          points_value: 1,
          points_scored: null,
        },
      ];
    });
  }

  async function saveQuestionsAndMaybeNext(nextRound: boolean) {
    if (!currentRound) return;
    setQuestionsSaving(true);
    setQuestionsMessage(null);

    try {
      const trimmed = questions
        .filter((q) => {
          const hasContent =
            (q.question_text && q.question_text.trim() !== "") ||
            (q.our_answer && q.our_answer.trim() !== "") ||
            q.points_value != null ||
            q.points_scored != null ||
            q.is_correct != null;
          return hasContent;
        })
        .map((q, idx) => ({
          ...q,
          question_number: idx + 1,
        }));

      // ----- Base score & max (no joker) -----
      let baseMax = 0;
      let baseScore = 0;

      const computeBaseForQ = (q: QuestionRow) => {
        const max = q.points_value ?? 1;
        let scoreForQ = 0;
        if (q.points_scored != null) {
          scoreForQ = q.points_scored;
        } else if (q.question_type === "normal" && q.is_correct) {
          scoreForQ = max;
        }
        return { max, scoreForQ };
      };

      for (const q of trimmed) {
        const { max, scoreForQ } = computeBaseForQ(q);
        baseMax += max;
        baseScore += scoreForQ;
      }

      let totalMax = baseMax;
      let totalScore = baseScore;

      // ----- Joker logic -----
      const isJoker =
        jokerRoundNumber != null &&
        currentRound.round_number === jokerRoundNumber;

      if (isJoker && quiz) {
        const roundName = (currentRound.round_name ?? "").toLowerCase();
        const isFacebook =
          roundName.includes("facebook") ||
          currentRound.round_number === 7;
        const isPictures =
          roundName.includes("picture") ||
          currentRound.round_number === 8;

        // Spec: no joker on pictures; UI should prevent, but guard anyway
        if (!isPictures && trimmed.length > 0) {
          let bonusMax = 0;
          let bonusScore = 0;

          const limitForFacebook = quiz.is_big_quiz ? 8 : 5;

          for (const q of trimmed) {
            const { max, scoreForQ } = computeBaseForQ(q);

            let doubled = false;
            if (isFacebook) {
              // Only first 5 (small) or 8 (big) doubled
              if (q.question_number <= limitForFacebook) {
                doubled = true;
              }
            } else {
              // All questions in this round are doubled
              doubled = true;
            }

            if (doubled) {
              bonusMax += max;
              bonusScore += scoreForQ;
            }
          }

          totalMax = baseMax + bonusMax;
          totalScore = baseScore + bonusScore;
          // This gives:
          // - Facebook small: base 8 + bonus 5 = 13 max
          // - Facebook big:   base 10 + bonus 8 = 18 max
          // - Other rounds: full double (e.g. 5 -> 10, 8 -> 16)
        }
      }

      // Replace questions for this round
      await supabase
        .from("questions")
        .delete()
        .eq("round_id", currentRound.id);

      if (trimmed.length > 0) {
        const insertPayload = trimmed.map((q) => ({
          round_id: currentRound.id,
          question_number: q.question_number,
          question_text: q.question_text,
          our_answer: q.our_answer,
          is_correct: q.is_correct,
          question_type: q.question_type,
          points_value: q.points_value ?? 1,
          points_scored: q.points_scored,
        }));

        const { error: insertError } = await supabase
          .from("questions")
          .insert(insertPayload);

        if (insertError) {
          console.error(
            "[QuizEditor] Error inserting questions:",
            insertError
          );
          throw insertError;
        }
      }

      // Update round score + max_score (with joker handled) + notes
      const trimmedRoundNotes = currentRoundNotes.trim();
      const { error: roundUpdateError } = await supabase
        .from("rounds")
        .update({
          score: totalScore,
          max_score: totalMax || currentRound.max_score,
          notes: trimmedRoundNotes === "" ? null : trimmedRoundNotes,
        })
        .eq("id", currentRound.id);

      if (roundUpdateError) {
        console.error(
          "[QuizEditor] Error updating round from questions:",
          roundUpdateError
        );
        throw roundUpdateError;
      }

      // Update local rounds state
      setRounds((prev) =>
        prev.map((r, idx) =>
          idx === editingRoundIndex
            ? {
              ...r,
              score: totalScore,
              max_score: totalMax || r.max_score,
              notes: trimmedRoundNotes === "" ? null : trimmedRoundNotes,
            }
            : r
        )
      );

      setQuestionsMessage("Questions saved ✅");

      if (nextRound) {
        const nextIndex =
          editingRoundIndex != null &&
            editingRoundIndex + 1 < rounds.length
            ? editingRoundIndex + 1
            : null;

        if (nextIndex != null) {
          await openQuestionsEditor(nextIndex);
        } else {
          setEditingRoundIndex(null);
        }
      } else {
        setEditingRoundIndex(null);
      }
    } catch (err: any) {
      console.error("[QuizEditor] saveQuestions error:", err);
      setQuestionsMessage(
        `Error saving questions: ${err.message ?? "unknown error"}`
      );
    } finally {
      setQuestionsSaving(false);
    }
  }

  function closeQuestionsEditor() {
    setEditingRoundIndex(null);
    setQuestions([]);
    setQuestionsMessage(null);
  }

  // ---- Render ----

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
        {quiz.joker_round_number != null && (
          <p className="text-xs text-gray-600">
            Joker: Round {quiz.joker_round_number}
          </p>
        )}

        {/* Quiz-level notes */}
        <div className="mt-2">
          <button
            type="button"
            className="text-xs underline text-emerald-500"
            onClick={() => setQuizNotesOpen((open) => !open)}
          >
            {quizNotesOpen ? "Hide notes" : "Show notes"}
          </button>
          {quizNotesOpen && (
            <div className="mt-2 space-y-2">
              <textarea
                className="w-full min-h-[80px] border border-neutral-800 rounded bg-neutral-950 text-xs px-2 py-1 text-neutral-100"
                placeholder="Write notes about this quiz night – special events, theme, notable moments..."
                value={quizNotes}
                onChange={(e) => setQuizNotes(e.target.value)}
              />
              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={handleSaveQuizNotes}
                  disabled={quizNotesSaving}
                  className="px-3 py-1 border border-neutral-700 rounded bg-neutral-900 disabled:opacity-60"
                >
                  {quizNotesSaving ? "Saving…" : "Save notes"}
                </button>
                {quizNotesMessage && (
                  <span className="text-neutral-400">
                    {quizNotesMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Rounds + Joker + Questions button */}
      <section className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">Round</th>
              <th className="text-right py-1 px-2">Score</th>
              <th className="text-right py-1 px-2">Max</th>
              <th className="text-center py-1 px-2">Joker</th>
              <th className="text-right py-1 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, idx) => {
              const roundName = (round.round_name ?? "").toLowerCase();
              const isPictures =
                roundName.includes("picture") ||
                round.round_number === 8;

              return (
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
                  <td className="py-1 px-2 text-center">
                    {isPictures ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <input
                        type="radio"
                        name="jokerRound"
                        checked={
                          jokerRoundNumber === round.round_number
                        }
                        onChange={() =>
                          setJokerRoundNumber(round.round_number)
                        }
                      />
                    )}
                  </td>
                  <td className="py-1 px-2 text-right">
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => openQuestionsEditor(idx)}
                    >
                      Questions
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Rounds summary + save */}
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
          onClick={handleSaveRounds}
          disabled={savingRounds}
          className="bg-black text-white px-3 py-1 rounded disabled:opacity-60"
        >
          {savingRounds ? "Saving…" : "Save rounds & joker"}
        </button>
      </section>

      {message && (
        <p className="text-sm text-gray-700">
          {message}
        </p>
      )}

      {/* Results / podium editor */}
      <section className="mt-4 border rounded p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Results / Top teams</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 px-1">Position</th>
                <th className="text-left py-1 px-1">Team name</th>
                <th className="text-right py-1 px-1">Score</th>
                <th className="text-center py-1 px-1">Our team?</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-1 px-1">1st</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    className="w-full border rounded px-1 py-0.5"
                    value={results.firstTeamName}
                    onChange={(e) =>
                      handleResultsChange(
                        "firstTeamName",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    className="w-16 border rounded px-1 py-0.5 text-right"
                    value={results.firstTeamScore}
                    onChange={(e) =>
                      handleResultsChange(
                        "firstTeamScore",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-1 text-center">
                  <input
                    type="checkbox"
                    checked={results.firstTeamIsUs}
                    onChange={(e) =>
                      handleResultsChange(
                        "firstTeamIsUs",
                        e.target.checked
                      )
                    }
                  />
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-1 px-1">2nd</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    className="w-full border rounded px-1 py-0.5"
                    value={results.secondTeamName}
                    onChange={(e) =>
                      handleResultsChange(
                        "secondTeamName",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    className="w-16 border rounded px-1 py-0.5 text-right"
                    value={results.secondTeamScore}
                    onChange={(e) =>
                      handleResultsChange(
                        "secondTeamScore",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-1 text-center">
                  <input
                    type="checkbox"
                    checked={results.secondTeamIsUs}
                    onChange={(e) =>
                      handleResultsChange(
                        "secondTeamIsUs",
                        e.target.checked
                      )
                    }
                  />
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-1 px-1">3rd</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    className="w-full border rounded px-1 py-0.5"
                    value={results.thirdTeamName}
                    onChange={(e) =>
                      handleResultsChange(
                        "thirdTeamName",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-1 text-right">
                  <input
                    type="number"
                    className="w-16 border rounded px-1 py-0.5 text-right"
                    value={results.thirdTeamScore}
                    onChange={(e) =>
                      handleResultsChange(
                        "thirdTeamScore",
                        e.target.value
                      )
                    }
                  />
                </td>
                <td className="py-1 px-1 text-center">
                  <input
                    type="checkbox"
                    checked={results.thirdTeamIsUs}
                    onChange={(e) =>
                      handleResultsChange(
                        "thirdTeamIsUs",
                        e.target.checked
                      )
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-[11px] mt-2">
          <span>Our position (if not in top 3):</span>
          <input
            type="number"
            className="w-16 border rounded px-1 py-0.5 text-right"
            value={results.ourPosition}
            onChange={(e) =>
              handleResultsChange("ourPosition", e.target.value)
            }
            min={1}
          />
        </div>


        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span>Total teams:</span>
            <input
              type="number"
              className="w-16 border rounded px-1 py-0.5 text-right"
              value={results.teamsTotal}
              onChange={(e) =>
                handleResultsChange("teamsTotal", e.target.value)
              }
              min={0}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveResults}
            disabled={savingResults}
            className="px-3 py-1 border rounded bg-white"
          >
            {savingResults ? "Saving…" : "Save results"}
          </button>
        </div>

        {resultsMessage && (
          <p className="text-xs text-gray-700 mt-1">
            {resultsMessage}
          </p>
        )}
      </section>

      {/* Questions editor panel */}
      {currentRound && (
        <section className="mt-6 border rounded p-3 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">
                Questions – Round {currentRound.round_number}:{" "}
                {currentRound.round_name}
              </h2>
              <p className="text-xs text-gray-600">
                Enter question, your answer, whether it was correct, and
                set type + points. Joker is applied automatically for this
                round if selected above.
              </p>

              {/* Round-level notes */}
              <div className="mt-2">
                <label className="text-[11px] text-gray-600 block mb-1">
                  Round notes
                </label>
                <textarea
                  className="w-full min-h-[60px] border border-neutral-300 rounded bg-white text-xs px-2 py-1 text-gray-900"
                  placeholder="Notes for this round – special rules, tiebreakers, funny moments..."
                  value={currentRoundNotes}
                  onChange={(e) => setCurrentRoundNotes(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className="text-xs underline"
              onClick={closeQuestionsEditor}
            >
              Close
            </button>
          </div>

          {questionsLoading ? (
            <p className="text-sm">Loading questions…</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 px-1">#</th>
                      <th className="text-left py-1 px-1">Question</th>
                      <th className="text-left py-1 px-1">Our answer</th>
                      <th className="text-center py-1 px-1">Correct?</th>
                      <th className="text-left py-1 px-1">Type</th>
                      <th className="text-right py-1 px-1">
                        Points scored
                      </th>
                      <th className="text-right py-1 px-1">
                        Max points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 px-1 align-top">
                          {q.question_number}
                        </td>
                        <td className="py-1 px-1">
                          <input
                            type="text"
                            className="w-full border rounded px-1 py-0.5"
                            value={q.question_text ?? ""}
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                idx,
                                "question_text",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td className="py-1 px-1">
                          <input
                            type="text"
                            className="w-full border rounded px-1 py-0.5"
                            value={q.our_answer ?? ""}
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                idx,
                                "our_answer",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(q.is_correct)}
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                idx,
                                "is_correct",
                                e.target.checked
                              )
                            }
                          />
                        </td>
                        <td className="py-1 px-1">
                          <select
                            className="border rounded px-1 py-0.5"
                            value={q.question_type}
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                idx,
                                "question_type",
                                e.target.value
                              )
                            }
                          >
                            <option value="normal">Normal</option>
                            <option value="killer">Killer</option>
                            <option value="wipeout">Wipeout</option>
                          </select>
                        </td>
                        <td className="py-1 px-1 text-right">
                          <input
                            type="number"
                            className="w-16 border rounded px-1 py-0.5 text-right"
                            value={q.points_scored ?? ""}
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                idx,
                                "points_scored",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td className="py-1 px-1 text-right">
                          <input
                            type="number"
                            className="w-16 border rounded px-1 py-0.5 text-right"
                            value={q.points_value ?? ""}
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                idx,
                                "points_value",
                                e.target.value
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="mt-2 text-xs underline"
                onClick={addQuestionRow}
              >
                + Add question
              </button>
            </>
          )}

          {questionsMessage && (
            <p className="text-xs text-gray-700">{questionsMessage}</p>
          )}

          <div className="flex gap-2 justify-end text-xs mt-2">
            <button
              type="button"
              className="px-3 py-1 border rounded"
              onClick={() => saveQuestionsAndMaybeNext(false)}
              disabled={questionsSaving}
            >
              {questionsSaving ? "Saving…" : "Save & close"}
            </button>
            <button
              type="button"
              className="px-3 py-1 border rounded"
              onClick={() => saveQuestionsAndMaybeNext(true)}
              disabled={questionsSaving}
            >
              {questionsSaving ? "Saving…" : "Save & next round"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
