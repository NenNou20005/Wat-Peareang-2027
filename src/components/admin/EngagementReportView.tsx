import { Heart, Bookmark, Sparkles, FolderKanban, Image as ImageIcon, Flame } from "lucide-react";
import { useInteractionsAnalytics } from "@/hooks/useInteractions";
import { useReportsSummary, type ReportPeriod } from "@/hooks/useReportsData";
import { toKhmerNumber } from "@/data/archive";
import { Link } from "@tanstack/react-router";

export interface EngagementReportViewProps {
  period: ReportPeriod | string;
  startDate?: string | null;
  endDate?: string | null;
}

export function EngagementReportView({ period, startDate, endDate }: EngagementReportViewProps) {
  const { data: interactionsData, isLoading } = useInteractionsAnalytics(
    period === "today" ? "today" : period === "30d" ? "30d" : "all",
  );
  const { data: summaryData } = useReportsSummary(period, startDate, endDate);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
        <p className="text-sm">កំពុងទាញយកទិន្នន័យអន្តរកម្ម (Engagement & Interactions)...</p>
      </div>
    );
  }

  const likesTotal = summaryData?.metrics.likes.current ?? interactionsData?.likes.total ?? 0;
  const favsTotal =
    summaryData?.metrics.favorites.current ?? interactionsData?.favorites.total ?? 0;
  const totalEngagement = summaryData?.metrics.totalEngagement.current ?? likesTotal + favsTotal;
  const engagementRate = summaryData?.metrics.engagementRate.current ?? 0;

  return (
    <div className="space-y-6">
      {/* 4 Summary Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Likes Card */}
        <div className="rounded-3xl border border-rose-500/20 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-600">
              Likes
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ចំនួនចូលចិត្តសរុប</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(likesTotal)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            ក្នុងរយៈពេលជ្រើសរើស
          </p>
        </div>

        {/* Favorites Card */}
        <div className="rounded-3xl border border-amber-500/20 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Bookmark className="h-5 w-5 fill-current" />
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600">
              Favorites
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">ចំនួនរក្សាទុកក្នុងបញ្ជី</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(favsTotal)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            កត់ត្រាដោយអ្នកទស្សនា
          </p>
        </div>

        {/* Total Engagement */}
        <div className="rounded-3xl border border-gold/20 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Flame className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold">
              Total
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អន្តរកម្មសរុប (Total Actions)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {toKhmerNumber(totalEngagement)}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            Likes ({toKhmerNumber(likesTotal)}) + Favs ({toKhmerNumber(favsTotal)})
          </p>
        </div>

        {/* Engagement Rate */}
        <div className="rounded-3xl border border-indigo-500/20 bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-bold text-indigo-600">
              Rate
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">អត្រាអន្តរកម្ម (Engagement Rate)</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground font-mono">
              {engagementRate}%
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            ធៀបនឹងការចូលមើលទំព័រ
          </p>
        </div>
      </div>

      {/* Engagement Leaderboards (Top Liked & Top Favorited) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Liked Albums */}
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500 fill-current" />
              <span>Albums ពេញនិយមបំផុត (Top Liked)</span>
            </h4>
            <span className="text-xs text-muted-foreground">កម្រងរូបភាព</span>
          </div>

          <div className="space-y-2">
            {interactionsData?.topLikedAlbums && interactionsData.topLikedAlbums.length > 0 ? (
              interactionsData.topLikedAlbums.slice(0, 5).map((alb, idx) => (
                <div
                  key={alb.albumId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-secondary/30 p-3 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-gold/15 text-xs font-bold text-gold">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{alb.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {alb.festivalName} • ឆ្នាំ {toKhmerNumber(alb.year)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 font-mono">
                    <Heart className="h-3.5 w-3.5 fill-current" />
                    <span>{toKhmerNumber(alb.likesCount)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-xs text-muted-foreground">
                មិនទាន់មានទិន្នន័យ Likes សម្រាប់ Albums ទេ
              </p>
            )}
          </div>
        </div>

        {/* Top Favorited Albums */}
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-amber-500 fill-current" />
              <span>Albums រក្សាទុកច្រើនបំផុត (Top Favorited)</span>
            </h4>
            <span className="text-xs text-muted-foreground">បញ្ជីរក្សាទុក</span>
          </div>

          <div className="space-y-2">
            {interactionsData?.topFavoritedAlbums &&
            interactionsData.topFavoritedAlbums.length > 0 ? (
              interactionsData.topFavoritedAlbums.slice(0, 5).map((alb, idx) => (
                <div
                  key={alb.albumId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-secondary/30 p-3 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-amber-500/15 text-xs font-bold text-amber-600">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{alb.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {alb.festivalName} • ឆ្នាំ {toKhmerNumber(alb.year)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 font-mono">
                    <Bookmark className="h-3.5 w-3.5 fill-current" />
                    <span>{toKhmerNumber(alb.favoritesCount)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-xs text-muted-foreground">
                មិនទាន់មានទិន្នន័យ Favorites សម្រាប់ Albums ទេ
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
