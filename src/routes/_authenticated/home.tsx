import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile?.profile_completed) throw redirect({ to: "/onboarding" });
  },
  component: HomePage,
});

type Grade = { id: string; stage: string; level: number; name: string; emoji: string };
type Subject = { id: string; name: string; emoji: string; color_key: string };
type Lesson = { id: string; title: string; summary: string | null; content: string | null; is_sample: boolean };
type Question = {
  id: string;
  type: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string | null;
};

function HomePage() {
  const queryClient = useQueryClient();
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const userQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, grade_id, points")
        .eq("id", data.user!.id)
        .single();
      return profile;
    },
  });

  const gradesQuery = useQuery({
    queryKey: ["grades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grades")
        .select("id, stage, level, name, emoji")
        .order("sort_order");
      if (error) throw error;
      return data as Grade[];
    },
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects", gradeId],
    enabled: !!gradeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, emoji, color_key")
        .eq("grade_id", gradeId!)
        .order("sort_order");
      if (error) throw error;
      return data as Subject[];
    },
  });

  // الدروس: وحدات → دروس (كل دروس المواد المختارة)
  const lessonsQuery = useQuery({
    queryKey: ["lessons", subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const { data: units, error } = await supabase
        .from("units")
        .select("id, name")
        .eq("subject_id", subjectId!);
      if (error) throw error;
      if (!units.length) return [] as Lesson[];
      const { data: lessons, error: lErr } = await supabase
        .from("lessons")
        .select("id, title, summary, content, is_sample")
        .in("unit_id", units.map((u) => u.id))
        .order("sort_order");
      if (lErr) throw lErr;
      return (lessons ?? []) as Lesson[];
    },
  });

  const questionsQuery = useQuery({
    queryKey: ["questions", openLesson],
    enabled: !!openLesson,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_bank")
        .select("id, type, question, options, correct_answer, explanation")
        .eq("lesson_id", openLesson!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const markProgress = useMutation({
    mutationFn: async (lessonId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("student_progress").upsert(
        {
          student_id: userData.user!.id,
          lesson_id: lessonId,
          status: "أكمله",
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: "student_id,lesson_id" },
      );
    },
    onSuccess: () => {
      toast.success("برافو! خلصت الدرس 🎉");
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });

  const submitQuiz = useMutation({
    mutationFn: async ({ lessonId, score, total, details }: { lessonId: string; score: number; total: number; details: Record<string, string> }) => {
      const { data: userData } = await supabase.auth.getUser();
      const studentId = userData.user!.id;
      await supabase.from("quiz_attempts").insert({
        student_id: studentId,
        lesson_id: lessonId,
        score,
        total,
        details,
      });
      if (total > 0 && score === total) {
        const { data: ach } = await supabase
          .from("achievements")
          .select("id")
          .eq("key", "perfect_score")
          .single();
        if (ach) {
          await supabase.from("student_achievements").upsert(
            { student_id: studentId, achievement_id: ach.id },
            { onConflict: "student_id,achievement_id" },
          );
        }
      }
    },
    onSuccess: () => toast.success("اتسجّلت نتيجتك! 🌟"),
  });

  function reset() {
    setSubjectId(null);
    setOpenLesson(null);
    setAnswers({});
  }

  const selectedGrade = gradesQuery.data?.find((g) => g.id === gradeId);
  const selectedSubject = subjectsQuery.data?.find((s) => s.id === subjectId);
  const activeLesson = lessonsQuery.data?.find((l) => l.id === openLesson);

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-bold text-foreground">
          أهلاً {userQuery.data?.display_name ?? "صديقي"} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نقاطك: {userQuery.data?.points ?? 0} ⭐ — يلا نتعلم حاجة جديدة!
        </p>
      </header>

      {/* خطوة 1: اختيار الصف */}
      {!gradeId && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-foreground">اختار صفك الدراسي</h2>
          <div className="grid grid-cols-2 gap-3">
            {gradesQuery.data?.map((g) => (
              <button
                key={g.id}
                onClick={() => setGradeId(g.id)}
                className="card-playful flex flex-col items-center gap-1 px-4 py-5 text-center transition-transform active:translate-y-0.5"
              >
                <span className="text-3xl" aria-hidden>{g.emoji}</span>
                <span className="font-display text-sm font-bold text-foreground">{g.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* خطوة 2: اختيار المادة */}
      {gradeId && !subjectId && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">
              مواد {selectedGrade?.name}
            </h2>
            <button onClick={() => setGradeId(null)} className="text-sm font-bold text-primary underline underline-offset-4">
              غيّر الصف
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {subjectsQuery.data?.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubjectId(s.id)}
                className="card-playful flex items-center gap-3 px-4 py-4 transition-transform active:translate-y-0.5"
              >
                <span className="text-2xl" aria-hidden>{s.emoji}</span>
                <span className="font-display text-sm font-bold text-foreground">{s.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* خطوة 3: دروس المادة */}
      {gradeId && subjectId && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-foreground">
              دروس {selectedSubject?.name}
            </h2>
            <button onClick={reset} className="text-sm font-bold text-primary underline underline-offset-4">
              غيّر المادة
            </button>
          </div>
          <p className="mb-3 rounded-xl bg-sun/20 px-3 py-2 text-xs font-bold text-sun-foreground">
            ⚠️ المحتوى المعروض بيانات تجريبية للتجربة فقط، مش المنهج الرسمي.
          </p>

          {lessonsQuery.data?.length === 0 && (
            <p className="card-playful px-4 py-6 text-center text-sm text-muted-foreground">
              مفيش دروس للمادة دي لسه 🌱
            </p>
          )}

          <div className="flex flex-col gap-3">
            {lessonsQuery.data?.map((l) => (
              <div key={l.id}>
                <button
                  onClick={() => {
                    setOpenLesson(openLesson === l.id ? null : l.id);
                    setAnswers({});
                  }}
                  className="card-playful flex w-full items-center justify-between px-4 py-4 text-right transition-transform active:translate-y-0.5"
                >
                  <span className="font-display text-sm font-bold text-foreground">{l.title}</span>
                  <span className="text-muted-foreground">{openLesson === l.id ? "▲" : "▼"}</span>
                </button>

                {openLesson === l.id && (
                  <div className="animate-pop mt-2 rounded-2xl border-2 border-border bg-card px-4 py-4">
                    {l.summary && (
                      <p className="text-sm leading-7 text-foreground">{l.summary}</p>
                    )}
                    {l.content && (
                      <p className="mt-3 rounded-xl bg-sky-soft px-3 py-3 text-sm leading-7 text-foreground">
                        {l.content}
                      </p>
                    )}

                    {/* أسئلة سريعة */}
                    {questionsQuery.data && questionsQuery.data.length > 0 && (
                      <div className="mt-4 flex flex-col gap-3 border-t-2 border-border pt-4">
                        <h3 className="font-display text-sm font-bold text-foreground">جرّب تحل 📝</h3>
                        {questionsQuery.data.map((q) => (
                          <div key={q.id} className="rounded-xl bg-muted px-3 py-3">
                            <p className="text-sm font-bold text-foreground">{q.question}</p>
                            {q.options ? (
                              <div className="mt-2 flex flex-col gap-1.5">
                                {q.options.map((opt) => {
                                  const picked = answers[q.id];
                                  const isPicked = picked === opt;
                                  const showResult = picked !== undefined;
                                  const correct = opt === q.correct_answer;
                                  return (
                                    <button
                                      key={opt}
                                      disabled={showResult}
                                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                                      className={`rounded-lg border-2 px-3 py-2 text-sm text-right ${
                                        showResult && correct
                                          ? "border-mint bg-mint/20 font-bold"
                                          : showResult && isPicked && !correct
                                            ? "border-destructive bg-destructive/10"
                                            : "border-border bg-card"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-2 flex gap-2">
                                {["صح", "غلط"].map((opt) => {
                                  const picked = answers[q.id];
                                  const showResult = picked !== undefined;
                                  const correct = opt === q.correct_answer;
                                  return (
                                    <button
                                      key={opt}
                                      disabled={showResult}
                                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                                      className={`rounded-lg border-2 px-4 py-2 text-sm ${
                                        showResult && correct
                                          ? "border-mint bg-mint/20 font-bold"
                                          : showResult && isPickedText(picked, opt) && !correct
                                            ? "border-destructive bg-destructive/10"
                                            : "border-border bg-card"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {answers[q.id] !== undefined && q.explanation && (
                              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                                {answers[q.id] === q.correct_answer ? "✅ صح! " : "❌ مش دي. "}
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        ))}

                        <button
                          onClick={() => {
                            const qs = questionsQuery.data!;
                            const score = qs.filter((q) => answers[q.id] === q.correct_answer).length;
                            void submitQuiz.mutateAsync({
                              lessonId: l.id,
                              score,
                              total: qs.length,
                              details: Object.fromEntries(qs.map((q) => [q.id, answers[q.id] ?? ""])),
                            });
                            void markProgress.mutateAsync(l.id);
                            setOpenLesson(null);
                          }}
                          disabled={Object.keys(answers).length < questionsQuery.data.length}
                          className="rounded-2xl bg-primary px-4 py-3 font-display text-sm font-bold text-primary-foreground disabled:opacity-60"
                        >
                          خلصت؟ سجّل نتيجتك 🏁
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function isPickedText(picked: string | undefined, opt: string) {
  return picked === opt;
}
