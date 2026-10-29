import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskPhone } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type Profile = { display_name: string | null; phone: string; points: number };
type AchievementRow = { emoji: string; title: string; description: string };

function ProfilePage() {
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile-full"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, phone, points")
        .eq("id", userData.user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const achievementsQuery = useQuery({
    queryKey: ["my-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_achievements")
        .select("achievement_id")
        .then(async ({ data: mine }) => {
          if (!mine?.length) return [] as AchievementRow[];
          const { data: achs } = await supabase
            .from("achievements")
            .select("emoji, title, description")
            .in("id", mine.map((m) => m.achievement_id));
          return (achs ?? []) as AchievementRow[];
        });
      return data;
    },
  });

  async function handleSave() {
    if (!name || name.trim().length < 2) {
      toast.error("اكتب اسم صحيح");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", userData.user!.id);
    setSaving(false);
    if (error) {
      toast.error("حصلت مشكلة في الحفظ");
      return;
    }
    toast.success("اتحفظ الاسم ✅");
    setName(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const profile = profileQuery.data;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <header className="card-playful mb-5 flex flex-col items-center px-6 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-soft text-4xl">
          😊
        </div>
        <h1 className="mt-3 font-display text-xl font-bold text-foreground">
          {profile?.display_name ?? "صديقي"}
        </h1>
        <p dir="ltr" className="mt-1 text-sm text-muted-foreground">{maskPhone(profile?.phone ?? "")}</p>
        <p className="mt-2 rounded-full bg-sun/25 px-4 py-1 font-display text-sm font-bold text-sun-foreground">
          نقاطك: {profile?.points ?? 0} ⭐
        </p>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 font-display text-lg font-bold text-foreground">إنجازاتي 🏆</h2>
        {achievementsQuery.data?.length ? (
          <div className="grid grid-cols-2 gap-3">
            {achievementsQuery.data.map((a) => (
              <div key={a.title} className="card-playful px-3 py-4 text-center">
                <span className="text-3xl" aria-hidden>{a.emoji}</span>
                <p className="mt-1 font-display text-sm font-bold text-foreground">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="card-playful px-4 py-6 text-center text-sm text-muted-foreground">
            لسه مفيش إنجازات.. ابدأ درس واكسب أول وسام! 🌱
          </p>
        )}
      </section>

      <section className="card-playful mb-5 flex flex-col gap-3 px-4 py-5">
        <h2 className="font-display text-sm font-bold text-foreground">غيّر اسمك</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={name ?? profile?.display_name ?? ""}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-2xl border-2 border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            onClick={handleSave}
            disabled={saving || name === null}
            className="rounded-2xl bg-primary px-5 py-2.5 font-display text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            حفظ
          </button>
        </div>
      </section>

      <button
        onClick={handleSignOut}
        className="w-full rounded-2xl border-2 border-destructive/40 bg-destructive/10 px-6 py-3 font-display text-sm font-bold text-destructive"
      >
        تسجيل الخروج
      </button>
    </div>
  );
}
