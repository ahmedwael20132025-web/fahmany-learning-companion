import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { requestOtp } from "@/lib/auth-server";
import { normalizeEgyptianPhone } from "@/lib/phone";

export const Route = createFileRoute("/auth/")({
  component: PhoneLoginPage,
});

function PhoneLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizeEgyptianPhone(phone);
    if (!normalized) {
      setError("اكتب رقم موبايل مصري صحيح بصيغة 01xxxxxxxxx");
      return;
    }

    setLoading(true);
    const res = await requestOtp({ data: { phone: normalized } });
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigate({ to: "/auth/verify", search: { phone: normalized } });
  }

  return (
    <section className="animate-pop w-full max-w-sm">
      <div className="card-playful px-6 py-8">
        <h2 className="font-display text-2xl font-bold text-foreground">
          اكتب رقم موبايلك 📱
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          هنرسل لك كود تحقق من 6 أرقام عشان نتأكد إن الرقم بتاعك.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label htmlFor="phone" className="text-sm font-bold text-foreground">
            رقم الموبايل
          </label>
          <input
            id="phone"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-2xl border-2 border-input bg-card px-4 py-3 text-center text-lg tracking-widest text-foreground outline-none focus:border-primary"
          />

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-[0_6px_0_0_var(--color-mint)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {loading ? "لحظة.." : "ابعت الكود"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs leading-6 text-muted-foreground">
        رقمك بنستخدمه للدخول فقط، ومش بنعرضه لأي حد تاني 🔒
      </p>
    </section>
  );
}
