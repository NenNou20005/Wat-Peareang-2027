import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: unknown) => {
          // Check for HTTP status codes that should NOT be retried
          if (error && typeof error === "object" && "status" in error) {
            const status = (error as { status: number }).status;
            if (status === 401 || status === 403 || status === 404) {
              return false;
            }
          }
          // Also check error message for auth/not found cues
          if (error instanceof Error) {
            if (
              error.message.includes("401") ||
              error.message.includes("403") ||
              error.message.includes("404") ||
              error.message.includes("Unauthorized") ||
              error.message.includes("Forbidden")
            ) {
              return false;
            }
          }
          // Max 2 retries for transient 500/503/429 or network errors
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
