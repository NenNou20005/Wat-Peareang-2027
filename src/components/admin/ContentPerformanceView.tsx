import { useState, useMemo } from "react";
import {
  FolderKanban,
  PartyPopper,
  Calendar,
  Eye,
  Heart,
  Bookmark,
  MousePointerClick,
  Sparkles,
  Search,
  ArrowUpDown,
  Filter,
  ExternalLink,
} from "lucide-react";
import { useContentPerformance, type ReportPeriod } from "@/hooks/useReportsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export interface ContentPerformanceViewProps {
  period: ReportPeriod | string;
  startDate?: string | null;
  endDate?: string | null;
}

export function ContentPerformanceView({
  period,
  startDate,
  endDate,
}: ContentPerformanceViewProps) {
  const [activeTab, setActiveTab] = useState<"festivals" | "years" | "albums">("festivals");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedFestival, setSelectedFestival] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "views" | "likes" | "favs" | "photos">("score");

  const { data, isLoading, isError } = useContentPerformance(
    period,
    startDate,
    endDate,
    selectedFestival || undefined,
    selectedYear ? parseInt(selectedYear, 10) : undefined,
  );

  const filteredAlbums = useMemo(() => {
    if (!data?.albums) return [];
    let list = [...data.albums];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.festivalName.toLowerCase().includes(q) ||
          String(a.year).includes(q),
      );
    }
    if (sortBy === "views") list.sort((a, b) => b.viewsCount - a.viewsCount);
    else if (sortBy === "likes") list.sort((a, b) => b.likesCount - a.likesCount);
    else if (sortBy === "favs") list.sort((a, b) => b.favoritesCount - a.favoritesCount);
    else if (sortBy === "photos") list.sort((a, b) => b.photoCount - a.photoCount);
    else list.sort((a, b) => b.popularityScore - a.popularityScore);
    return list;
  }, [data?.albums, searchFilter, sortBy]);

  const filteredFestivals = useMemo(() => {
    if (!data?.festivals) return [];
    let list = [...data.festivals];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (f) => f.name.toLowerCase().includes(q) || f.month.toLowerCase().includes(q),
      );
    }
    if (sortBy === "views") list.sort((a, b) => b.totalViews - a.totalViews);
    else if (sortBy === "likes") list.sort((a, b) => b.totalLikes - a.totalLikes);
    else if (sortBy === "favs") list.sort((a, b) => b.totalFavorites - a.totalFavorites);
    else if (sortBy === "photos") list.sort((a, b) => b.imagesCount - a.imagesCount);
    else list.sort((a, b) => b.popularityScore - a.popularityScore);
    return list;
  }, [data?.festivals, searchFilter, sortBy]);

  const filteredYears = useMemo(() => {
    if (!data?.years) return [];
    const list = [...data.years];
    if (sortBy === "views") list.sort((a, b) => b.totalViews - a.totalViews);
    else if (sortBy === "likes") list.sort((a, b) => b.totalLikes - a.totalLikes);
    else if (sortBy === "favs") list.sort((a, b) => b.totalFavorites - a.totalFavorites);
    else if (sortBy === "photos") list.sort((a, b) => b.imagesCount - a.imagesCount);
    else list.sort((a, b) => b.year - a.year);
    return list;
  }, [data?.years, sortBy]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
        <p className="text-sm">កំពុងគណនាស្ថិតិប្រសិទ្ធភាពខ្លឹមសារ (Content Performance)...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive shadow-soft">
        <p className="text-sm font-semibold">មិនអាចទាញយកទិន្នន័យប្រសិទ្ធភាពខ្លឹមសារបានទេ។</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-gold">
            <PartyPopper className="h-4 w-4" />
            <span className="text-xs font-semibold">ពិធីបុណ្យសរុប (Festivals)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.festivalsCount)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ក្នុងប្រព័ន្ធបណ្ណសារដ្ឋាន</p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-semibold">ចំនួនឆ្នាំកត់ត្រា (Years)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.yearsCount)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">ពីឆ្នាំដំបូងរហូតដល់បច្ចុប្បន្ន</p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <FolderKanban className="h-4 w-4" />
            <span className="text-xs font-semibold">កម្រងរូបភាពសរុប (Albums)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.albumsCount)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            មានរូបថត {toKhmerNumber(data.totals.imagesCount)} សន្លឹក
          </p>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card p-4.5 shadow-soft">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Heart className="h-4 w-4 fill-current" />
            <span className="text-xs font-semibold">អន្តរកម្មសរុប (Engagement)</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(data.totals.totalEngagement)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Likes + Favorites</p>
        </div>
      </div>

      {/* Main Tabs and Filter Controls */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
          {/* 3 Entity Tabs */}
          <div className="flex items-center gap-1 rounded-2xl bg-secondary/80 p-1">
            <button
              onClick={() => setActiveTab("festivals")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "festivals"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <PartyPopper className="h-3.5 w-3.5" />
              <span>ពិធីបុណ្យ ({toKhmerNumber(data.festivals.length)})</span>
            </button>
            <button
              onClick={() => setActiveTab("years")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "years"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>ឆ្នាំ ({toKhmerNumber(data.years.length)})</span>
            </button>
            <button
              onClick={() => setActiveTab("albums")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "albums"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Albums ({toKhmerNumber(data.albums.length)})</span>
            </button>
          </div>

          {/* Search and Sort controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ស្វែងរកតាមឈ្មោះ..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8.5 rounded-xl border border-input bg-background pl-8.5 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "score" | "views" | "likes" | "favs" | "photos")
              }
              className="h-8.5 rounded-xl border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="score">តម្រៀបតាម Score ខ្ពស់</option>
              <option value="views">តម្រៀបតាម Views</option>
              <option value="likes">តម្រៀបតាម Likes</option>
              <option value="favs">តម្រៀបតាម Favorites</option>
              <option value="photos">តម្រៀបតាម ចំនួនរូបថត</option>
            </select>
          </div>
        </div>

        {/* Tab 1: Festivals Performance Table */}
        {activeTab === "festivals" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-secondary/30 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">ពិធីបុណ្យ</th>
                  <th className="py-3 px-3">ខែ</th>
                  <th className="py-3 px-3 text-center">Albums</th>
                  <th className="py-3 px-3 text-center">រូបថត</th>
                  <th className="py-3 px-3 text-center">Views</th>
                  <th className="py-3 px-3 text-center">Likes</th>
                  <th className="py-3 px-3 text-center">Favs</th>
                  <th className="py-3 px-3 text-center">Search Clicks</th>
                  <th className="py-3 px-3 text-right">Popularity Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredFestivals.map((fest) => (
                  <tr key={fest.festivalId} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-foreground flex items-center gap-2">
                      <span className="text-base">{fest.emoji}</span>
                      <span>{fest.name}</span>
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground">{fest.month}</td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {toKhmerNumber(fest.albumsCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {toKhmerNumber(fest.imagesCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-blue-600 dark:text-blue-400">
                      {toKhmerNumber(fest.totalViews)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                      {toKhmerNumber(fest.totalLikes)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {toKhmerNumber(fest.totalFavorites)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {toKhmerNumber(fest.searchClicksCount)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-gold">
                      {toKhmerNumber(fest.popularityScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Years Performance Table */}
        {activeTab === "years" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-secondary/30 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">ឆ្នាំកត់ត្រា</th>
                  <th className="py-3 px-3 text-center">Albums</th>
                  <th className="py-3 px-3 text-center">រូបថត</th>
                  <th className="py-3 px-3 text-center">Views</th>
                  <th className="py-3 px-3 text-center">Likes</th>
                  <th className="py-3 px-3 text-center">Favs</th>
                  <th className="py-3 px-3 text-center">Total Engagement</th>
                  <th className="py-3 px-3 text-right">Popularity Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredYears.map((yr) => (
                  <tr key={yr.year} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-foreground font-mono">
                      ឆ្នាំ {toKhmerNumber(yr.year)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {toKhmerNumber(yr.albumsCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {toKhmerNumber(yr.imagesCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-blue-600 dark:text-blue-400">
                      {toKhmerNumber(yr.totalViews)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                      {toKhmerNumber(yr.totalLikes)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {toKhmerNumber(yr.totalFavorites)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {toKhmerNumber(yr.totalEngagement)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-gold">
                      {toKhmerNumber(yr.popularityScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Albums Performance Table */}
        {activeTab === "albums" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-secondary/30 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Album Title</th>
                  <th className="py-3 px-3">ពិធីបុណ្យ</th>
                  <th className="py-3 px-3">ឆ្នាំ</th>
                  <th className="py-3 px-3 text-center">រូបថត</th>
                  <th className="py-3 px-3 text-center">Views</th>
                  <th className="py-3 px-3 text-center">Likes</th>
                  <th className="py-3 px-3 text-center">Favs</th>
                  <th className="py-3 px-3 text-center">Clicks</th>
                  <th className="py-3 px-3 text-right">Score</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredAlbums.slice(0, 100).map((alb) => (
                  <tr key={alb.albumId} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-foreground max-w-xs truncate">
                      {alb.title}
                    </td>
                    <td className="py-3.5 px-3 text-muted-foreground flex items-center gap-1.5">
                      <span>{alb.festivalEmoji}</span>
                      <span>{alb.festivalName}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono">{toKhmerNumber(alb.year)}</td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {toKhmerNumber(alb.photoCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-blue-600 dark:text-blue-400">
                      {toKhmerNumber(alb.viewsCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                      {toKhmerNumber(alb.likesCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {toKhmerNumber(alb.favoritesCount)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {toKhmerNumber(alb.searchClicksCount)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-gold">
                      {toKhmerNumber(alb.popularityScore)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Link
                        to="/album/$albumId"
                        params={{ albumId: alb.albumId }}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 p-1.5 text-muted-foreground hover:text-gold transition-colors"
                        title="មើល Album"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
