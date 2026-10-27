import { createFileRoute, Link } from "@tanstack/react-router";
import mascot from "@/assets/mascot-teacher.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "فهمني | افهمها صح، واتعلمها بحب!",
      },
      {
        name: "description",
        content:
          "فهمني منصة تعليمية ذكية لطلاب مصر: سجّل برقم موبايلك وابدأ تتعلم مع المدرس الذكي.",
      },
      { property: "og:title", content: "فهمني | افهمها صح، واتعلمها بحب!" },
      {
        property: "og:description",
        content: "منصة تعليمية ذكية لطلاب مصر: سجّل برقم موبايلك وابدأ رحلة الفهم.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-sky-soft via-background to-background">
      {/* زخارف لطيفة */}
      <div className="pointer-events-none absolute -top-10 -left-10 h-48 w-48 rounded-full bg-mint/30 blur-2xl" />
      <div className="pointer-events-none absolute top-40 -right-16 h-56 w-56 rounded-full bg-sun/30 blur-2xl" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <img
          src={mascot}
          alt="فرماني — بومة المدرس الذكي"
          width={1024}
          height={1024}
          className="animate-float h-44 w-44 drop-shadow-lg"
        />

        <h1 className="animate-pop mt-4 font-display text-5xl font-extrabold text-primary">
          فهمني
        </h1>
        <p className="mt-2 font-display text-lg font-bold text-foreground">
          افهمها صح.. واتعلمها بحب!
        </p>
        <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
          منصة تعليمية ذكية لطلاب مصر: دروس مفيهمة، مدرس ذكي بيجاوبك، اختبارات
          ممتعة، وكراسات PDF جاهزة للطباعة.
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-4 font-display text-lg font-bold text-primary-foreground shadow-[0_6px_0_0_var(--color-mint)] transition-transform active:translate-y-1 active:shadow-none"
          >
            يلا نبدأ 🚀
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          بالدخول أنت موافق إنك بتستخدم المنصة للتعلم فقط 🌱
        </p>
      </main>
    </div>
  );
}
