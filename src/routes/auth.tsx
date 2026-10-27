import { createFileRoute, Outlet } from "@tanstack/react-router";
import mascot from "@/assets/mascot-teacher.png";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-sky-soft via-background to-background">
      <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-sun/25 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-mint/25 blur-2xl" />

      <div className="relative z-10 flex flex-col items-center pt-10">
        <img
          src={mascot}
          alt="بومة المدرس الذكي"
          width={1024}
          height={1024}
          className="animate-float h-24 w-24"
        />
        <span className="mt-1 font-display text-xl font-extrabold text-primary">فهمني</span>
      </div>

      <main className="relative z-10 flex flex-1 items-start justify-center px-6 pb-16 pt-6">
        <Outlet />
      </main>
    </div>
  );
}
