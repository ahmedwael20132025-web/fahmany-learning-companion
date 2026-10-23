import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="text-7xl">🧭</div>
      <h1 className="mt-4 font-display text-3xl font-bold text-foreground">
        الصفحة مش موجودة
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        يبدو إنك وصلت لصفحة غير موجودة، جرّب ترجع للرئيسية.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          الرجوع للرئيسية
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="text-7xl">🤕</div>
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
        حصلت مشكلة صغيرة
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        جرّب تعيد المحاولة، أو ارجع للرئيسية ونكمل رحلتنا.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          حاول تاني
        </button>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border-2 border-input bg-card px-6 py-3 font-bold text-foreground"
        >
          الرئيسية
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "فهمني | افهمها صح، واتعلمها بحب!" },
      {
        name: "description",
        content:
          "فهمني منصة تعليمية ذكية لطلاب مصر: مدرس ذكي بالذكاء الاصطناعي، دروس، اختبارات، وكراسات PDF.",
      },
      { name: "author", content: "فهمني" },
      { property: "og:title", content: "فهمني | افهمها صح، واتعلمها بحب!" },
      {
        property: "og:description",
        content: "منصة تعليمية ذكية لطلاب مصر: مدرس ذكي، دروس، اختبارات وكراسات PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Baloo+Bhaijaan+2:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // تتبع حالة الدخول: إعادة تحميل البيانات عند الدخول أو الخروج فقط
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED")
        return;
      queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
