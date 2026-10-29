<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## فهمي — قرارات تقنية
- تسجيل الدخول بالهاتف: OTP يولّده الخادم (هاش SHA-256 + pepper في جدول otp_codes، صلاحية 10 دقائق، 3 أكواد/ساعة، 5 محاولات لكل كود)؛ الجلسة تُصدر عبر generateLink magiclink بخطوة verifyOtp(token_hash) على العميل — لا يعتمد على مزود SMS. وضع الاختبار: الكود يظهر في الواجهة داخل صندوق «وضع تجريبي» حتى يُربط مزود SMS، وعندها يُحذف testCode من رد requestOtp فقط.
- أول تسجيل برقم +201070130082 يُمنح admin تلقائيًا عبر trigger على auth.users (handle_new_user ينشئ profiles + user_roles).
- لا تُستخدم Supabase Edge Functions؛ منطق الخادم عبر createServerFn، والخدمات الخارجية عبر أدوات Lovable فقط.
