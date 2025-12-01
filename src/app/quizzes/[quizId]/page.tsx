// src/app/quizzes/[quizId]/page.tsx
import AppShell from "@/components/AppShell";
import QuizViewer from "@/components/quizzes/QuizViewer";

export default function QuizPage() {
  return (
    <AppShell>
      <QuizViewer />
    </AppShell>
  );
}
