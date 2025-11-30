// lib/quiz.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---- Supabase client ----

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// ---- Chelsea quiz config ----

export const CHELSEA_ROUNDS = [
  "General Knowledge 1",
  "Entertainment",
  "Geography",
  "Music",
  "Sport",
  "Science",
  "Facebook",
  "Pictures",
  "History",
  "General Knowledge 2",
] as const;

// Default max scores for Chelsea rounds depending on small/big quiz
export function getDefaultMaxScore(
  roundIndex: number,
  isBigQuiz: boolean
): number {
  const normalSmall = 5;
  const normalBig = 8;

  const facebookIndex = 6; // 0-based index 6 = Round 7
  const picturesIndex = 7; // 0-based index 7 = Round 8

  if (roundIndex === facebookIndex) {
    // Facebook
    return isBigQuiz ? 10 : 8;
  }

  if (roundIndex === picturesIndex) {
    // Pictures
    return isBigQuiz ? 16 : 10;
  }

  // All other rounds
  return isBigQuiz ? normalBig : normalSmall;
}

// ---- Types ----

export type CreateChelseaQuizInput = {
  quizDate: string; // e.g. "2025-11-25" (YYYY-MM-DD)
  isBigQuiz: boolean;
  teamNames: string[]; // ["Karl", "Jess", ...]
  teamsTotal?: number | null;
  position?: number | null;
  notes?: string | null;
};

type QuizRow = {
  id: string;
  quiz_date: string;
  quiz_name: string;
  is_big_quiz: boolean;
  teams_total: number | null;
  position: number | null;
  notes: string | null;
  inserted_at: string;
};

type RoundRow = {
  id: string;
  quiz_id: string;
  round_number: number;
  round_name: string | null;
  score: number | null;
  max_score: number | null;
  inserted_at: string;
};

type PlayerRow = {
  id: string;
  name: string;
  nickname?: string | null;
  inserted_at: string;
};

// Result type so the UI can distinguish between a new quiz and a duplicate-date case
export type CreateChelseaQuizResult =
  | {
      status: "created";
      quiz: QuizRow;
      rounds: RoundRow[];
      players: PlayerRow[];
      playerIdsByName: Record<string, string>;
    }
  | {
      status: "duplicate";
      existingQuiz: QuizRow;
    };

// ---- Main function: create a Chelsea quiz ----

export async function createChelseaQuiz(
  input: CreateChelseaQuizInput
): Promise<CreateChelseaQuizResult> {
  const { quizDate, isBigQuiz, teamNames, teamsTotal, position, notes } =
    input;

  // Normalise names: trim, drop empties, unique
  const uniqueNames = Array.from(
    new Set(
      teamNames
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );

  if (uniqueNames.length === 0) {
    throw new Error("You must provide at least one team member name.");
  }

  // 1) Try to insert quiz (this may hit the unique-date constraint)
  const { data: quizData, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      quiz_date: quizDate,
      quiz_name: "Chelsea",
      is_big_quiz: isBigQuiz,
      teams_total: teamsTotal ?? null,
      position: position ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (quizError) {
    const code = (quizError as any).code;
    const msg = (quizError as any).message as string | undefined;

    const isDuplicate =
      code === "23505" ||
      (msg && msg.toLowerCase().includes("duplicate key"));

    if (isDuplicate) {
      // A quiz already exists for this date (and quiz_name)
      const { data: existing, error: existingErr } = await supabase
        .from("quizzes")
        .select("*")
        .eq("quiz_date", quizDate)
        .eq("quiz_name", "Chelsea")
        .maybeSingle();

      if (existing && !existingErr) {
        return {
          status: "duplicate",
          existingQuiz: existing as QuizRow,
        };
      }

      // Fallback if we can't fetch the existing one properly
      throw new Error(
        "A quiz already exists on this date, but it could not be loaded."
      );
    }

    console.error("Quiz insert error:", quizError);
    throw new Error("Failed to create quiz");
  }

  if (!quizData) {
    throw new Error("Failed to create quiz (no data returned)");
  }

  const quiz = quizData as QuizRow;

  // 2) Upsert players in bulk by name
  const playersPayload = uniqueNames.map((name) => ({ name }));

  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .upsert(playersPayload, { onConflict: "name" })
    .select();

  if (playersError || !playersData) {
    console.error("Players upsert error:", playersError);
    throw new Error("Failed to upsert players");
  }

  const players = playersData as PlayerRow[];

  // Build map name -> id
  const playerIdsByName: Record<string, string> = {};
  for (const player of players) {
    playerIdsByName[player.name] = player.id;
  }

  // 3) Insert quiz_players links
  const quizPlayersRows = uniqueNames
    .map((name) => {
      const playerId = playerIdsByName[name];
      if (!playerId) return null;
      return {
        quiz_id: quiz.id,
        player_id: playerId,
      };
    })
    .filter(Boolean) as { quiz_id: string; player_id: string }[];

  if (quizPlayersRows.length > 0) {
    const { error: qpError } = await supabase
      .from("quiz_players")
      .insert(quizPlayersRows);

    if (qpError) {
      console.error("quiz_players insert error:", qpError);
      throw new Error("Failed to link players to quiz");
    }
  }

  // 4) Insert Chelsea rounds with default max_score
  const roundsPayload = CHELSEA_ROUNDS.map((roundName, index) => ({
    quiz_id: quiz.id,
    round_number: index + 1,
    round_name: roundName,
    score: null, // to be filled in later
    max_score: getDefaultMaxScore(index, isBigQuiz),
  }));

  const { data: roundsData, error: roundsError } = await supabase
    .from("rounds")
    .insert(roundsPayload)
    .select();

  if (roundsError || !roundsData) {
    console.error("Rounds insert error:", roundsError);
    throw new Error("Failed to create rounds for quiz");
  }

  const rounds = roundsData as RoundRow[];

  return {
    status: "created",
    quiz,
    rounds,
    players,
    playerIdsByName,
  };
}
