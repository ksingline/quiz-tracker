// src/app/quizzes/[quizId]/edit/page.tsx
import AppShell from "@/components/AppShell";
import QuizEditor from "@/components/quizzes/QuizEditor";

export default function QuizEditPage() {
  return (
    <AppShell>
      <QuizEditor />
    </AppShell>
  );
}
