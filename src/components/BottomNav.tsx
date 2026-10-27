import { Link, useLocation } from "@tanstack/react-router";

const items = [
  { to: "/home", label: "الرئيسية", emoji: "🏠" },
  { to: "/profile", label: "ملفي", emoji: "🙂" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  // صفحة إكمال الملف الشخصي مش محتاجة شريط تنقل
  if (pathname.startsWith("/onboarding")) return null;

  return (
    <nav
      aria-label="التنقل السفلي"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-card/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-4 py-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-w-24 flex-col items-center gap-0.5 rounded-2xl px-4 py-2 font-display text-sm font-bold transition-colors ${
                active ? "bg-sky-soft text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="text-xl" aria-hidden>{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
