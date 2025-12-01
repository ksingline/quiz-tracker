// src/app/quizzes/page.tsx
import AppShell from "@/components/AppShell";
import QuizList from "@/components/quizzes/QuizList";

export default function QuizzesPage() {
  return (
    <AppShell>
      <QuizList />
    </AppShell>
  );
}
