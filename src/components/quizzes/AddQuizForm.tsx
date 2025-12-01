// src/components/quizzes/AddQuizForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/quiz";
import {
    createQuizFromFormat,
    CreateQuizFromFormatResult,
} from "@/lib/quiz";


type PlayerRow = {
    id: string;
    name: string;
};

type QuizRow = {
    id: string;
    quiz_date: string;
};

type QuizFormat = {
    id: string;             // we'll store slug here, e.g. "chelsea"
    name: string;
    supportsBigQuiz: boolean;
};

export default function AddQuizForm() {
    const router = useRouter();

    const [date, setDate] = useState(
        new Date().toISOString().slice(0, 10)
    );
    const [isBig, setIsBig] = useState(false);

    // Formats loaded from Supabase (or fallback)
    const [formats, setFormats] = useState<QuizFormat[]>([]);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(
        null
    );

    const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
    const [frequentPlayerIds, setFrequentPlayerIds] = useState<string[]>([]);
    const [lastQuizRosterIds, setLastQuizRosterIds] = useState<string[]>([]);

    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [newPlayerName, setNewPlayerName] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    const maxPlayers = 6;

    // ---- Load formats (quiz_formats) ----
    useEffect(() => {
        async function loadFormats() {
            try {
                const { data, error } = await supabase
                    .from("quiz_formats")
                    .select("slug, name, supports_big_quiz")
                    .order("name", { ascending: true });

                if (error) {
                    console.error("[AddQuizForm] Error loading formats:", error);
                    // Fallback: Chelsea only
                    const fallback: QuizFormat = {
                        id: "chelsea",
                        name: "Chelsea",
                        supportsBigQuiz: true,
                    };
                    setFormats([fallback]);
                    setSelectedFormatId("chelsea");
                    return;
                }

                const mapped: QuizFormat[] = (data ?? []).map((row: any) => ({
                    id: row.slug as string,
                    name: row.name as string,
                    supportsBigQuiz: Boolean(row.supports_big_quiz),
                }));

                if (mapped.length === 0) {
                    // no formats defined, fallback to Chelsea
                    const fallback: QuizFormat = {
                        id: "chelsea",
                        name: "Chelsea",
                        supportsBigQuiz: true,
                    };
                    setFormats([fallback]);
                    setSelectedFormatId("chelsea");
                    return;
                }

                setFormats(mapped);
                if (!selectedFormatId) {
                    setSelectedFormatId(mapped[0].id);
                }
            } catch (err) {
                console.error("[AddQuizForm] Unexpected error loading formats:", err);
                const fallback: QuizFormat = {
                    id: "chelsea",
                    name: "Chelsea",
                    supportsBigQuiz: true,
                };
                setFormats([fallback]);
                setSelectedFormatId("chelsea");
            }
        }

        loadFormats();
    }, [selectedFormatId]);

    const currentFormat = useMemo(
        () => formats.find((f) => f.id === selectedFormatId) ?? null,
        [formats, selectedFormatId]
    );

    // ---- Load players + frequency + last quiz roster ----
    useEffect(() => {
        async function load() {
            setMessage(null);

            // 1) All players
            const { data: playersData, error: playersError } = await supabase
                .from("players")
                .select("id, name")
                .order("name", { ascending: true });

            if (playersError) {
                console.error("[AddQuizForm] Error loading players:", playersError);
                setAllPlayers([]);
            } else {
                setAllPlayers((playersData as PlayerRow[]) ?? []);
            }

            // 2) All quiz_players to compute frequency and last roster
            const { data: qpData, error: qpError } = await supabase
                .from("quiz_players")
                .select("player_id, quiz_id");

            if (qpError) {
                console.error("[AddQuizForm] Error loading quiz_players:", qpError);
            }

            const quizPlayers = (qpData ?? []) as {
                player_id: string;
                quiz_id: string;
            }[];

            // 3) Last quiz by date
            const { data: lastQuizData } = await supabase
                .from("quizzes")
                .select("id, quiz_date")
                .order("quiz_date", { ascending: false })
                .limit(1);

            const lastQuiz = (lastQuizData ?? [])[0] as QuizRow | undefined;

            if (lastQuiz) {
                const rosterIds = quizPlayers
                    .filter((qp) => qp.quiz_id === lastQuiz.id)
                    .map((qp) => qp.player_id);

                setLastQuizRosterIds(rosterIds);
            } else {
                setLastQuizRosterIds([]);
            }

            // 4) Frequency counts
            const freqMap: Record<string, number> = {};
            for (const qp of quizPlayers) {
                freqMap[qp.player_id] = (freqMap[qp.player_id] ?? 0) + 1;
            }

            const sortedByFreq = Object.entries(freqMap)
                .sort((a, b) => b[1] - a[1])
                .map(([player_id]) => player_id);

            setFrequentPlayerIds(sortedByFreq.slice(0, maxPlayers));
        }

        load();
    }, []);

    // Derived lists
    const frequentPlayers: PlayerRow[] = useMemo(() => {
        if (allPlayers.length === 0) return [];
        if (frequentPlayerIds.length === 0) {
            // fallback: just first 6 by name
            return allPlayers.slice(0, maxPlayers);
        }
        const map = new Map(allPlayers.map((p) => [p.id, p]));
        return frequentPlayerIds
            .map((id) => map.get(id))
            .filter((p): p is PlayerRow => !!p);
    }, [allPlayers, frequentPlayerIds]);

    const selectedCount = selectedPlayerIds.length;

    function togglePlayer(playerId: string) {
        setMessage(null);
        setSelectedPlayerIds((prev) => {
            const exists = prev.includes(playerId);
            if (exists) {
                return prev.filter((id) => id !== playerId);
            }
            if (prev.length >= maxPlayers) {
                setMessage(`You can only select up to ${maxPlayers} players.`);
                return prev;
            }
            return [...prev, playerId];
        });
    }

    function handleSameAsLastQuiz() {
        setMessage(null);
        if (lastQuizRosterIds.length === 0) {
            setMessage("No previous quiz roster to copy.");
            return;
        }
        setSelectedPlayerIds(lastQuizRosterIds.slice(0, maxPlayers));
    }

    function handleAddNewPlayerName() {
        const trimmed = newPlayerName.trim();
        if (!trimmed) return;
        setMessage(null);

        // Check if name already exists (case insensitive)
        const existing = allPlayers.find(
            (p) => p.name.toLowerCase() === trimmed.toLowerCase()
        );

        if (existing) {
            togglePlayer(existing.id);
        } else {
            // "Virtual" new player: we don't put them in players table yet,
            // but we will pass the name to createChelseaQuiz, which upserts by name.
            // For selection, we just keep a local pseudo-id key.
            const pseudoId = `new:${trimmed}`;

            setAllPlayers((prev) => [
                ...prev,
                { id: pseudoId, name: trimmed },
            ]);
            togglePlayer(pseudoId);
        }

        setNewPlayerName("");
    }

    const selectedPlayerNames: string[] = useMemo(() => {
        const map = new Map(allPlayers.map((p) => [p.id, p.name]));
        return selectedPlayerIds.map((id) => map.get(id) ?? "").filter(Boolean);
    }, [allPlayers, selectedPlayerIds]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);

        if (!date) {
            setMessage("Please select a date.");
            return;
        }
        if (!selectedFormatId) {
            setMessage("Please choose a quiz format.");
            return;
        }
        if (selectedPlayerNames.length === 0) {
            setMessage("Select at least 1 player.");
            return;
        }
        if (selectedPlayerNames.length > maxPlayers) {
            setMessage(`You can only select up to ${maxPlayers} players.`);
            return;
        }

        try {
            const result: CreateQuizFromFormatResult = await createQuizFromFormat({
                formatSlug: selectedFormatId,   // slug, e.g. 'chelsea' or your new quiz
                quizDate: date,
                isBigQuiz: isBig,
                teamNames: selectedPlayerNames,
            });

            if (result.status === "duplicate") {
                setMessage(
                    `There is already a quiz recorded on ${result.existingQuiz.quiz_date}.`
                );
                router.push(`/quizzes/${result.existingQuiz.id}`);
                return;
            }

            router.push(`/quizzes/${result.quiz.id}`);
        } catch (err: any) {
            console.error("[AddQuizForm] error creating quiz:", err);
            setMessage(err.message ?? "Something went wrong creating the quiz.");
        }
    }


    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-sm font-semibold mb-1">Add quiz</h1>

            {/* Step 1: Date */}
            <section className="space-y-3 border border-neutral-800 rounded-lg p-3">
                <label className="flex-1 text-xs block">
                    <span className="block mb-1 text-neutral-300">
                        Date
                    </span>
                    <input
                        type="date"
                        className="w-full border border-neutral-700 rounded px-2 py-1 text-sm bg-neutral-950"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </label>
            </section>


            {/* Step 2: Format selection */}
            <section className="space-y-3 border border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200">
                        Quiz format
                    </span>
                    {currentFormat?.supportsBigQuiz && (
                        <label className="flex items-center gap-2 text-[11px]">
                            <input
                                type="checkbox"
                                checked={isBig}
                                onChange={(e) => setIsBig(e.target.checked)}
                            />
                            <span>Big quiz?</span>
                        </label>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <select
                        className="flex-1 border border-neutral-700 rounded px-2 py-1 text-sm bg-neutral-950"
                        value={selectedFormatId ?? ""}
                        onChange={(e) => {
                            const newId = e.target.value;
                            setSelectedFormatId(newId);
                            const fmt = formats.find((f) => f.id === newId);
                            if (fmt && !fmt.supportsBigQuiz) {
                                setIsBig(false);
                            }
                        }}
                    >
                        <option value="" disabled>
                            Select format…
                        </option>
                        {formats.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                        onClick={() => {
                            router.push("/formats");
                        }}
                    >
                        + New format
                    </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                    For now, templates are fixed to Chelsea. Use the Formats section
                    later to define new quiz types (rounds, joker rules, etc.).
                </p>
            </section>


            {/* Step 3: Attendees */}
            <section className="space-y-3 border border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200">
                        Attendees
                    </span>
                    <button
                        type="button"
                        className="text-[11px] text-emerald-400 underline"
                        onClick={handleSameAsLastQuiz}
                    >
                        Same as last quiz
                    </button>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">
                        Select up to {maxPlayers} players
                    </span>
                    <span
                        className={
                            selectedCount > maxPlayers
                                ? "text-red-400 font-semibold"
                                : "text-neutral-200"
                        }
                    >
                        {selectedCount}/{maxPlayers} selected
                    </span>
                </div>

                {/* Frequent players */}
                <div className="flex flex-wrap gap-2">
                    {frequentPlayers.length === 0 ? (
                        <span className="text-[11px] text-neutral-500">
                            No regular players yet – we&apos;ll remember players you add.
                        </span>
                    ) : (
                        frequentPlayers.map((p) => {
                            const selected = selectedPlayerIds.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => togglePlayer(p.id)}
                                    className={
                                        "px-3 py-1 rounded-full text-xs border min-h-[36px]" +
                                        (selected
                                            ? " bg-emerald-500 border-emerald-500 text-black"
                                            : " bg-neutral-950 border-neutral-700 text-neutral-200")
                                    }
                                >
                                    {p.name}
                                    {selected && <span className="ml-1">✓</span>}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Add another player */}
                <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400">
                        Add or search player
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            className="flex-1 border border-neutral-700 rounded px-2 py-1 text-sm bg-neutral-950"
                            placeholder="Type a name…"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddNewPlayerName();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="border border-neutral-700 rounded px-2 py-1 text-xs"
                            onClick={handleAddNewPlayerName}
                        >
                            + Add
                        </button>
                    </div>
                </div>

                {/* Summary of selected players */}
                {selectedPlayerNames.length > 0 && (
                    <div className="text-[11px] text-neutral-300">
                        <span className="font-medium">Selected:</span>{" "}
                        {selectedPlayerNames.join(", ")}
                    </div>
                )}
            </section>

            {message && (
                <p className="text-xs text-red-400">{message}</p>
            )}

            <button
                type="submit"
                className="w-full mt-2 bg-emerald-500 text-black text-sm font-semibold py-2 rounded-lg"
            >
                Create quiz
            </button>
        </form>
    );
}
