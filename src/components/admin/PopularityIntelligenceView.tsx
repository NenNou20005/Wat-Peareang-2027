import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Flame,
  Award,
  Sparkles,
  Eye,
  Heart,
  Bookmark,
  MousePointerClick,
  PartyPopper,
  FolderKanban,
  ImageIcon,
  Calculator,
  ExternalLink,
  Info,
} from "lucide-react";
import { usePopularityIntelligence } from "@/hooks/useSearchAnalytics";
import type { AnalyticsPeriod } from "@/hooks/useAnalyticsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PopularityIntelligenceView({ period }: { period: AnalyticsPeriod }) {
  const { data, isLoading, isError } = usePopularityIntelligence(period);
  const [activeTab, setActiveTab] = useState<"albums" | "images" | "festivals">("albums");

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
        <p className="text-sm">កំពុងគណនាភាពពេញនិយមឆ្លាតវៃ (Popularity Intelligence Engine)...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive shadow-soft">
        <p className="text-sm font-semibold">មិនអាចគណនាទិន្នន័យភាពពេញនិយមបានទេ។</p>
      </div>
    );
  }

  const { weights, topAlbums, topImages, topFestivals } = data;

  return (
    <div className="space-y-6">
      {/* Formula & Weight Model Explanation Card */}
      <div className="rounded-3xl border border-gold/40 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                រូបមន្តគណនាភាពពេញនិយមពហុកត្តា (Multi-Factor Popularity Model)
              </h3>
              <p className="text-xs text-muted-foreground">
                គណនាស្វ័យប្រវត្តិតាមទម្ងន់ជាក់ស្តែងពីទិន្នន័យ PostgreSQL 17
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl bg-secondary/80 px-3.5 py-1.5 text-xs text-foreground font-medium">
            <Info className="h-4 w-4 text-gold" />
            <span>
              សមីការ៖ Score = (Views × 1) + (Likes × 5) + (Favorites × 8) + (Search Clicks × 3)
            </span>
          </div>
        </div>

        {/* 4 Weight Factors Badges */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Eye className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">ការបើកមើល (Views)</p>
                <p className="text-[10px] text-muted-foreground">ចំណាប់អារម្មណ៍ទូទៅ</p>
              </div>
            </div>
            <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-bold text-blue-600 font-mono">
              x{weights.views}
            </span>
          </div>

          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <Heart className="h-4 w-4 fill-current" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">ការចូលចិត្ត (Likes)</p>
                <p className="text-[10px] text-muted-foreground">អន្តរកម្មពេញចិត្ត</p>
              </div>
            </div>
            <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-600 font-mono">
              x{weights.likes}
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Bookmark className="h-4 w-4 fill-current" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">ចំណូលចិត្ត (Favorites)</p>
                <p className="text-[10px] text-muted-foreground">រក្សាទុកក្នុងបណ្ណសារផ្ទាល់</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-600 font-mono">
              x{weights.favorites}
            </span>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <MousePointerClick className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  ចុចពីស្វែងរក (Search Clicks)
                </p>
                <p className="text-[10px] text-muted-foreground">ភាពត្រូវគ្នានឹងតម្រូវការ</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 font-mono">
              x{weights.searchClicks}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table with 3 tabs */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-gold" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                តារាងចំណាត់ថ្នាក់ភាពពេញនិយម (Popularity Leaderboard)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                មាតិកាដែលទទួលបានពិន្ទុពេញនិយមខ្ពស់បំផុតក្នុងបណ្ណសារ
              </p>
            </div>
          </div>

          <div className="flex items-center rounded-xl bg-secondary/50 p-1">
            <button
              onClick={() => setActiveTab("albums")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeTab === "albums"
                  ? "bg-background text-foreground shadow-xs font-semibold text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Albums កំពូល ({toKhmerNumber(topAlbums.length)})
            </button>
            <button
              onClick={() => setActiveTab("images")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeTab === "images"
                  ? "bg-background text-foreground shadow-xs font-semibold text-purple-600 dark:text-purple-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              រូបភាពកំពូល ({toKhmerNumber(topImages.length)})
            </button>
            <button
              onClick={() => setActiveTab("festivals")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeTab === "festivals"
                  ? "bg-background text-foreground shadow-xs font-semibold text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <PartyPopper className="h-3.5 w-3.5" />
              ពិធីបុណ្យកំពូល ({toKhmerNumber(topFestivals.length)})
            </button>
          </div>
        </div>

        {/* Tab 1: Top Albums */}
        {activeTab === "albums" && (
          <div className="overflow-x-auto">
            {topAlbums.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                មិនទាន់មានទិន្នន័យសម្រាប់គណនាពិន្ទុ Albums នៅឡើយទេ។
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="pb-3 pl-2 font-medium">ចំណាត់ថ្នាក់</th>
                    <th className="pb-3 font-medium">កម្រងរូបភាព (Album)</th>
                    <th className="pb-3 text-right font-medium">Views (x1)</th>
                    <th className="pb-3 text-right font-medium">Likes (x5)</th>
                    <th className="pb-3 text-right font-medium">Favs (x8)</th>
                    <th className="pb-3 text-right font-medium">Clicks (x3)</th>
                    <th className="pb-3 text-right font-medium pr-3">ពិន្ទុសរុប (Score)</th>
                    <th className="pb-3 text-center pr-2 font-medium">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {topAlbums.map((alb) => (
                    <tr key={alb.albumId} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pl-2">
                        <span
                          className={cn(
                            "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                            alb.rank === 1
                              ? "bg-amber-500 text-black shadow-xs font-mono"
                              : alb.rank === 2
                                ? "bg-slate-300 text-black font-mono"
                                : alb.rank === 3
                                  ? "bg-amber-700 text-white font-mono"
                                  : "bg-secondary text-muted-foreground font-mono",
                          )}
                        >
                          {alb.rank}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg">{alb.festivalEmoji}</span>
                          <div className="min-w-0">
                            <Link
                              to="/album/$albumId"
                              params={{ albumId: alb.albumId }}
                              className="font-semibold text-foreground hover:text-gold text-sm truncate block max-w-[220px] sm:max-w-[280px]"
                            >
                              {alb.title}
                            </Link>
                            <p className="text-[11px] text-muted-foreground">
                              {alb.festivalName} • ឆ្នាំ {toKhmerNumber(alb.year)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {toKhmerNumber(alb.viewsCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-rose-600 font-medium">
                        {toKhmerNumber(alb.likesCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-amber-600 font-medium">
                        {toKhmerNumber(alb.favoritesCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-emerald-600 font-medium">
                        {toKhmerNumber(alb.searchClicksCount)}
                      </td>
                      <td className="py-3 text-right pr-3">
                        <span className="rounded-full bg-gold/15 px-3 py-1 font-mono text-xs font-bold text-gold inline-flex items-center gap-1">
                          <Flame className="h-3 w-3 fill-current" />
                          {toKhmerNumber(alb.popularityScore)}
                        </span>
                      </td>
                      <td className="py-3 text-center pr-2">
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                          <Link
                            to="/album/$albumId"
                            params={{ albumId: alb.albumId }}
                            target="_blank"
                            title="បើកមើល Album"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Top Photos */}
        {activeTab === "images" && (
          <div className="overflow-x-auto">
            {topImages.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                មិនទាន់មានទិន្នន័យសម្រាប់គណនាពិន្ទុរូបភាពនៅឡើយទេ។
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="pb-3 pl-2 font-medium">ចំណាត់ថ្នាក់</th>
                    <th className="pb-3 font-medium">រូបថត (Photo)</th>
                    <th className="pb-3 text-right font-medium">Views (x1)</th>
                    <th className="pb-3 text-right font-medium">Likes (x5)</th>
                    <th className="pb-3 text-right font-medium">Favs (x8)</th>
                    <th className="pb-3 text-right font-medium">Clicks (x3)</th>
                    <th className="pb-3 text-right font-medium pr-3">ពិន្ទុសរុប (Score)</th>
                    <th className="pb-3 text-center pr-2 font-medium">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {topImages.map((img) => (
                    <tr key={img.imageId} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pl-2">
                        <span
                          className={cn(
                            "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                            img.rank === 1
                              ? "bg-purple-500 text-white shadow-xs font-mono"
                              : img.rank === 2
                                ? "bg-slate-300 text-black font-mono"
                                : img.rank === 3
                                  ? "bg-amber-700 text-white font-mono"
                                  : "bg-secondary text-muted-foreground font-mono",
                          )}
                        >
                          {img.rank}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={img.thumbnailUrl || img.url}
                            alt={img.title}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover border border-border/60"
                            loading="lazy"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate max-w-[200px] sm:max-w-[260px]">
                              {img.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-[260px]">
                              {img.albumTitle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {toKhmerNumber(img.viewsCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-rose-600 font-medium">
                        {toKhmerNumber(img.likesCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-amber-600 font-medium">
                        {toKhmerNumber(img.favoritesCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-emerald-600 font-medium">
                        {toKhmerNumber(img.searchClicksCount)}
                      </td>
                      <td className="py-3 text-right pr-3">
                        <span className="rounded-full bg-purple-500/15 px-3 py-1 font-mono text-xs font-bold text-purple-600 dark:text-purple-400 inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {toKhmerNumber(img.popularityScore)}
                        </span>
                      </td>
                      <td className="py-3 text-center pr-2">
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                          <a href={img.url} target="_blank" rel="noreferrer" title="មើលរូបពេញទំហំ">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Top Festivals */}
        {activeTab === "festivals" && (
          <div className="overflow-x-auto">
            {topFestivals.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                មិនទាន់មានទិន្នន័យសម្រាប់ពិធីបុណ្យនៅឡើយទេ។
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground">
                    <th className="pb-3 pl-2 font-medium">ចំណាត់ថ្នាក់</th>
                    <th className="pb-3 font-medium">ពិធីបុណ្យ (Festival)</th>
                    <th className="pb-3 text-center font-medium">Albums</th>
                    <th className="pb-3 text-right font-medium">Views សរុប (x1)</th>
                    <th className="pb-3 text-right font-medium">Likes សរុប (x5)</th>
                    <th className="pb-3 text-right font-medium">Favs សរុប (x8)</th>
                    <th className="pb-3 text-right font-medium pr-3">ពិន្ទុប្រជាប្រិយភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {topFestivals.map((fest) => (
                    <tr key={fest.festivalId} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pl-2">
                        <span
                          className={cn(
                            "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                            fest.rank === 1
                              ? "bg-amber-500 text-black shadow-xs font-mono"
                              : fest.rank === 2
                                ? "bg-slate-300 text-black font-mono"
                                : fest.rank === 3
                                  ? "bg-amber-700 text-white font-mono"
                                  : "bg-secondary text-muted-foreground font-mono",
                          )}
                        >
                          {fest.rank}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="grid h-8 w-8 place-items-center rounded-xl text-base"
                            style={{ backgroundColor: fest.accent + "25" }}
                          >
                            {fest.emoji}
                          </span>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{fest.name}</p>
                            <p className="text-[11px] text-muted-foreground">{fest.month}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center font-mono font-medium text-foreground">
                        {toKhmerNumber(fest.albumsCount)}
                      </td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {toKhmerNumber(fest.totalViews)}
                      </td>
                      <td className="py-3 text-right font-mono text-rose-600 font-medium">
                        {toKhmerNumber(fest.totalLikes)}
                      </td>
                      <td className="py-3 text-right font-mono text-amber-600 font-medium">
                        {toKhmerNumber(fest.totalFavorites)}
                      </td>
                      <td className="py-3 text-right pr-3">
                        <span className="rounded-full bg-gold/15 px-3 py-1 font-mono text-xs font-bold text-gold inline-flex items-center gap-1">
                          <PartyPopper className="h-3 w-3" />
                          {toKhmerNumber(fest.popularityScore)}
                        </span>
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
