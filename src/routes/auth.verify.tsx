import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { requestOtp, verifyOtp } from "@/lib/auth-server";
import { maskPhone } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search: Record<string, unknown>): { phone: string } => ({
    phone: typeof search["phone"] === "string" ? search["phone"] : "",
  }),
  component: VerifyOtpPage,
});

function VerifyOtpPage() {
  const navigate = useNavigate();
  const { phone } = Route.useSearch();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const [testCode, setTestCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!phone) navigate({ to: "/auth", replace: true });
  }, [phone, navigate]);

  // عدّاد إعادة الإرسال
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function submit(codeValue: string) {
    setError(null);
    setLoading(true);
    const res = await verifyOtp({ data: { phone, code: codeValue } });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // جلسة حقيقية: كود سحري أحادي الاستخدام صدر من الخادم بعد التحقق
    const { error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: res.tokenHash,
      type: "magiclink",
    });
    if (sessionError) {
      setError("حصلت مشكلة في الدخول. جرّب تاني");
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit(code);
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setError(null);
    const res = await requestOtp({ data: { phone } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResendIn(60);
    setTestCode(res.smsConnected ? null : res.testCode);
  }

  return (
    <section className="animate-pop w-full max-w-sm">
      <div className="card-playful px-6 py-8">
        <h2 className="font-display text-2xl font-bold text-foreground">اكتب كود التحقق ✍️</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          بعتنا كود من 6 أرقام على الرقم <span dir="ltr" className="font-bold">{maskPhone(phone)}</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="••••••"
            value={code}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              setError(null);
              if (digits.length === 6) void submit(digits);
            }}
            className="rounded-2xl border-2 border-input bg-card px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-foreground outline-none focus:border-primary"
          />

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="mt-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-[0_6px_0_0_var(--color-mint)] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {loading ? "لحظة.." : "تأكيد"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0}
            className="text-sm font-bold text-primary underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
          >
            {resendIn > 0 ? `تبعت كود جديد بعد ${resendIn} ثانية` : "اتبعت كود جديد"}
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/auth", replace: true })}
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            الرقم غلط؟ غيّره
          </button>
        </form>
      </div>

      {testCode && (
        <div className="mt-4 rounded-2xl border-2 border-sun bg-sun/20 px-4 py-3 text-sm leading-6 text-sun-foreground">
          <strong className="font-display">وضع تجريبي (مش وضع رسمي)</strong>
          <br />
          لسه مفيش خدمة SMS مربوطة، فالكود بيظهر هنا بدل الرسالة:{" "}
          <span dir="ltr" className="text-xl font-extrabold tracking-widest">{testCode}</span>
        </div>
      )}
    </section>
  );
}
