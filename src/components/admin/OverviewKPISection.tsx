import {
  Users,
  Eye,
  Layers,
  Heart,
  Bookmark,
  Sparkles,
  Search,
  MousePointerClick,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { ReportsSummaryData, MetricComparison } from "@/hooks/useReportsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";

export interface OverviewKPISectionProps {
  data: ReportsSummaryData;
  isLoading?: boolean;
}

function MetricChangeBadge({
  comparison,
  invertColor = false,
}: {
  comparison: MetricComparison;
  invertColor?: boolean;
}) {
  if (comparison.changePercent === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>គ្មានទិន្នន័យប្រៀបធៀប</span>
      </span>
    );
  }

  const isPositive = comparison.changePercent > 0;
  const isNeutral = comparison.changePercent === 0;

  // For zero-result rate, positive change (increase in failures) is bad (red)
  const isGood = invertColor ? !isPositive : isPositive;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground font-mono">
        0.0%
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono tracking-tight",
        isGood
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
      )}
    >
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>
        {isPositive ? "+" : ""}
        {comparison.changePercent}%
      </span>
    </span>
  );
}

export function OverviewKPISection({ data, isLoading = false }: OverviewKPISectionProps) {
  const { metrics, previousPeriod } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <span>សូចនាករស្នូល & ការប្រៀបធៀបនិន្នាការ (Key Performance Indicators)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {previousPeriod ? "ប្រៀបធៀបនឹងរយៈពេលមុនដោយស្វ័យប្រវត្តិ" : "ទិន្នន័យសរុបគ្រប់ពេលវេលា"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Unique Visitors */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.uniqueVisitors} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អ្នកទស្សនាប្លែកៗ (Unique Visitors)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(metrics.uniqueVisitors.current)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">នាក់</span>
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>រយៈពេលមុន:</span>
            <span className="font-semibold text-foreground font-mono">
              {toKhmerNumber(metrics.uniqueVisitors.previous)}
            </span>
          </div>
        </div>

        {/* 2. Total Views */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Eye className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.totalViews} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ការមើលសរុប (Total Views)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(metrics.totalViews.current)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>
              ទំព័រ: {toKhmerNumber(metrics.pageViews.current)} | Albums:{" "}
              {toKhmerNumber(metrics.albumViews.current)}
            </span>
          </div>
        </div>

        {/* 3. Total Engagement */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <MetricChangeBadge comparison={metrics.totalEngagement} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អន្តរកម្មសរុប (Likes + Favorites)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(metrics.totalEngagement.current)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>
              ចូលចិត្ត: {toKhmerNumber(metrics.likes.current)} | រក្សាទុក:{" "}
              {toKhmerNumber(metrics.favorites.current)}
            </span>
          </div>
        </div>

        {/* 4. Engagement Rate */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.engagementRate} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អត្រាអន្តរកម្ម (Engagement Rate)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics.engagementRate.current}%
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>រយៈពេលមុន:</span>
            <span className="font-semibold text-foreground font-mono">
              {metrics.engagementRate.previous}%
            </span>
          </div>
        </div>

        {/* 5. Total Searches */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Search className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.searches} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ចំនួនស្វែងរកសរុប (Searches)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(metrics.searches.current)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>ពាក្យប្លែកៗ:</span>
            <span className="font-semibold text-foreground font-mono">
              {toKhmerNumber(metrics.uniqueQueries.current)}
            </span>
          </div>
        </div>

        {/* 6. Search CTR */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <MousePointerClick className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.searchCtr} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អត្រាចុចលទ្ធផល (Search CTR)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics.searchCtr.current}%
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>រយៈពេលមុន:</span>
            <span className="font-semibold text-foreground font-mono">
              {metrics.searchCtr.previous}%
            </span>
          </div>
        </div>

        {/* 7. Zero-Result Rate */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.zeroResultRate} invertColor={true} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ស្វែងរកគ្មានលទ្ធផល (Zero-Result Rate)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics.zeroResultRate.current}%
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>រយៈពេលមុន:</span>
            <span className="font-semibold text-foreground font-mono">
              {metrics.zeroResultRate.previous}%
            </span>
          </div>
        </div>

        {/* 8. Searches per visitor */}
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft transition-all hover:border-gold/30">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
              <Layers className="h-5 w-5" />
            </div>
            <MetricChangeBadge comparison={metrics.searchesPerVisitor} />
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ស្វែងរកក្នុងម្នាក់ (Searches / Visitor)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {metrics.searchesPerVisitor.current}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង/នាក់</span>
            </p>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>រយៈពេលមុន:</span>
            <span className="font-semibold text-foreground font-mono">
              {metrics.searchesPerVisitor.previous}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
