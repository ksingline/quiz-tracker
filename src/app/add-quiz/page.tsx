// src/app/add-quiz/page.tsx
import AppShell from "@/components/AppShell";
import AddQuizForm from "@/components/quizzes/AddQuizForm";

export default function AddQuizPage() {
  return (
    <AppShell>
      <AddQuizForm />
    </AppShell>
  );
}
