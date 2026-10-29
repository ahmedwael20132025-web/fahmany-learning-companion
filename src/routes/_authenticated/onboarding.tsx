import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("profile_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.profile_completed) throw redirect({ to: "/home" });
  },
  component: OnboardingPage,
});

type Grade = { id: string; name: string; emoji: string; stage: string };

function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gradesQuery = useQuery({
    queryKey: ["grades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grades").select("id, name, emoji, stage").order("sort_order");
      if (error) throw error;
      return data as Grade[];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("اكتب اسمك (على الأقل حرفين)");
      return;
    }
    if (!gradeId) {
      setError("اختار صفك الدراسي");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), grade_id: gradeId, profile_completed: true })
      .eq("id", userData.user!.id);
    setSaving(false);
    if (upErr) {
      setError("حصلت مشكلة في الحفظ. جرّب تاني");
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  const stages = ["ابتدائي", "إعدادي", "ثانوي"] as const;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <section className="animate-pop card-playful px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-foreground">تعرّف على نفسك 😊</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          عشان نقدر نجهزلك الدروس المناسبة لصفك.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-bold text-foreground">
              اسمك
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: أحمد"
              className="w-full rounded-2xl border-2 border-input bg-card px-4 py-3 text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <span className="mb-2 block text-sm font-bold text-foreground">صفك الدراسي</span>
            <div className="flex flex-col gap-4">
              {stages.map((stage) => (
                <div key={stage}>
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">{stage}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {gradesQuery.data
                      ?.filter((g) => g.stage === stage)
                      .map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGradeId(g.id)}
                          className={`rounded-2xl border-2 px-3 py-2.5 text-sm font-bold transition-colors ${
                            gradeId === g.id
                              ? "border-primary bg-sky-soft text-primary"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          <span aria-hidden className="me-1">{g.emoji}</span>
                          {g.name.replace("الصف ", "").replace(" الدراسي", "")}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-[0_6px_0_0_var(--color-mint)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {saving ? "لحظة.." : "يلا نبدأ! 🚀"}
          </button>
        </form>
      </section>
    </div>
  );
}
