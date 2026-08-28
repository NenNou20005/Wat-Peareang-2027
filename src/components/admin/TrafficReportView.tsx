import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Users, Eye, Layers, Image as ImageIcon, FolderKanban } from "lucide-react";
import { useAnalyticsViewsSeries } from "@/hooks/useAnalyticsData";
import { useReportsSummary, type ReportPeriod } from "@/hooks/useReportsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";

export interface TrafficReportViewProps {
  period: ReportPeriod | string;
  startDate?: string | null;
  endDate?: string | null;
}

export function TrafficReportView({ period, startDate, endDate }: TrafficReportViewProps) {
  const seriesPeriod = period === "today" ? "today" : period === "30d" ? "30d" : "7d";
  const { data: viewsSeries, isLoading: isSeriesLoading } = useAnalyticsViewsSeries(seriesPeriod);
  const { data: summaryData, isLoading: isSummaryLoading } = useReportsSummary(
    period,
    startDate,
    endDate,
  );

  const [activeMetric, setActiveMetric] = useState<"all" | "page" | "album" | "image">("all");

  const chartData =
    viewsSeries?.map((p) => ({
      label: p.label,
      total: p.totalViews,
      page: p.pageViews,
      album: p.albumViews,
      image: p.imageViews,
    })) || [];

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-blue-500/20 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold">អ្នកទស្សនាប្លែកៗ (Visitors)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(summaryData?.metrics.uniqueVisitors.current ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ក្នុងរយៈពេលជ្រើសរើស</p>
        </div>

        <div className="rounded-3xl border border-gold/20 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-gold">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-semibold">ការចូលមើលទំព័រ (Page Views)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(summaryData?.metrics.pageViews.current ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ការចូលមើលគេហទំព័រទូទៅ</p>
        </div>

        <div className="rounded-3xl border border-emerald-500/20 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <FolderKanban className="h-4 w-4" />
            <span className="text-xs font-semibold">ការចូលមើល Albums</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(summaryData?.metrics.albumViews.current ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ការបើកមើលផ្ទាំងកម្រងរូបភាព</p>
        </div>

        <div className="rounded-3xl border border-indigo-500/20 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs font-semibold">ការចូលមើលរូបថត (Image Views)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(summaryData?.metrics.imageViews.current ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ការបើកមើលរូបថតលម្អិត</p>
        </div>
      </div>

      {/* Main Interactive Chart */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-gold" />
              <span>និន្នាការចរាចរណ៍ & ការចូលមើលតាមពេលវេលា (Traffic & Views Series)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              ទិន្នន័យកត់ត្រាជាក់ស្តែងពី PostgreSQL views_log
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-2xl bg-secondary/70 p-1">
            <button
              onClick={() => setActiveMetric("all")}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-semibold transition-all",
                activeMetric === "all"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ទាំងអស់ (Total)
            </button>
            <button
              onClick={() => setActiveMetric("page")}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-semibold transition-all",
                activeMetric === "page"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ទំព័រ
            </button>
            <button
              onClick={() => setActiveMetric("album")}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-semibold transition-all",
                activeMetric === "album"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Albums
            </button>
            <button
              onClick={() => setActiveMetric("image")}
              className={cn(
                "rounded-xl px-3 py-1 text-xs font-semibold transition-all",
                activeMetric === "image"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              រូបថត
            </button>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          {isSeriesLoading ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent mb-2" />
              <span>កំពុងផ្ទុកទិន្នន័យក្រាហ្វិក...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              <span>មិនមានទិន្នន័យកត់ត្រាក្នុងកាលបរិច្ឆេទនេះទេ</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalViewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pageViewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="albumViewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="imageViewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend />
                {activeMetric === "all" && (
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="ការចូលមើលសរុប"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#totalViewsGrad)"
                  />
                )}
                {(activeMetric === "all" || activeMetric === "page") && (
                  <Area
                    type="monotone"
                    dataKey="page"
                    name="ការមើលទំព័រ"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#pageViewsGrad)"
                  />
                )}
                {(activeMetric === "all" || activeMetric === "album") && (
                  <Area
                    type="monotone"
                    dataKey="album"
                    name="ការមើល Albums"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#albumViewsGrad)"
                  />
                )}
                {(activeMetric === "all" || activeMetric === "image") && (
                  <Area
                    type="monotone"
                    dataKey="image"
                    name="ការមើលរូបថត"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#imageViewsGrad)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
