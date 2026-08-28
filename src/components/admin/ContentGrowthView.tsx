import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, Image as ImageIcon, FolderKanban, Calendar, Sparkles } from "lucide-react";
import { useArchiveGrowth } from "@/hooks/useReportsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";

export function ContentGrowthView() {
  const [groupBy, setGroupBy] = useState<"month" | "year">("month");
  const { data, isLoading, isError } = useArchiveGrowth(groupBy);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
        <p className="text-sm">កំពុងគណនាកំណើនបណ្ណសារដ្ឋាន (Archive Growth)...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive shadow-soft">
        <p className="text-sm font-semibold">មិនអាចទាញយកទិន្នន័យកំណើនបណ្ណសារដ្ឋានបានទេ។</p>
      </div>
    );
  }

  const chartData = data.timeline.map((t) => ({
    label: t.periodLabel,
    imagesAdded: t.newImages,
    albumsAdded: t.newAlbums,
    cumulativeImages: t.cumulativeImages,
    cumulativeAlbums: t.cumulativeAlbums,
  }));

  return (
    <div className="space-y-6">
      {/* 4 Summary Milestone Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-gold/20 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-gold">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs font-semibold">រូបថតបណ្ណសារដ្ឋានសរុប</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.images)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">សន្លឹក</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">បានរក្សាទុកក្នុងប្រព័ន្ធ</p>
        </div>

        <div className="rounded-3xl border border-blue-500/20 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <FolderKanban className="h-4 w-4" />
            <span className="text-xs font-semibold">កម្រងរូបភាពសរុប (Albums)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.albums)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">Albums</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">បានរៀបចំយ៉ាងត្រឹមត្រូវ</p>
        </div>

        <div className="rounded-3xl border border-emerald-500/20 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-semibold">ចំនួនឆ្នាំបានកត់ត្រា</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.years)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">ឆ្នាំ</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ប្រវត្តិសាស្ត្រវប្បធម៌</p>
        </div>

        <div className="rounded-3xl border border-indigo-500/20 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold">ពិធីបុណ្យប្រពៃណី</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.festivals)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">កម្មវិធី</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ទិន្នន័យសម្បូរបែប</p>
        </div>
      </div>

      {/* Main Growth Charts */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gold" />
              <span>កំណើនខ្លឹមសារបណ្ណសារដ្ឋានតាមពេលវេលា (Archive Growth Timeline)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ការបន្ថែមរូបថត និង Albums ថ្មីៗចូលទៅក្នុងប្រព័ន្ធ
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-2xl bg-secondary/80 p-1">
            <button
              onClick={() => setGroupBy("month")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                groupBy === "month"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              តាមខែ (Monthly)
            </button>
            <button
              onClick={() => setGroupBy("year")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
                groupBy === "year"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              តាមឆ្នាំ (Yearly)
            </button>
          </div>
        </div>

        {/* 1. Monthly/Yearly Additions Bar Chart */}
        <div>
          <h4 className="text-xs font-bold text-foreground mb-2">
            ខ្លឹមសារថ្មីបន្ថែមក្នុងចន្លោះពេល (New Uploads per Period)
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="label" stroke="currentColor" opacity={0.6} tickLine={false} />
                <YAxis stroke="currentColor" opacity={0.6} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "1rem",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="imagesAdded"
                  name="រូបថតបន្ថែមថ្មី"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="albumsAdded"
                  name="Albums បន្ថែមថ្មី"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Cumulative Growth Area Chart */}
        <div className="border-t border-border/40 pt-6">
          <h4 className="text-xs font-bold text-foreground mb-2">
            កំណើនកើនឡើងសរុប (Cumulative Archive Size)
          </h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumImagesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                <XAxis dataKey="label" stroke="currentColor" opacity={0.6} tickLine={false} />
                <YAxis stroke="currentColor" opacity={0.6} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "1rem",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="cumulativeImages"
                  name="រូបថតសរុបកើនឡើង"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cumImagesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
