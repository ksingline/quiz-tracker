// src/components/formats/FormatsManager.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/quiz";

type FormatRow = {
  id: string;
  slug: string;
  name: string;
  has_joker: boolean;
  supports_big_quiz: boolean;
};

type NewRound = {
  name: string;
  smallMax: string;
  bigMax: string;
};

export default function FormatsManager() {
  const [formats, setFormats] = useState<FormatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // New format form state
  const [fmtName, setFmtName] = useState("");
  const [fmtHasJoker, setFmtHasJoker] = useState(true);
  const [fmtSupportsBig, setFmtSupportsBig] = useState(false);
  const [rounds, setRounds] = useState<NewRound[]>([
    { name: "", smallMax: "", bigMax: "" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFormats() {
      setLoading(true);
      const { data, error } = await supabase
        .from("quiz_formats")
        .select("id, slug, name, has_joker, supports_big_quiz")
        .order("name", { ascending: true });

      if (error) {
        console.error("[FormatsManager] load formats error:", error);
        setFormats([]);
      } else {
        setFormats((data as FormatRow[]) ?? []);
      }
      setLoading(false);
    }

    loadFormats();
  }, []);

  function addRoundRow() {
    setRounds((prev) => [...prev, { name: "", smallMax: "", bigMax: "" }]);
  }

  function updateRoundField(
    index: number,
    field: keyof NewRound,
    value: string
  ) {
    setRounds((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function slugifyName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function handleSaveNewFormat(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const name = fmtName.trim();
    if (!name) {
      setMessage("Please enter a format name.");
      return;
    }

    const slug = slugifyName(name);
    if (!slug) {
      setMessage("Could not generate a valid slug from the name.");
      return;
    }

    const cleanedRounds = rounds
      .map((r, idx) => ({
        round_number: idx + 1,
        round_name: r.name.trim(),
        smallMax: r.smallMax.trim(),
        bigMax: r.bigMax.trim(),
      }))
      .filter((r) => r.round_name !== "");

    if (cleanedRounds.length === 0) {
      setMessage("Please define at least one round.");
      return;
    }

    setSaving(true);

    try {
      // 1) Create format
      const { data: formatData, error: formatError } = await supabase
        .from("quiz_formats")
        .insert({
          slug,
          name,
          has_joker: fmtHasJoker,
          supports_big_quiz: fmtSupportsBig,
        })
        .select()
        .single();

      if (formatError || !formatData) {
        console.error("[FormatsManager] format insert error:", formatError);
        throw new Error(
          formatError?.message ?? "Failed to create format."
        );
      }

      const formatId = formatData.id as string;

      // 2) Create rounds
      const roundsPayload = cleanedRounds.map((r) => ({
        format_id: formatId,
        round_number: r.round_number,
        round_name: r.round_name,
        default_small_max:
          r.smallMax === "" ? null : Number(r.smallMax),
        default_big_max:
          r.bigMax === "" ? null : Number(r.bigMax),
      }));

      const { error: roundsError } = await supabase
        .from("quiz_format_rounds")
        .insert(roundsPayload);

      if (roundsError) {
        console.error("[FormatsManager] rounds insert error:", roundsError);
        throw new Error(roundsError.message ?? "Failed to create rounds.");
      }

      // 3) Refresh format list
      const { data: refreshed, error: refreshError } = await supabase
        .from("quiz_formats")
        .select("id, slug, name, has_joker, supports_big_quiz")
        .order("name", { ascending: true });

      if (!refreshError && refreshed) {
        setFormats(refreshed as FormatRow[]);
      }

      // Reset form
      setFmtName("");
      setFmtHasJoker(true);
      setFmtSupportsBig(false);
      setRounds([{ name: "", smallMax: "", bigMax: "" }]);
      setMessage(`Created format "${name}" (slug: ${slug}).`);
    } catch (err: any) {
      setMessage(err.message ?? "Error creating format.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing formats */}
      <section className="space-y-2">
        <h1 className="text-sm font-semibold">Quiz formats</h1>
        {loading ? (
          <p className="text-xs text-neutral-400">Loading formats…</p>
        ) : formats.length === 0 ? (
          <p className="text-xs text-neutral-400">
            No formats yet. Create one below.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {formats.map((f) => (
              <li
                key={f.id}
                className="border border-neutral-800 rounded px-3 py-2 flex flex-col"
              >
                <span className="font-medium text-neutral-100">
                  {f.name}
                </span>
                <span className="text-[11px] text-neutral-400">
                  slug: {f.slug} · Joker:{" "}
                  {f.has_joker ? "yes" : "no"} · Big quiz:{" "}
                  {f.supports_big_quiz ? "yes" : "no"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* New format form */}
      <section className="border border-neutral-800 rounded-lg p-3 space-y-3">
        <h2 className="text-xs font-semibold text-neutral-200">
          New format
        </h2>
        <form
          className="space-y-3"
          onSubmit={handleSaveNewFormat}
        >
          <label className="text-xs block">
            <span className="block mb-1 text-neutral-300">
              Format name
            </span>
            <input
              type="text"
              className="w-full border border-neutral-700 rounded px-2 py-1 text-sm bg-neutral-950"
              placeholder="e.g. Wednesday Trivia at The Fox"
              value={fmtName}
              onChange={(e) => setFmtName(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-4 text-[11px]">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={fmtHasJoker}
                onChange={(e) => setFmtHasJoker(e.target.checked)}
              />
              <span>Has joker?</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={fmtSupportsBig}
                onChange={(e) => setFmtSupportsBig(e.target.checked)}
              />
              <span>Supports big quiz?</span>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-300">Rounds</span>
              <button
                type="button"
                className="text-emerald-400 underline"
                onClick={addRoundRow}
              >
                + Add round
              </button>
            </div>

            <div className="space-y-2">
              {rounds.map((r, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr,70px,70px] gap-2 text-[11px]"
                >
                  <input
                    type="text"
                    className="border border-neutral-700 rounded px-2 py-1 bg-neutral-950 text-xs"
                    placeholder={`Round ${idx + 1} name`}
                    value={r.name}
                    onChange={(e) =>
                      updateRoundField(idx, "name", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    className="border border-neutral-700 rounded px-1 py-1 bg-neutral-950 text-xs text-right"
                    placeholder="small"
                    value={r.smallMax}
                    onChange={(e) =>
                      updateRoundField(idx, "smallMax", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    className="border border-neutral-700 rounded px-1 py-1 bg-neutral-950 text-xs text-right"
                    placeholder="big"
                    value={r.bigMax}
                    onChange={(e) =>
                      updateRoundField(idx, "bigMax", e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-neutral-500">
              Leave big/small max empty if the format doesn&apos;t use
              that size.
            </p>
          </div>

          {message && (
            <p className="text-[11px] text-neutral-300">{message}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-1 bg-emerald-500 text-black text-sm font-semibold py-2 rounded-lg disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save format"}
          </button>
        </form>
      </section>
    </div>
  );
}
