import { useState } from "react";
import {
  Search,
  AlertTriangle,
  MousePointerClick,
  Layers,
  Calendar,
  Clock,
  ExternalLink,
  Sparkles,
  SearchCheck,
  SearchX,
  FileQuestion,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useSearchAnalytics } from "@/hooks/useSearchAnalytics";
import type { AnalyticsPeriod } from "@/hooks/useAnalyticsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export function SearchAnalyticsView({ period }: { period: AnalyticsPeriod }) {
  const { data, isLoading, isError } = useSearchAnalytics(period);
  const [activeSubTab, setActiveSubTab] = useState<"top" | "zero" | "recent">("top");

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
        <p className="text-sm">កំពុងទាញយកទិន្នន័យស្ថិតិនៃការស្វែងរក (Search Analytics)...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive shadow-soft">
        <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
        <p className="text-sm font-semibold">មិនអាចទាញយកទិន្នន័យស្វែងរកបានទេ។ សូមព្យាយាមម្តងទៀត។</p>
      </div>
    );
  }

  const { summary, dailyTrend, topQueries, zeroResultQueries, recentSearches } = data;

  return (
    <div className="space-y-6">
      {/* 5 Search Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: Total Searches */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Search className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
              Total Searches
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ចំនួនស្វែងរកសរុប</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(summary.totalSearches)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            ពាក្យគន្លឹះដាច់ដោយឡែក:{" "}
            <span className="font-semibold text-foreground">
              {toKhmerNumber(summary.uniqueQueries)}
            </span>
          </p>
        </div>

        {/* Card 2: Unique Queries */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
              Unique Terms
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ពាក្យគន្លឹះប្លែកៗ</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(summary.uniqueQueries)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ពាក្យ</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            ជាមធ្យម:{" "}
            <span className="font-semibold text-foreground">
              {toKhmerNumber(summary.avgResultsCount)}
            </span>{" "}
            លទ្ធផល/ដង
          </p>
        </div>

        {/* Card 3: Click-Through Rate (CTR) */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MousePointerClick className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              CTR %
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អត្រាចុចលើលទ្ធផល (CTR)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(summary.clickThroughRate)}%
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            ចុចចូលមើលសរុប:{" "}
            <span className="font-semibold text-foreground">
              {toKhmerNumber(summary.totalClicks)}
            </span>{" "}
            ដង
          </p>
        </div>

        {/* Card 4: Zero-Result Searches */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <SearchX className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
              Zero Results
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ស្វែងរកគ្មានលទ្ធផល</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(summary.zeroResultSearches)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            អត្រាខកខាន:{" "}
            <span className="font-semibold text-rose-600">
              {toKhmerNumber(summary.zeroResultRate)}%
            </span>
          </p>
        </div>

        {/* Card 5: Search Quality Score */}
        <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              Success Rate
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អត្រាជោគជ័យនៃការស្វែងរក</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(Math.max(0, Number((100 - summary.zeroResultRate).toFixed(1))))}%
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            គិតលើសំណួរដែលរកឃើញមាតិកា
          </p>
        </div>
      </div>

      {/* Daily Search Volume & Clicks Chart */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3 gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <SearchCheck className="h-4 w-4 text-gold" />
              និន្នាការស្វែងរកប្រចាំថ្ងៃ (Daily Search Trends & Conversion)
            </h3>
            <p className="text-xs text-muted-foreground">
              ប្រៀបធៀបចំនួនស្វែងរកសរុប ការចុចបើកលទ្ធផល និងការស្វែងរកដែលពុំមានលទ្ធផល
            </p>
          </div>
        </div>

        <div className="h-[280px] w-full pt-2">
          {dailyTrend.length === 0 ? (
            <div className="h-full grid place-items-center text-xs text-muted-foreground">
              មិនទាន់មានទិន្នន័យគ្រប់គ្រាន់សម្រាប់គូរក្រាហ្វិក។
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="searchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.15} />
                <XAxis dataKey="label" stroke="#888" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(24, 24, 27, 0.95)",
                    borderRadius: "16px",
                    border: "1px solid rgba(212, 175, 55, 0.3)",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val: number, name: string) => [
                    toKhmerNumber(val),
                    name === "searches"
                      ? "ស្វែងរក (Searches)"
                      : name === "clicks"
                        ? "ចុចមើលលទ្ធផល (Clicks)"
                        : "គ្មានលទ្ធផល (Zero Results)",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  formatter={(val) =>
                    val === "searches"
                      ? "ស្វែងរកសរុប (Searches)"
                      : val === "clicks"
                        ? "ចុចលើលទ្ធផល (Clicks)"
                        : "គ្មានលទ្ធផល (Zero Results)"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="searches"
                  stroke="#d4af37"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#searchGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#clickGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="zeroResults"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Detail Analysis Tabs: Top Queries, Zero Results, Recent Searches */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gold" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                តារាងវិភាគសំណួរស្វែងរក (Search Queries Intelligence)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                យល់ដឹងពីអ្វីដែលអ្នកទស្សនាកំពុងស្វែងរក និងមាតិកាដែលពួកគេចង់ឃើញ
              </p>
            </div>
          </div>

          <div className="flex items-center rounded-xl bg-secondary/50 p-1">
            <button
              onClick={() => setActiveSubTab("top")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeSubTab === "top"
                  ? "bg-background text-foreground shadow-xs font-semibold text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <SearchCheck className="h-3.5 w-3.5" />
              ពាក្យស្វែងរកច្រើន (Top Queries)
            </button>
            <button
              onClick={() => setActiveSubTab("zero")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeSubTab === "zero"
                  ? "bg-background text-rose-600 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <SearchX className="h-3.5 w-3.5" />
              ស្វែងរកខកខាន (Zero Results)
              {zeroResultQueries.length > 0 && (
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] text-rose-600 font-bold">
                  {zeroResultQueries.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab("recent")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeSubTab === "recent"
                  ? "bg-background text-blue-600 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              សកម្មភាពថ្មីៗ (Live Stream)
            </button>
          </div>
        </div>

        {/* Tab 1: Top Queries */}
        {activeSubTab === "top" && (
          <div className="overflow-x-auto">
            {topQueries.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                មិនទាន់មានទិន្នន័យស្វែងរកក្នុងកាលបរិច្ឆេទនេះនៅឡើយទេ។
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="pb-3 pl-2 font-medium">ល.រ</th>
                    <th className="pb-3 font-medium">ពាក្យស្វែងរក (Query)</th>
                    <th className="pb-3 text-right font-medium">ចំនួនស្វែងរក</th>
                    <th className="pb-3 text-right font-medium">លទ្ធផលជាមធ្យម</th>
                    <th className="pb-3 text-right font-medium">ចុចចូលមើល (Clicks)</th>
                    <th className="pb-3 text-right font-medium">អត្រា CTR</th>
                    <th className="pb-3 text-right pr-2 font-medium">ស្វែងរកចុងក្រោយ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {topQueries.map((item, idx) => (
                    <tr
                      key={item.normalizedQuery}
                      className="hover:bg-secondary/20 transition-colors"
                    >
                      <td className="py-3 pl-2 font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            “{item.query}”
                          </span>
                          <Link
                            to="/search"
                            search={{ q: item.query }}
                            target="_blank"
                            className="text-muted-foreground hover:text-gold"
                            title="សាកល្បងស្វែងរក"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-foreground">
                        {toKhmerNumber(item.searchCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {toKhmerNumber(item.avgResults)}
                      </td>
                      <td className="py-3 text-right font-mono text-emerald-600 font-medium">
                        {toKhmerNumber(item.clickCount)}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
                            item.ctrPercent >= 50
                              ? "bg-emerald-500/15 text-emerald-600"
                              : item.ctrPercent > 0
                                ? "bg-amber-500/15 text-amber-600"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {toKhmerNumber(item.ctrPercent)}%
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2 text-muted-foreground font-mono text-[11px]">
                        {new Date(item.lastSearchedAt).toLocaleDateString("km-KH", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Zero Results (Missed Searches) */}
        {activeSubTab === "zero" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
              <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">ឱកាសក្នុងការបំពេញមាតិកា (Content Gap Opportunities)</p>
                <p className="mt-0.5 text-muted-foreground">
                  ពាក្យទាំងនេះត្រូវបានអ្នកទស្សនាស្វែងរក
                  ប៉ុន្តែប្រព័ន្ធមិនបានរកឃើញកម្រងរូបភាពដែលត្រូវគ្នា។ អ្នកគ្រប់គ្រងអាចបង្កើត Album
                  ថ្មី ឬបន្ថែមឈ្មោះពិធីបុណ្យដែលត្រូវនឹងពាក្យទាំងនេះ។
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              {zeroResultQueries.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  🎉 អស្ចារ្យណាស់! មិនមានសំណួរស្វែងរកណាដែលគ្មានលទ្ធផលក្នុងកាលបរិច្ឆេទនេះទេ។
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="pb-3 pl-2 font-medium">ល.រ</th>
                      <th className="pb-3 font-medium">ពាក្យស្វែងរកខកខាន</th>
                      <th className="pb-3 text-right font-medium">ចំនួនដង</th>
                      <th className="pb-3 font-medium pl-6">
                        សំណើដំណោះស្រាយ (Actionable Suggestion)
                      </th>
                      <th className="pb-3 text-right pr-2 font-medium">ស្វែងរកចុងក្រោយ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {zeroResultQueries.map((item, idx) => (
                      <tr
                        key={item.normalizedQuery}
                        className="hover:bg-secondary/20 transition-colors"
                      >
                        <td className="py-3 pl-2 font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-3">
                          <span className="font-semibold text-rose-600 text-sm">
                            “{item.query}”
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-foreground">
                          {toKhmerNumber(item.searchCount)} ដង
                        </td>
                        <td className="py-3 pl-6">
                          <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs text-foreground font-medium">
                            💡 {item.suggestedAction}
                          </span>
                        </td>
                        <td className="py-3 text-right pr-2 text-muted-foreground font-mono text-[11px]">
                          {new Date(item.lastSearchedAt).toLocaleDateString("km-KH", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Recent Searches Live Stream */}
        {activeSubTab === "recent" && (
          <div className="overflow-x-auto">
            {recentSearches.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                មិនទាន់មានសកម្មភាពស្វែងរកថ្មីៗនៅឡើយទេ។
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="pb-3 pl-2 font-medium">កាលបរិច្ឆេទ & ម៉ោង</th>
                    <th className="pb-3 font-medium">ពាក្យស្វែងរក</th>
                    <th className="pb-3 text-right font-medium">លទ្ធផល</th>
                    <th className="pb-3 font-medium pl-6">ស្ថានភាពជ្រើសរើស (Click)</th>
                    <th className="pb-3 text-right pr-2 font-medium">Visitor ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 font-mono">
                  {recentSearches.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pl-2 text-muted-foreground text-[11px]">
                        {new Date(item.createdAt).toLocaleTimeString("km-KH", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 font-sans font-medium text-foreground">“{item.query}”</td>
                      <td className="py-3 text-right">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            item.resultsCount > 0
                              ? "bg-emerald-500/15 text-emerald-600"
                              : "bg-rose-500/15 text-rose-600",
                          )}
                        >
                          {toKhmerNumber(item.resultsCount)} រកឃើញ
                        </span>
                      </td>
                      <td className="py-3 pl-6 font-sans text-xs">
                        {item.selectedResultId ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <MousePointerClick className="h-3 w-3" />
                            បើកមើល {item.selectedResultType || "album"}:{" "}
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {item.selectedResultId}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            (មិនបានចុចលទ្ធផល)
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right pr-2 text-muted-foreground text-[10px]">
                        {item.visitorId ? item.visitorId.slice(0, 10) + "..." : "Anonymous"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
