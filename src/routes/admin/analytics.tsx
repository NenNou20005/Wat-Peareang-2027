import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

const AnalyticsDashboard = lazy(() =>
  import("@/components/admin/AnalyticsDashboard").then((m) => ({ default: m.AnalyticsDashboard }))
);

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [{ title: "ស្ថិតិអ្នកទស្សនា — Wat Peareang Admin" }],
  }),
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <Suspense
          fallback={
            <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
              <p className="text-sm">កំពុងផ្ទុកផ្ទាំងវិភាគទិន្នន័យ...</p>
            </div>
          }
        >
          <AnalyticsDashboard />
        </Suspense>
      </div>
    </AdminLayout>
  );
}
