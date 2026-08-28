import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

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
        <AnalyticsDashboard />
      </div>
    </AdminLayout>
  );
}
