import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { useAuth } from "@/hooks/useAuth";
import {
  Sparkles,
  Calendar,
  FolderKanban,
  Image as ImageIcon,
  Users,
  ShieldCheck,
  Upload,
  Plus,
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "ផ្ទាំងគ្រប់គ្រង — Wat Peareang Admin" }],
  }),
  component: AdminDashboardPage,
});

interface DashboardData {
  totalFestivals: number;
  totalYears: number;
  totalAlbums: number;
  totalImages: number;
  totalEditors: number;
  activeEditors: number;
  recentActivities: Array<{
    id: string;
    userName: string;
    userRole: string;
    action: string;
    resource: string;
    details?: string;
    timestamp: string;
  }>;
  recentImages: Array<{
    id: string;
    title: string;
    url: string;
    createdAt: string;
    uploadedBy: string;
  }>;
}

function AdminDashboardPage() {
  const { user, isSuperAdmin, hasPermission } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
        }
      })
      .catch((e) => console.error("Error fetching dashboard stats:", e))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: "ពិធីបុណ្យសរុប",
      value: data?.totalFestivals ?? "...",
      icon: Sparkles,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      to: "/admin/festivals",
    },
    {
      label: "ឆ្នាំប្រារព្ធសរុប",
      value: data?.totalYears ?? "...",
      icon: Calendar,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      to: "/admin/years",
    },
    {
      label: "Albums សរុប",
      value: data?.totalAlbums ?? "...",
      icon: FolderKanban,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      to: "/admin/albums",
    },
    {
      label: "រូបភាពសរុប",
      value: data?.totalImages ?? "...",
      icon: ImageIcon,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      to: "/admin/images",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-gold/30 bg-gradient-to-r from-gold-soft/30 via-gold-soft/10 to-transparent p-6 shadow-soft">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
                {isSuperAdmin ? "👑 Super Admin" : "✍️ Editor"}
              </span>
              <span className="text-xs text-muted-foreground">
                ប្រព័ន្ធគ្រប់គ្រងបណ្ណសារវត្តពារាំង
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
              សួស្តី, {user?.name}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground max-w-xl">
              សូមស្វាគមន៍មកកាន់ផ្ទាំងគ្រប់គ្រងបណ្ណសាររូបភាពបុណ្យខ្មែរ។
              លោកអ្នកអាចគ្រប់គ្រងទិន្នន័យពិធីបុណ្យ Albums រូបភាព និងសិទ្ធិអ្នកកែសម្រួលបាននៅទីនេះ។
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(isSuperAdmin || hasPermission("upload_images")) && (
              <Button
                asChild
                className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
              >
                <Link to="/admin/images">
                  <Upload className="mr-1.5 h-4 w-4" /> បង្ហោះរូបភាព
                </Link>
              </Button>
            )}
            {isSuperAdmin && (
              <Button asChild variant="outline" className="rounded-full border-gold/40">
                <Link to="/admin/editors">
                  <Users className="mr-1.5 h-4 w-4 text-gold" /> គ្រប់គ្រង Editors
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                to={stat.to}
                className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="flex items-center justify-between">
                  <div className={`grid h-11 w-11 place-items-center rounded-2xl ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                    {loading ? "..." : stat.value}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Editor Overview (Super Admin Only) */}
        {isSuperAdmin && (
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    អ្នកកែសម្រួលប្រព័ន្ធ (Editors Status)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Super Admin ត្រូវបានកំណត់អតិបរមា = ១ នាក់។ Editors ត្រូវបានគ្រប់គ្រងដោយ Super
                    Admin។
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                <Link to="/admin/editors">
                  គ្រប់គ្រង <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground">Super Admin</p>
                <p className="mt-1 text-xl font-bold text-foreground">១ នាក់ (Max: 1)</p>
              </div>
              <div className="rounded-2xl bg-secondary/50 p-4">
                <p className="text-xs text-muted-foreground">Editors សរុប</p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {loading ? "..." : (data?.totalEditors ?? 0)} នាក់
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/50 p-4 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Active Editors</p>
                <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {loading ? "..." : (data?.activeEditors ?? 0)} នាក់កំពុងដំណើរការ
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Phase 3.1: Visitor Tracking & Views Analytics Dashboard */}
        <AnalyticsDashboard />

        {/* Two-Column Grid: Recent Activity & Quick Links */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activities (Audit Log Preview) */}
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-foreground">កំណត់ត្រាសកម្មភាពចុងក្រោយ</h3>
              </div>
              <Link
                to="/admin/activity-logs"
                className="text-xs text-gold hover:underline font-medium inline-flex items-center gap-1"
              >
                មើលទាំងអស់ <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border/40">
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  កំពុងទាញយកទិន្នន័យ...
                </div>
              ) : !data?.recentActivities?.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  មិនទាន់មានសកម្មភាពថ្មីនៅឡើយទេ។
                </div>
              ) : (
                data.recentActivities.map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{act.userName}</span>
                        <span className="rounded-md bg-secondary px-1.5 py-0.2 text-[10px] text-muted-foreground font-mono">
                          {act.action}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {act.details || act.resource}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground font-mono">
                      {new Date(act.timestamp).toLocaleDateString("km-KH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Shortcuts & Permissions */}
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> សិទ្ធិ និងតួនាទីរបស់អ្នក
            </h3>

            <div className="rounded-2xl bg-secondary/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ឈ្មោះគណនី:</span>
                <span className="font-semibold text-foreground">{user?.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">អ៊ីមែល:</span>
                <span className="font-mono text-foreground">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">តួនាទី (Role):</span>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
                  {isSuperAdmin ? "👑 Super Admin (Full Access)" : "✍️ Editor"}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-foreground">ផ្លូវកាត់រហ័ស (Quick Actions):</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/admin/festivals"
                  className="rounded-2xl border border-border bg-background p-3 text-xs font-medium hover:border-gold hover:text-gold transition-colors flex items-center gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5 text-gold" /> បន្ថែម/កែបុណ្យ
                </Link>
                <Link
                  to="/admin/albums"
                  className="rounded-2xl border border-border bg-background p-3 text-xs font-medium hover:border-gold hover:text-gold transition-colors flex items-center gap-2"
                >
                  <FolderKanban className="h-3.5 w-3.5 text-gold" /> បង្កើត Album ថ្មី
                </Link>
                <Link
                  to="/admin/images"
                  className="rounded-2xl border border-border bg-background p-3 text-xs font-medium hover:border-gold hover:text-gold transition-colors flex items-center gap-2"
                >
                  <Upload className="h-3.5 w-3.5 text-gold" /> Upload រូបភាព
                </Link>
                <Link
                  to="/admin/settings"
                  className="rounded-2xl border border-border bg-background p-3 text-xs font-medium hover:border-gold hover:text-gold transition-colors flex items-center gap-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-gold" /> ប្តូរពាក្យសម្ងាត់
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
