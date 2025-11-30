// src/components/quizzes/NewChelseaQuizForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChelseaQuiz, CreateChelseaQuizResult } from "@/lib/quiz";

export default function NewChelseaQuizForm() {
  const router = useRouter();

  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isBig, setIsBig] = useState(false);
  const [team, setTeam] = useState("Karl");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [duplicateQuizId, setDuplicateQuizId] = useState<string | null>(
    null
  );
  const [duplicateQuizDate, setDuplicateQuizDate] = useState<string | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setDuplicateQuizId(null);
    setDuplicateQuizDate(null);

    try {
      const teamNames = team
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      const result: CreateChelseaQuizResult = await createChelseaQuiz({
        quizDate: date,
        isBigQuiz: isBig,
        teamNames,
      });

      if (result.status === "duplicate") {
        // Show dialog instead of throwing
        setDuplicateQuizId(result.existingQuiz.id);
        setDuplicateQuizDate(result.existingQuiz.quiz_date);
        setMessage(
          `There is already a Chelsea quiz recorded on ${result.existingQuiz.quiz_date}.`
        );
        return;
      }

      // Normal success path
      setMessage("Quiz created ✅");
      router.push(`/quizzes/${result.quiz.id}`);
    } catch (err: any) {
      console.error(err);
      setMessage(`Error: ${err.message ?? "something went wrong"}`);
    } finally {
      setLoading(false);
    }
  }

  function handleGoToExisting() {
    if (duplicateQuizId) {
      router.push(`/quizzes/${duplicateQuizId}`);
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

      {message && (
        <p className="text-sm mt-2">
          {message}
        </p>
      )}

      {duplicateQuizId && (
        <div className="mt-4 p-3 border rounded bg-yellow-50 text-sm space-y-2">
          <p>
            You already have a Chelsea quiz recorded for{" "}
            <strong>{duplicateQuizDate}</strong>.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleGoToExisting}
              className="bg-black text-white px-3 py-1 rounded"
            >
              Go to existing quiz
            </button>
          </div>
        </div>
      )}
    </main>
  );
}