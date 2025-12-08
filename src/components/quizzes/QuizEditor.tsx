"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/quiz";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

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
  highest_unique: boolean | null;
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

type PlayerRow = {
  id: string;
  name: string;
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

  // Metadata: players & date
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [quizDate, setQuizDate] = useState<string>("");

  // Global "save everything" state
  const [savingAll, setSavingAll] = useState(false);

  // Delete quiz state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();

  // ---- Load quiz, rounds, players, attendees ----
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
          `Failed to load quiz: ${
            (quizError as any).message ?? "unknown error"
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

      // Initial results state
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
          quizRow.teams_total != null ? String(quizRow.teams_total) : "",
        ourPosition:
          quizRow.position != null ? String(quizRow.position) : "",
      });

      // Quiz date state
      setQuizDate(quizRow.quiz_date ?? "");

      // Rounds
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
          `Failed to load rounds: ${
            (roundsError as any).message ?? "unknown error"
          }`
        );
        setLoading(false);
        return;
      }

      setRounds((roundsData as RoundRow[]) ?? []);

      // All players list
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("id, name")
        .order("name", { ascending: true });

      if (playersError) {
        console.error("[QuizEditor] players error:", playersError);
      } else {
        setAllPlayers((playersData ?? []) as PlayerRow[]);
      }

      // Current attendees for this quiz
      const { data: qpData, error: qpError } = await supabase
        .from("quiz_players")
        .select("player_id")
        .eq("quiz_id", quizId);

      if (qpError) {
        console.error("[QuizEditor] quiz_players error:", qpError);
      } else {
        const ids =
          (qpData ?? []).map((row: any) => row.player_id as string) ?? [];
        setSelectedPlayerIds(ids);
      }

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

    const idx = rounds.findIndex((r) => r.round_number === roundNumber);
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

  function handleRoundHighestUniqueChange(index: number, checked: boolean) {
    setRounds((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        highest_unique: checked,
      };
      return copy;
    });
  }

  async function handleSaveRounds(): Promise<boolean> {
    setSavingRounds(true);
    setMessage(null);
    let ok = true;

    try {
      // Save round-level fields
      for (const round of rounds) {
        const { error } = await supabase
          .from("rounds")
          .update({
            round_name: round.round_name,
            score: round.score,
            max_score: round.max_score,
            highest_unique: round.highest_unique ?? false,
          })
          .eq("id", round.id);

        if (error) {
          console.error("[QuizEditor] Error updating round:", error);
          ok = false;
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
          ok = false;
          throw quizError;
        }

        setQuiz((prev) =>
          prev ? { ...prev, joker_round_number: jokerRoundNumber } : prev
        );
      }

      setMessage("Rounds & joker saved ✅");
    } catch (err: any) {
      console.error("[QuizEditor] Save rounds error:", err);
      if (ok) {
        // If we reached here without explicitly marking failure, mark it now
        ok = false;
      }
      setMessage(`Error saving: ${err.message ?? "unknown error"}`);
    } finally {
      setSavingRounds(false);
    }

    return ok;
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

  async function handleSaveResults(): Promise<boolean> {
    if (!quiz) return false;
    setSavingResults(true);
    setResultsMessage(null);
    let ok = true;

    try {
      const toInt = (val: string) =>
        val.trim() === "" ? null : Number(val);

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
        ok = false;
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
      ok = false;
      setResultsMessage(
        `Error saving results: ${err.message ?? "unknown error"}`
      );
    } finally {
      setSavingResults(false);
    }

    return ok;
  }

  // ---- Metadata handlers (date + attendees) ----

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  }

  async function saveMetadata(): Promise<boolean> {
    if (!quiz) return false;

    setMetaSaving(true);
    setMetaMessage(null);
    let ok = true;

    try {
      // Update quiz date
      const { error: quizError } = await supabase
        .from("quizzes")
        .update({ quiz_date: quizDate })
        .eq("id", quiz.id);

      if (quizError) {
        console.error("[QuizEditor] update quiz metadata error:", quizError);
        ok = false;
        throw quizError;
      }

      // Replace attendees in quiz_players
      const { error: deleteError } = await supabase
        .from("quiz_players")
        .delete()
        .eq("quiz_id", quiz.id);

      if (deleteError) {
        console.error("[QuizEditor] delete quiz_players error:", deleteError);
        ok = false;
        throw deleteError;
      }

      if (selectedPlayerIds.length > 0) {
        const rows = selectedPlayerIds.map((playerId) => ({
          quiz_id: quiz.id,
          player_id: playerId,
        }));

        const { error: insertError } = await supabase
          .from("quiz_players")
          .insert(rows);

        if (insertError) {
          console.error(
            "[QuizEditor] insert quiz_players error:",
            insertError
          );
          ok = false;
          throw insertError;
        }
      }

      setQuiz((prev) =>
        prev ? { ...prev, quiz_date: quizDate } : prev
      );

      setMetaMessage("Metadata saved ✅");
    } catch (err: any) {
      ok = false;
      console.error("[QuizEditor] saveMetadata error:", err);
      setMetaMessage(err.message ?? "Failed to save metadata.");
    } finally {
      setMetaSaving(false);
    }

    return ok;
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
        `Failed to load questions: ${
          (error as any).message ?? "unknown error"
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
          q.is_correct === null ? null : Boolean(q.is_correct),
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
            q.is_correct == null ? null : q.is_correct ? pv : 0;
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
                notes:
                  trimmedRoundNotes === "" ? null : trimmedRoundNotes,
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

  // ---- Delete quiz handler ----

  async function handleDeleteQuiz() {
    if (!quiz) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from("quizzes")
        .delete()
        .eq("id", quiz.id);

      if (error) {
        console.error("[QuizEditor] Error deleting quiz:", error);
        setMessage(`Failed to delete quiz: ${error.message ?? "unknown error"}`);
        setDeleting(false);
        setShowDeleteModal(false);
        return;
      }

      // Redirect to quizzes list after successful deletion
      router.push("/quizzes");
    } catch (err: any) {
      console.error("[QuizEditor] Delete quiz error:", err);
      setMessage(`Error deleting quiz: ${err.message ?? "unknown error"}`);
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // ---- Save everything handler ----

  async function handleSaveAll() {
    if (!quiz) return;
    setSavingAll(true);
    // Clear global and per-section messages so the new ones are obvious
    setMessage(null);
    setMetaMessage(null);
    setResultsMessage(null);

    const metaOk = await saveMetadata();
    const roundsOk = await handleSaveRounds();
    const resultsOk = await handleSaveResults();

    if (metaOk && roundsOk && resultsOk) {
      setMessage("All changes saved ✅");
    } else {
      setMessage(
        "Some sections failed to save. Check messages above for details."
      );
    }

    setSavingAll(false);
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-100">
            {quiz.quiz_name} – {quiz.quiz_date}
          </h1>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs text-red-500 hover:text-red-400 underline"
          >
            Delete Quiz
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {quiz.is_big_quiz ? "Big quiz" : "Small quiz"}
          {quiz.position != null ? ` · Position: ${quiz.position}` : ""}
          {quiz.teams_total != null ? ` of ${quiz.teams_total} teams` : ""}
        </p>
        {quiz.joker_round_number != null && (
          <p className="text-xs text-muted-foreground">
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
                  className="px-3 py-1 border border-neutral-700 rounded bg-neutral-900 text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
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

      {/* Quiz metadata: date + attendees */}
      <section className="border border-neutral-800 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-neutral-200">
            Quiz metadata
          </h2>
        </div>

        {/* Date input */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !quizDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {quizDate ? format(new Date(quizDate), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={quizDate ? new Date(quizDate) : undefined}
                onSelect={(date) =>
                  setQuizDate(date ? format(date, "yyyy-MM-dd") : "")
                }
                defaultMonth={quizDate ? new Date(quizDate) : new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Attendees multi-select */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-neutral-400">Attendees</label>
          {allPlayers.length === 0 ? (
            <p className="text-[11px] text-neutral-500">
              No players defined yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {allPlayers.map((p) => {
                const selected = selectedPlayerIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    className={
                      "px-2 py-[3px] rounded-full text-[11px] border " +
                      (selected
                        ? "bg-emerald-500 text-black border-emerald-400"
                        : "bg-neutral-900 text-neutral-200 border-neutral-700")
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {metaMessage && (
          <p className="text-[11px] text-neutral-400">{metaMessage}</p>
        )}
      </section>

      {/* Rounds + Joker + Questions button */}
      <section className="overflow-x-auto">
        <RadioGroup
          value={jokerRoundNumber?.toString() ?? ""}
          onValueChange={(value) => setJokerRoundNumber(value ? Number(value) : null)}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left py-1 pr-2 text-neutral-200">#</th>
                <th className="text-left py-1 pr-2 text-neutral-200">Round</th>
                <th className="text-right py-1 px-2 text-neutral-200">Score</th>
                <th className="text-right py-1 px-2 text-neutral-200">Max</th>
                <th className="text-center py-1 px-2 text-neutral-200">HU</th>
                <th className="text-center py-1 px-2 text-neutral-200">Joker</th>
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
                  <tr key={round.id} className="border-b border-neutral-800 last:border-0">
                    <td className="py-1 pr-2 align-top text-neutral-200">
                      {round.round_number}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        className="w-full border border-neutral-700 rounded px-1 py-0.5 text-sm bg-neutral-950 text-neutral-100"
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
                        className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right text-sm bg-neutral-950 text-neutral-100"
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
                        className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right text-sm bg-neutral-950 text-neutral-100"
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
                      <Checkbox
                        checked={Boolean(round.highest_unique)}
                        onCheckedChange={(checked) =>
                          handleRoundHighestUniqueChange(
                            idx,
                            checked === true
                          )
                        }
                      />
                    </td>

                    <td className="py-1 px-2 text-center">
                      {isPictures ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <RadioGroupItem value={round.round_number.toString()} />
                      )}
                    </td>
                    <td className="py-1 px-2 text-right">
                      <button
                        type="button"
                        className="text-xs underline text-emerald-500"
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
        </RadioGroup>
      </section>

      {/* Rounds summary (no button now) */}
      <section className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium text-neutral-200">
            Total: {totalScore} / {totalMax}
          </span>
          {totalMax > 0 && (
            <span className="ml-2 text-muted-foreground">
              ({((totalScore / totalMax) * 100).toFixed(1)}%)
            </span>
          )}
        </div>
      </section>

      {message && (
        <p className="text-sm text-neutral-400">
          {message}
        </p>
      )}

      {/* Results / podium editor */}
      <section className="mt-4 border border-neutral-800 rounded p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-neutral-200">Results / Top teams</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left py-1 px-1 text-neutral-200">Position</th>
                <th className="text-left py-1 px-1 text-neutral-200">Team name</th>
                <th className="text-right py-1 px-1 text-neutral-200">Score</th>
                <th className="text-center py-1 px-1 text-neutral-200">Our team?</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-800">
                <td className="py-1 px-1 text-neutral-200">1st</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    className="w-full border border-neutral-700 rounded px-1 py-0.5 bg-neutral-950 text-neutral-100"
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
                    className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-950 text-neutral-100"
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
                  <Checkbox
                    checked={results.firstTeamIsUs}
                    onCheckedChange={(checked) =>
                      handleResultsChange(
                        "firstTeamIsUs",
                        checked === true
                      )
                    }
                  />
                </td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-1 px-1 text-neutral-200">2nd</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    className="w-full border border-neutral-700 rounded px-1 py-0.5 bg-neutral-950 text-neutral-100"
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
                    className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-950 text-neutral-100"
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
                  <Checkbox
                    checked={results.secondTeamIsUs}
                    onCheckedChange={(checked) =>
                      handleResultsChange(
                        "secondTeamIsUs",
                        checked === true
                      )
                    }
                  />
                </td>
              </tr>
              <tr className="border-b border-neutral-800">
                <td className="py-1 px-1 text-neutral-200">3rd</td>
                <td className="py-1 px-1">
                  <input
                    type="text"
                    className="w-full border border-neutral-700 rounded px-1 py-0.5 bg-neutral-950 text-neutral-100"
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
                    className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-950 text-neutral-100"
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
                  <Checkbox
                    checked={results.thirdTeamIsUs}
                    onCheckedChange={(checked) =>
                      handleResultsChange(
                        "thirdTeamIsUs",
                        checked === true
                      )
                    }
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 text-[11px] mt-2 text-neutral-200">
          <span>Our position (if not in top 3):</span>
          <input
            type="number"
            className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-950 text-neutral-100"
            value={results.ourPosition}
            onChange={(e) =>
              handleResultsChange("ourPosition", e.target.value)
            }
            min={1}
          />
        </div>

        <div className="flex items-center gap-2 text-xs mt-1 text-neutral-200">
          <span>Total teams:</span>
          <input
            type="number"
            className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-950 text-neutral-100"
            value={results.teamsTotal}
            onChange={(e) =>
              handleResultsChange("teamsTotal", e.target.value)
            }
            min={0}
          />
        </div>

        {resultsMessage && (
          <p className="text-xs text-neutral-400 mt-1">
            {resultsMessage}
          </p>
        )}
      </section>

      {/* Global Save button under all data inputs */}
      <section className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={savingAll || metaSaving || savingRounds || savingResults}
          className="mt-2 bg-emerald-500 text-black text-sm font-semibold px-4 py-2 rounded-full shadow-md disabled:opacity-60"
        >
          {savingAll ? "Saving…" : "Save quiz"}
        </button>
      </section>

      {/* Questions editor panel */}
      {currentRound && (
        <section className="mt-6 border border-neutral-800 rounded p-3 space-y-3 bg-neutral-950">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-neutral-200">
                Questions – Round {currentRound.round_number}:{" "}
                {currentRound.round_name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Enter question, your answer, whether it was correct, and
                set type + points. Joker is applied automatically for this
                round if selected above.
              </p>

              {/* Round-level notes */}
              <div className="mt-2">
                <label className="text-[11px] text-muted-foreground block mb-1">
                  Round notes
                </label>
                <textarea
                  className="w-full min-h-[60px] border border-neutral-700 rounded bg-neutral-900 text-xs px-2 py-1 text-neutral-100"
                  placeholder="Notes for this round – special rules, tiebreakers, funny moments..."
                  value={currentRoundNotes}
                  onChange={(e) =>
                    setCurrentRoundNotes(e.target.value)
                  }
                />
              </div>
            </div>
            <button
              type="button"
              className="text-xs underline text-emerald-500"
              onClick={closeQuestionsEditor}
            >
              Close
            </button>
          </div>

          {questionsLoading ? (
            <p className="text-sm text-neutral-200">Loading questions…</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="text-left py-1 px-1 text-neutral-200">#</th>
                      <th className="text-left py-1 px-1 text-neutral-200">Question</th>
                      <th className="text-left py-1 px-1 text-neutral-200">
                        Our answer
                      </th>
                      <th className="text-center py-1 px-1 text-neutral-200">
                        Correct?
                      </th>
                      <th className="text-left py-1 px-1 text-neutral-200">Type</th>
                      <th className="text-right py-1 px-1 text-neutral-200">
                        Points scored
                      </th>
                      <th className="text-right py-1 px-1 text-neutral-200">
                        Max points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, idx) => (
                      <tr key={idx} className="border-b border-neutral-800 last:border-0">
                        <td className="py-1 px-1 align-top text-neutral-200">
                          {q.question_number}
                        </td>
                        <td className="py-1 px-1">
                          <input
                            type="text"
                            className="w-full border border-neutral-700 rounded px-1 py-0.5 bg-neutral-900 text-neutral-100"
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
                            className="w-full border border-neutral-700 rounded px-1 py-0.5 bg-neutral-900 text-neutral-100"
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
                          <Checkbox
                            checked={Boolean(q.is_correct)}
                            onCheckedChange={(checked) =>
                              handleQuestionFieldChange(
                                idx,
                                "is_correct",
                                checked === true
                              )
                            }
                          />
                        </td>
                        <td className="py-1 px-1">
                          <select
                            className="border border-neutral-700 rounded px-1 py-0.5 bg-neutral-900 text-neutral-100"
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
                            className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-900 text-neutral-100"
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
                            className="w-16 border border-neutral-700 rounded px-1 py-0.5 text-right bg-neutral-900 text-neutral-100"
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
                className="mt-2 text-xs underline text-emerald-500"
                onClick={addQuestionRow}
              >
                + Add question
              </button>
            </>
          )}

          {questionsMessage && (
            <p className="text-xs text-neutral-400">
              {questionsMessage}
            </p>
          )}

          <div className="flex gap-2 justify-end text-xs mt-2">
            <button
              type="button"
              className="px-3 py-1 border border-neutral-700 rounded bg-neutral-900 text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
              onClick={() => saveQuestionsAndMaybeNext(false)}
              disabled={questionsSaving}
            >
              {questionsSaving ? "Saving…" : "Save & close"}
            </button>
            <button
              type="button"
              className="px-3 py-1 border border-neutral-700 rounded bg-neutral-900 text-neutral-100 hover:bg-neutral-800 disabled:opacity-50"
              onClick={() => saveQuestionsAndMaybeNext(true)}
              disabled={questionsSaving}
            >
              {questionsSaving ? "Saving…" : "Save & next round"}
            </button>
          </div>
        </section>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 max-w-sm mx-4 space-y-4">
            <h2 className="text-lg font-semibold text-neutral-100">
              Delete Quiz?
            </h2>
            <p className="text-sm text-neutral-300">
              Are you sure you want to delete{" "}
              <span className="font-medium">{quiz.quiz_name}</span>? This action
              is permanent and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-neutral-600 rounded hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteQuiz}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
