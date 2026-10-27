/**
 * تحقق وتوحيد أرقام الهواتف المصرية.
 * القاعدة: 11 رقمًا تبدأ بـ 01 وتليها 0/1/2/5 (شبكات مصر: اتصالات، فودافون، أورنج، وي).
 */
const EGYPT_PHONE_RE = /^01[0125]\d{8}$/;

/** يوحّد الرقم إلى صيغة E.164: 01012345678 → +201012345678 */
export function normalizeEgyptianPhone(input: string): string | null {
  let digits = (input || "").replace(/[\s\u200f\u200e\-\u066B]/g, "");
  // أرقام عربية-هندية إلى لاتينية
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  digits = digits.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));

  if (digits.startsWith("+20")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);
  else if (digits.startsWith("+") && digits.length === 13 && digits.startsWith("+2")) {
    digits = "0" + digits.slice(2);
  }

  if (!EGYPT_PHONE_RE.test(digits)) return null;
  return "+2" + digits;
}

/** إخفاء جزء من الرقم للعرض: +201012345678 → +20 •• ••• 678 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + " •• ••• " + phone.slice(-3);
}
