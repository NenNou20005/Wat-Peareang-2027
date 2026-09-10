import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { initVisitorSession, trackPageView } from "@/lib/analytics";
import { AdminShortcutListener } from "@/config/adminShortcut";

function PageTracker() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  useEffect(() => {
    // 1. Initialize anonymous visitor session
    initVisitorSession();
    // 2. Track current page view
    trackPageView(pathname);
  }, [pathname]);

  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl text-foreground">៤០៤</h1>
        <h2 className="mt-4 text-xl">រកមិនឃើញទំព័រ</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          ទំព័រនេះមិនមាន ឬត្រូវបានផ្លាស់ទីរួចហើយ។
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
          >
            ត្រឡប់ទំព័រដើម
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl">ទំព័រនេះមិនបានផ្ទុក</h1>
        <p className="mt-2 text-sm text-muted-foreground">សូមព្យាយាមម្ដងទៀត។</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground"
          >
            ព្យាយាមម្ដងទៀត
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm"
          >
            ទំព័រដើម
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "🏛️ បណ្ណសារវត្តពារាំង — Wat Peareang Khmer Festival Photo Archive" },
      {
        name: "description",
        content:
          "បណ្ណសាររូបភាព និងអនុស្សាវរីយ៍បុណ្យខ្មែរនៃវត្តពារាំង រៀបចំតាមឆ្នាំ និងតាមព្រឹត្តិការណ៍ — Wat Peareang Khmer Festival Photo Archive.",
      },
      { property: "og:site_name", content: "វត្តពារាំង — Wat Peareang Archive" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/favicon.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Moul&family=Kantumruy+Pro:wght@300;400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="km">
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PageTracker />
        <AdminShortcutListener />
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
          <Footer />
        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
