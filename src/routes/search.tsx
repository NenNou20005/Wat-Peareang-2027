import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { Search as SearchIcon, TrendingUp, Sparkles, AlertCircle, Film, Images } from "lucide-react";
import { AlbumGrid } from "@/components/site/YearSection";
import { toKhmerNumber, type Album } from "@/data/archive";
import { useSearchArchive, useSearchVideos } from "@/hooks/useArchiveData";
import { useTrendingSearches } from "@/hooks/useSearchAnalytics";
import { trackSearch, trackSearchClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "ស្វែងរក — បណ្ណសារបុណ្យខ្មែរ" },
      {
        name: "description",
        content: "ស្វែងរក Album និងវីដេអូបុណ្យខ្មែរតាមឈ្មោះបុណ្យ ឆ្នាំ ឬទីកន្លែង។",
      },
      { property: "og:title", content: "ស្វែងរកបណ្ណសារបុណ្យខ្មែរ" },
      { property: "og:description", content: "ស្វែងរកបុណ្យ ឆ្នាំ ទីកន្លែង Album ឬវីដេអូ។" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [term, setTerm] = useState(q);
  const [searchTab, setSearchTab] = useState<"albums" | "videos">("albums");
  const { data: results = [], isLoading } = useSearchArchive(q);
  const { data: videoResults = [] } = useSearchVideos(q);
  const { data: trendingSuggestions = [] } = useTrendingSearches(8);
  const trackedRef = useRef<string>("");

  // Sync input value and active tab when route query changes
  useEffect(() => {
    setTerm(q);
    if (results.length === 0 && videoResults.length > 0) {
      setSearchTab("videos");
    } else {
      setSearchTab("albums");
    }
  }, [q, results.length, videoResults.length]);

  // Track search query execution once search completes
  useEffect(() => {
    if (q && !isLoading) {
      const trackKey = `${q}:${results.length}`;
      if (trackedRef.current !== trackKey) {
        trackedRef.current = trackKey;
        trackSearch(q, results.length);
      }
    }
  }, [q, results.length, isLoading]);

  const handleSelectAlbum = (album: Album) => {
    if (q) {
      trackSearchClick(q, album.id, "album");
    }
  };

  const handleTrendingClick = (suggestedQuery: string) => {
    setTerm(suggestedQuery);
    navigate({ search: { q: suggestedQuery } });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display flex items-center gap-3">
          <span>🔍</span> ស្វែងរកបណ្ណសារ
        </h1>
        <p className="text-sm text-muted-foreground">
          ស្វែងរកតាមឈ្មោះពិធីបុណ្យ ឆ្នាំ (ឧ. ២០២៤ ឬ 2024) ទីតាំងវត្ត ឬកម្រងរូបភាព និងវីដេអូ
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { q: term.trim() } });
        }}
        className="mt-6 flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3.5 shadow-soft transition-all focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/20"
      >
        <SearchIcon className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ស្វែងរកបុណ្យ ឆ្នាំ ទីកន្លែង ឬ Album (ឧ. ភ្ជុំបិណ្ឌ, ២០២៤)..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground font-medium transition-colors hover:bg-primary/90 cursor-pointer"
        >
          ស្វែងរក
        </button>
      </form>

      {/* Trending Search Suggestions */}
      {trendingSuggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-gold" /> ពាក្យពេញនិយម៖
          </span>
          {trendingSuggestions.map((item) => (
            <button
              key={item.query}
              type="button"
              onClick={() => handleTrendingClick(item.query)}
              className="rounded-full border border-border/80 bg-secondary/50 px-3 py-1 text-xs text-secondary-foreground transition-colors hover:border-gold/50 hover:bg-gold-soft/40 cursor-pointer"
            >
              {item.query}
            </button>
          ))}
        </div>
      )}

      {q ? (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
            <p className="text-sm text-muted-foreground">
              រកឃើញ{" "}
              <span className="font-semibold text-foreground">{toKhmerNumber(results.length)}</span>{" "}
              Albums
              {videoResults.length > 0 && (
                <>
                  {" "}និង{" "}
                  <span className="font-semibold text-foreground">{toKhmerNumber(videoResults.length)}</span>{" "}
                  វីដេអូ
                </>
              )}{" "}
              សម្រាប់ “<span className="font-medium text-gold">{q}</span>”
            </p>
            {(results.length > 0 || videoResults.length > 0) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-gold" /> លទ្ធផលត្រូវគ្នាល្អបំផុត
              </span>
            )}
          </div>

          {/* Switcher Tabs when video results exist */}
          {videoResults.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchTab("albums")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium cursor-pointer transition-all",
                  searchTab === "albums"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/70 text-secondary-foreground hover:bg-secondary",
                )}
              >
                <Images className="h-3.5 w-3.5" /> Albums ({toKhmerNumber(results.length)})
              </button>
              <button
                type="button"
                onClick={() => setSearchTab("videos")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium cursor-pointer transition-all",
                  searchTab === "videos"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/70 text-secondary-foreground hover:bg-secondary",
                )}
              >
                <Film className="h-3.5 w-3.5" /> វីដេអូ ({toKhmerNumber(videoResults.length)})
              </button>
            </div>
          )}

          {/* Tab Content: Albums */}
          {searchTab === "albums" && (
            <>
              {results.length > 0 ? (
                <div className="mt-6">
                  <AlbumGrid items={results} onSelectAlbum={handleSelectAlbum} />
                </div>
              ) : videoResults.length === 0 ? null : (
                <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  មិនមាន Albums ត្រូវគ្នានឹង “{q}” ទេ។ សូមពិនិត្យមើលផ្ទាំង «វីដេអូ» ខាងលើ។
                </div>
              )}
            </>
          )}

          {/* Tab Content: Videos */}
          {searchTab === "videos" && (
            <>
              {videoResults.length > 0 ? (
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {videoResults.map((v) => (
                    <div
                      key={v.id}
                      className="group flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card p-3 shadow-soft transition-all hover:shadow-card"
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                        <video
                          controls
                          preload="metadata"
                          playsInline
                          poster={v.thumbnailUrl || undefined}
                          src={v.url}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="mt-3 flex flex-1 flex-col justify-between space-y-2 px-1">
                        <div>
                          <h4 className="font-medium text-foreground text-sm line-clamp-2" title={v.title}>
                            {v.title}
                          </h4>
                          {v.albumTitle && (
                            <Link
                              to="/album/$albumId"
                              params={{ albumId: v.albumId }}
                              className="text-xs text-primary hover:underline truncate mt-1 inline-block"
                            >
                              📁 {v.albumTitle} {v.year ? `(${toKhmerNumber(v.year)})` : ""}
                            </Link>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                          {v.duration && v.duration > 0 ? (
                            <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                              ⏱️ {Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, "0")}
                            </span>
                          ) : null}
                          {v.width && v.height ? (
                            <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                              📐 {v.width}×{v.height}
                            </span>
                          ) : null}
                          {v.size && v.size > 0 ? (
                            <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                              📦 {(v.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  មិនមានវីដេអូត្រូវគ្នានឹង “{q}” ទេ។
                </div>
              )}
            </>
          )}

          {/* Empty State when both are 0 */}
          {results.length === 0 && videoResults.length === 0 && (
            <div className="mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-2xl text-gold">
                <AlertCircle className="h-7 w-7 text-gold" />
              </div>
              <h3 className="mt-4 text-lg font-medium text-foreground">
                មិនមានលទ្ធផលសម្រាប់ “{q}” នោះទេ
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                សូមពិនិត្យអក្ខរាវិរុទ្ធ ឬសាកល្បងស្វែងរកជាមួយពាក្យគន្លឹះទូទៅដូចជា ឈ្មោះពិធីបុណ្យ (ឧ.
                ភ្ជុំបិណ្ឌ, កឋិន) ឬឆ្នាំ (ឧ. ២០២៤)។
              </p>
              {trendingSuggestions.length > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {trendingSuggestions.slice(0, 4).map((s) => (
                    <button
                      key={s.query}
                      type="button"
                      onClick={() => handleTrendingClick(s.query)}
                      className="rounded-full border border-gold/40 bg-gold-soft/30 px-3.5 py-1.5 text-xs text-foreground hover:bg-gold-soft transition-colors"
                    >
                      🔍 {s.query}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-12 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <span className="text-4xl">🏛️</span>
          <h3 className="mt-4 text-base font-medium text-foreground">
            ស្វែងរកកម្រងរូបភាព និងពិធីបុណ្យវត្តពារាណ
          </h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            បញ្ចូលឈ្មោះពិធីបុណ្យ ឆ្នាំ ឬទីកន្លែងនៅក្នុងប្រអប់ខាងលើ
            ដើម្បីស្វែងរកកម្រងរូបភាពក្នុងបណ្ណសារ។
          </p>
        </div>
      )}
    </div>
  );
}
