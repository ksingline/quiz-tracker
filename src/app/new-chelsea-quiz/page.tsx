"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChelseaQuiz } from "@/lib/quiz";

export default function NewChelseaQuizPage() {
  const router = useRouter();

  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isBig, setIsBig] = useState(false);
  const [team, setTeam] = useState("Karl");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const teamNames = team
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      const { quiz } = await createChelseaQuiz({
        quizDate: date,
        isBigQuiz: isBig,
        teamNames,
      });

      setMessage("Quiz created ✅");
      // jump straight to round editor
      router.push(`/quizzes/${quiz.id}`);
    } catch (err: any) {
      console.error(err);
      setMessage(`Error: ${err.message ?? "something went wrong"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">New Chelsea Quiz</h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            className="border rounded px-2 py-1 w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isBig}
            onChange={(e) => setIsBig(e.target.checked)}
          />
          <span>Big quiz?</span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Team members (comma separated)
          </span>
          <input
            type="text"
            className="border rounded px-2 py-1 w-full"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="Karl, Jess, ..."
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded px-3 py-1 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save quiz"}
        </button>
      </form>

      {message && <p className="text-sm">{message}</p>}
    </main>
  );
}
