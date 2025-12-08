// src/lib/quiz.ts

import { createBrowserClient } from "@supabase/ssr";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---- Supabase client ----

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

function createSupabaseClient(): SupabaseClient {
  const isBrowser = typeof window !== "undefined";
  return isBrowser
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase: SupabaseClient = createSupabaseClient();

// ---- Types ----

export type CreateQuizFromFormatInput = {
  formatSlug: string;       // e.g. "chelsea"
  quizDate: string;         // "2025-11-25"
  isBigQuiz: boolean;
  teamNames: string[];      // ["Karl", "Jess", ...]
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
  format_id: string | null;
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

type FormatRow = {
  id: string;
  slug: string;
  name: string;
  has_joker: boolean;
  supports_big_quiz: boolean;
};

type FormatRoundRow = {
  id: string;
  format_id: string;
  round_number: number;
  round_name: string;
  default_small_max: number | null;
  default_big_max: number | null;
};

export type CreateQuizFromFormatResult =
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

// Convenience aliases for existing code that uses Chelsea creator
export type CreateChelseaQuizInput = Omit<
  CreateQuizFromFormatInput,
  "formatSlug"
>;
export type CreateChelseaQuizResult = CreateQuizFromFormatResult;

// ---- Generic creator: create quiz from a format ----

export async function createQuizFromFormat(
  input: CreateQuizFromFormatInput
): Promise<CreateQuizFromFormatResult> {
  const {
    formatSlug,
    quizDate,
    isBigQuiz,
    teamNames,
    teamsTotal,
    position,
    notes,
  } = input;

  // Require an authenticated user so we can scope data to the account
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in to create or modify quizzes.");
  }

  const userId = user.id;

  // 0) Normalise team names
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

  // 1) Look up the format by slug
  const { data: formatData, error: formatError } = await supabase
    .from("quiz_formats")
    .select("*")
    .eq("slug", formatSlug)
    .maybeSingle();

  if (formatError || !formatData) {
    console.error("[createQuizFromFormat] format error:", formatError);
    throw new Error(`Quiz format '${formatSlug}' not found.`);
  }

  const format = formatData as FormatRow;

  // 2) Try to insert quiz (may hit unique date constraint)
  const { data: quizData, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      quiz_date: quizDate,
      quiz_name: format.name,
      is_big_quiz: isBigQuiz,
      teams_total: teamsTotal ?? null,
      position: position ?? null,
      notes: notes ?? null,
      format_id: format.id,
      user_id: userId,
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
      // We only allow one quiz per date overall, so fetch existing quiz on that date.
      const { data: existing, error: existingErr } = await supabase
        .from("quizzes")
        .select("*")
        .eq("quiz_date", quizDate)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing && !existingErr) {
        return {
          status: "duplicate",
          existingQuiz: existing as QuizRow,
        };
      }

      throw new Error(
        "A quiz already exists on this date, but it could not be loaded."
      );
    }

    console.error("[createQuizFromFormat] quiz insert error:", quizError);
    throw new Error("Failed to create quiz");
  }

  if (!quizData) {
    throw new Error("Failed to create quiz (no data returned)");
  }

  const quiz = quizData as QuizRow;

  // 3) Upsert players in bulk by name
  const playersPayload = uniqueNames.map((name) => ({
    name,
    user_id: userId,
  }));

  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .upsert(playersPayload, { onConflict: "user_id,name" })
    .select();

  if (playersError || !playersData) {
    console.error("[createQuizFromFormat] players upsert error:", playersError);
    throw new Error("Failed to upsert players");
  }

  const players = playersData as PlayerRow[];

  const playerIdsByName: Record<string, string> = {};
  for (const player of players) {
    playerIdsByName[player.name] = player.id;
  }

  // 4) Insert quiz_players links
  const quizPlayersRows = uniqueNames
    .map((name) => {
      const playerId = playerIdsByName[name];
      if (!playerId) return null;
      return {
        quiz_id: quiz.id,
        player_id: playerId,
        user_id: userId,
      };
    })
    .filter(Boolean) as { quiz_id: string; player_id: string; user_id: string }[];

  if (quizPlayersRows.length > 0) {
    const { error: qpError } = await supabase
      .from("quiz_players")
      .insert(quizPlayersRows);

    if (qpError) {
      console.error("[createQuizFromFormat] quiz_players insert error:", qpError);
      throw new Error("Failed to link players to quiz");
    }
  }

  // 5) Load format rounds and create actual rounds
  const { data: formatRoundsData, error: formatRoundsError } = await supabase
    .from("quiz_format_rounds")
    .select("*")
    .eq("format_id", format.id)
    .order("round_number", { ascending: true });

  if (formatRoundsError) {
    console.error(
      "[createQuizFromFormat] format rounds error:",
      formatRoundsError
    );
    throw new Error("Failed to load format rounds");
  }

  const formatRounds = (formatRoundsData ?? []) as FormatRoundRow[];
  if (formatRounds.length === 0) {
    throw new Error(
      `Format '${formatSlug}' has no rounds defined. Add them in the Formats section.`
    );
  }

  const roundsPayload = formatRounds.map((fr) => ({
    quiz_id: quiz.id,
    round_number: fr.round_number,
    round_name: fr.round_name,
    score: null,
    max_score: isBigQuiz ? fr.default_big_max : fr.default_small_max,
    user_id: userId,
  }));

  const { data: roundsData, error: roundsError } = await supabase
    .from("rounds")
    .insert(roundsPayload)
    .select();

  if (roundsError || !roundsData) {
    console.error("[createQuizFromFormat] rounds insert error:", roundsError);
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

// ---- Chelsea-specific wrapper for existing code ----

export async function createChelseaQuiz(
  input: CreateChelseaQuizInput
): Promise<CreateChelseaQuizResult> {
  return createQuizFromFormat({
    ...input,
    formatSlug: "chelsea",
  });
}
