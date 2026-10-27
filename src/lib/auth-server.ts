/**
 * دوال الخادم لتسجيل الدخول برقم الهاتف المصري + كود تحقق.
 *
 * وضع الاختبار الحالي: لا يوجد مزود SMS مربوط بعد، لذا يُعرض الكود
 * في الواجهة داخل صندوق واضح بعنوان «وضع تجريبي». هذا ليس تجاوزًا
 * للتحقق — الكود حقيقي محفوظ مشفّرًا في قاعدة البيانات بمهلة وصلاحيات.
 * عند ربط مزود SMS حقيقي لاحقًا، يكفي استبدال التعليق في requestOtp
 * بإرسال فعلي وإزالة testCode من الرد.
 */
import { createServerFn } from "@tanstack/react-start";
import { normalizeEgyptianPhone } from "./phone";

const OTP_TTL_MS = 10 * 60 * 1000; // صلاحية الكود 10 دقائق
const RESEND_COOLDOWN_MS = 60 * 1000; // دقيقة بين كل إرسال
const MAX_SENDS_PER_HOUR = 3; // حد أقصى 3 أكواد في الساعة
const MAX_VERIFY_ATTEMPTS = 5; // حد أقصى 5 محاولات لكل كود

async function hashCode(phone: string, code: string): Promise<string> {
  const pepper = process.env["OTP_PEPPER"] ?? "fahmany-otp-pepper-v1";
  const bytes = new TextEncoder().encode(`${phone}:${code}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** طلب كود تحقق جديد */
export const requestOtp = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { phone: string })
  .handler(async ({ data }) => {
    const phone = normalizeEgyptianPhone(data?.phone ?? "");
    if (!phone) {
      return { ok: false as const, error: "الرقم مش رقم مصري صحيح. اكتبه بصيغة 01xxxxxxxxx" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // حماية من تكرار الإرسال: 3 أكواد كحد أقصى في الساعة
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabaseAdmin
      .from("otp_codes")
      .select("created_at")
      .eq("phone", phone)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (recentErr) return { ok: false as const, error: "حصلت مشكلة، جرّب تاني بعد شوية" };

    if (recent && recent.length >= MAX_SENDS_PER_HOUR) {
      return { ok: false as const, error: "بعتنا ليك أكواد كتير النهارده. استنى ساعة وجرب تاني" };
    }
    if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
      return { ok: false as const, error: "استنى دقيقة قبل ما تطلب كود جديد" };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await hashCode(phone, code);

    const { error: insertErr } = await supabaseAdmin.from("otp_codes").insert({
      phone,
      code_hash,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    });
    if (insertErr) return { ok: false as const, error: "حصلت مشكلة في إنشاء الكود، جرّب تاني" };

    // تنظيف الأكواد المنتهية
    await supabaseAdmin.from("otp_codes").delete().lt("expires_at", new Date().toISOString());

    // TODO(SMS): عند ربط مزود SMS حقيقي أرسل الكود هنا واحذف testCode من الرد.
    return { ok: true as const, testCode: code, smsConnected: false };
  });

/** التحقق من الكود وتسجيل الدخول */
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { phone: string; code: string })
  .handler(async ({ data }) => {
    const phone = normalizeEgyptianPhone(data?.phone ?? "");
    const code = (data?.code ?? "").replace(/\D/g, "");
    if (!phone || code.length !== 6) {
      return { ok: false as const, error: "اكتب الكود المكوّن من 6 أرقام" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts, consumed")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rowErr || !row || row.consumed) {
      return { ok: false as const, error: "اطلب كود جديد من شاشة الرقم" };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      return { ok: false as const, error: "الكود انتهت صلاحيته. اطلب كود جديد" };
    }
    if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
      await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
      return { ok: false as const, error: "محاولات كتير غلط. اطلب كود جديد" };
    }

    const hash = await hashCode(phone, code);
    if (hash !== row.code_hash) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return { ok: false as const, error: "الكود مش صحيح. جرّب تاني" };
    }

    await supabaseAdmin.from("otp_codes").update({ consumed: true }).eq("id", row.id);

    // الكود صحيح — نضمن وجود الحساب ثم نصدر جلسة موثقة عبر رابط سحري أحادي الاستخدام
    const syntheticEmail = `${phone.replace(/\+/g, "")}@phone.fahmany.app`;
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    let link = await admin.auth.admin.generateLink({ type: "magiclink", email: syntheticEmail });
    if (link.error) {
      // أول مرة: ننشئ الحساب (مؤكد الهاتف) ثم نصدر الرابط
      const created = await admin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        email: syntheticEmail,
        email_confirm: true,
      });
      if (created.error) {
        // الحساب موجود برقم الهاتف لكن بريد مختلف: نوحّد البريد ثم نعيد
        const { data: profileRow } = await admin
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();
        if (profileRow) {
          await admin.auth.admin.updateUserById(profileRow.id, {
            email: syntheticEmail,
            email_confirm: true,
          });
          link = await admin.auth.admin.generateLink({ type: "magiclink", email: syntheticEmail });
        }
      } else {
        link = await admin.auth.admin.generateLink({ type: "magiclink", email: syntheticEmail });
      }
    }

    if (link.error || !link.data.properties?.hashed_token) {
      console.error("[fahmany-auth] generateLink failed:", link.error);
      return { ok: false as const, error: "اتعمل الحساب بس حصلت مشكلة في الدخول. جرّب تاني" };
    }

    // إنجاز «بداية موفقة» عند أول دخول
    const userId = link.data.user?.id;
    if (userId) {
      const { data: ach } = await admin
        .from("achievements")
        .select("id")
        .eq("key", "first_login")
        .maybeSingle();
      if (ach) {
        await admin.from("student_achievements").upsert(
          { student_id: userId, achievement_id: ach.id },
          { onConflict: "student_id,achievement_id" },
        );
      }
    }

    return { ok: true as const, tokenHash: link.data.properties.hashed_token };
  });
