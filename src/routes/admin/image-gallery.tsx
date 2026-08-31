import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Search,
  RefreshCw,
  X,
  Upload,
  ArrowRight,
  ArrowLeft,
  Images,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbox, type LightboxPhoto } from "@/components/site/Lightbox";
import {
  useAdminFestivals,
  useAdminYears,
  useAdminAlbums,
  useAdminImages,
} from "@/hooks/useAdminData";
import { useAlbum, useAlbumPhotos } from "@/hooks/useArchiveData";
import { toKhmerNumber } from "@/data/archive";
import { resolveImageUrl } from "@/lib/asset-resolver";

type ImageGallerySearch = {
  festivalId?: string | undefined;
  year?: string | number | undefined;
  albumId?: string | undefined;
  search?: string | undefined;
};

export const Route = createFileRoute("/admin/image-gallery")({
  validateSearch: (search: Record<string, unknown>): ImageGallerySearch => ({
    festivalId: typeof search["festivalId"] === "string" ? search["festivalId"] : undefined,
    year:
      typeof search["year"] === "string" || typeof search["year"] === "number"
        ? search["year"]
        : undefined,
    albumId: typeof search["albumId"] === "string" ? search["albumId"] : undefined,
    search: typeof search["search"] === "string" ? search["search"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "វិចិត្រសាលរូបភាព — Wat Peareang Admin" }],
  }),
  component: AdminImageGalleryPage,
});

function AdminImageGalleryPage() {
  const routeSearch = Route.useSearch();

  // Filters State
  const [search, setSearch] = useState(routeSearch.search || "");
  const [selectedFestival, setSelectedFestival] = useState<string>(routeSearch.festivalId || "all");
  const [selectedYear, setSelectedYear] = useState<string>(
    routeSearch.year ? String(routeSearch.year) : "all",
  );
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(
    routeSearch.albumId || null,
  );

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Queries for Filter Bar
  const { data: festivals = [] } = useAdminFestivals();
  const { data: years = [] } = useAdminYears();

  // Query 1: Matching Albums from Admin
  const {
    data: albumsData,
    isLoading: isAlbumsLoading,
    isError: isAlbumsError,
    refetch: refetchAlbums,
  } = useAdminAlbums({
    year: selectedYear !== "all" ? Number(selectedYear) : undefined,
    festivalId: selectedFestival !== "all" ? selectedFestival : undefined,
    search: search.trim() || undefined,
    limit: 500,
  });

  const albums = useMemo(() => albumsData?.albums || [], [albumsData?.albums]);

  // Query 2: Active Album & Photos (when inside an Album)
  const { data: activeAlbum } = useAlbum(selectedAlbumId || "");
  const {
    data: albumPhotos = [],
    isLoading: isPhotosLoading,
    isError: isPhotosError,
    refetch: refetchPhotos,
  } = useAlbumPhotos(selectedAlbumId || "");

  // Active filter objects
  const activeFestivalObj = festivals.find((f) => f.id === selectedFestival);
  const isFilterActive =
    selectedFestival !== "all" || selectedYear !== "all" || search.trim().length > 0;

  // Map album photos for Lightbox
  const lightboxPhotos: LightboxPhoto[] = useMemo(() => {
    return albumPhotos.map((p) => ({
      id: p.id,
      src: resolveImageUrl(p.src),
      caption: p.caption || activeAlbum?.title || "រូបភាពបណ្ណសារវត្តពារាំង",
    }));
  }, [albumPhotos, activeAlbum]);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedFestival("all");
    setSelectedYear("all");
    setSelectedAlbumId(null);
  };

  const handleSelectAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToAlbums = () => {
    setSelectedAlbumId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AdminLayout requiredPermission="view_images">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-0.5 text-xs font-semibold text-gold">
                🖼️ វិចិត្រសាលរូបភាព
              </span>
              {!selectedAlbumId && (
                <span className="font-mono text-xs text-muted-foreground">
                  រកឃើញ {toKhmerNumber(albums.length)} Albums
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {selectedAlbumId && activeAlbum
                ? activeAlbum.title
                : "វិចិត្រសាលរូបភាពបណ្ណសារវត្តពារាំង"}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {selectedAlbumId && activeAlbum
                ? `ពិធីបុណ្យ ${activeAlbum.festival?.name || ""} ឆ្នាំ ${toKhmerNumber(activeAlbum.year)} · រូបភាពសរុប ${toKhmerNumber(albumPhotos.length || activeAlbum.photoCount)} រូប`
                : "ជ្រើសរើស ឆ្នាំ និង ពិធីបុណ្យ ដើម្បីស្វែងរក Albums រួចចុចចូលមើលរូបភាពខាងក្នុង Album នីមួយៗ។"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedAlbumId ? (
              <Button
                onClick={handleBackToAlbums}
                variant="outline"
                className="rounded-full border-gold text-foreground hover:bg-gold/10 text-xs shadow-soft"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5 text-gold" /> ← ត្រឡប់ទៅ Albums
              </Button>
            ) : (
              <Button asChild variant="outline" className="rounded-full text-xs">
                <Link to="/admin/images">
                  <Upload className="mr-1.5 h-3.5 w-3.5 text-gold" /> គ្រប់គ្រងរូបភាព & Upload
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Primary Filters (Search, Festival, Year) — on Album listing view */}
        {!selectedAlbumId && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ស្វែងរកតាមចំណងជើង Album..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-2xl bg-card pl-10 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Festival Filter */}
              <select
                value={selectedFestival}
                onChange={(e) => setSelectedFestival(e.target.value)}
                className="h-10 rounded-2xl border border-border bg-card px-3 text-xs text-foreground shadow-sm"
              >
                <option value="all">🎉 គ្រប់ពិធីបុណ្យទាំងអស់</option>
                {festivals.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.emoji} {f.name}
                  </option>
                ))}
              </select>

              {/* Year Filter */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-10 rounded-2xl border border-border bg-card px-3 text-xs text-foreground shadow-sm"
              >
                <option value="all">📅 គ្រប់ឆ្នាំទាំងអស់</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    ឆ្នាំ {y} ({toKhmerNumber(y)})
                  </option>
                ))}
              </select>
            </div>

            {/* Active Selection Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">📍 កំពុងបង្ហាញ Albums នៃ៖</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
                  {activeFestivalObj
                    ? `${activeFestivalObj.emoji} ${activeFestivalObj.name}`
                    : "🎉 គ្រប់ពិធីបុណ្យ"}
                </span>
                <span className="text-muted-foreground">➔</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
                  {selectedYear !== "all"
                    ? `📅 ឆ្នាំ ${selectedYear} (${toKhmerNumber(Number(selectedYear))})`
                    : "📅 គ្រប់ឆ្នាំ"}
                </span>
                {search && (
                  <>
                    <span className="text-muted-foreground">➔</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 font-medium text-gold">
                      🔍 «{search}»
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-gold">
                  📁 រកឃើញ៖ {toKhmerNumber(albums.length)} Albums
                </span>
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ជម្រះការច្រោះ
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Breadcrumb Navigation when inside an Album */}
        {selectedAlbumId && activeAlbum && (
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <button onClick={handleBackToAlbums} className="hover:text-gold transition-colors">
              🖼️ វិចិត្រសាល
            </button>
            <span>➔</span>
            <span>ឆ្នាំ {toKhmerNumber(activeAlbum.year)}</span>
            <span>➔</span>
            <span>{activeAlbum.festival?.name}</span>
            <span>➔</span>
            <span className="text-foreground font-semibold">{activeAlbum.title}</span>
          </div>
        )}

        {/* VIEW 1: ALBUMS LISTING */}
        {!selectedAlbumId ? (
          <>
            {isAlbumsLoading ? (
              <div className="py-20 text-center text-xs text-muted-foreground">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
                កំពុងទាញយក Albums ពីបណ្ណសារ...
              </div>
            ) : isAlbumsError ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-destructive">
                  មានបញ្ហាក្នុងការទាញយក Albums។
                </p>
                <Button
                  onClick={() => refetchAlbums()}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  ព្យាយាមម្តងទៀត
                </Button>
              </div>
            ) : albums.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center space-y-4 shadow-soft">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-xl">
                  📁
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-foreground">
                    រកមិនឃើញ Album ដែលត្រូវនឹងការជ្រើសរើសឡើយ។
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    សូមសាកល្បងជ្រើសរើសឆ្នាំ ឬពិធីបុណ្យផ្សេងទៀត ឬជម្រះពាក្យស្វែងរក។
                  </p>
                </div>
                {isFilterActive && (
                  <Button
                    onClick={handleResetFilters}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                  >
                    ជម្រះការច្រោះទាំងអស់ (Show All Albums)
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {albums.map((album) => (
                  <article
                    key={album.id}
                    onClick={() => handleSelectAlbum(album.id)}
                    className="group cursor-pointer overflow-hidden rounded-3xl border border-border/80 bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card flex flex-col justify-between"
                  >
                    {/* Album Cover */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                      <img
                        src={resolveImageUrl(album.coverImage, album.festivalId)}
                        alt={album.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Year badge */}
                      <span className="absolute right-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
                        ឆ្នាំ {toKhmerNumber(album.year)}
                      </span>

                      {/* Festival Name on cover */}
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white drop-shadow">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs bg-gold/40">
                            {album.festival?.emoji || "🎉"}
                          </span>
                          <span className="truncate">{album.festival?.name || album.title}</span>
                        </h3>
                      </div>
                    </div>

                    {/* Album Metadata & Action */}
                    <div className="space-y-3 p-4">
                      <div className="space-y-1">
                        <p className="font-semibold text-xs text-foreground group-hover:text-gold transition-colors truncate">
                          {album.title}
                        </p>
                        {album.description && (
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">
                            {album.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/50 pt-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                          <Images className="h-3.5 w-3.5 text-gold" />{" "}
                          {toKhmerNumber(album.photoCount)} រូប
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold group-hover:translate-x-0.5 transition-transform">
                          ចូលមើល Album <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          /* VIEW 2: ALBUM PHOTOS (Inside Selected Album) */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button
                onClick={handleBackToAlbums}
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-9 px-4 shadow-sm"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5 text-gold" /> ← ត្រឡប់ទៅបញ្ជី Albums
              </Button>

              <span className="text-xs font-semibold text-muted-foreground font-mono">
                📸 រូបភាពសរុប {toKhmerNumber(albumPhotos.length)} រូបក្នុង Album នេះ
              </span>
            </div>

            {isPhotosLoading ? (
              <div className="py-20 text-center text-xs text-muted-foreground">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
                កំពុងទាញយករូបភាពក្នុង Album...
              </div>
            ) : isPhotosError ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
                <p className="text-sm font-semibold text-destructive">
                  មានបញ្ហាក្នុងការទាញយករូបភាពក្នុង Album នេះ។
                </p>
                <Button
                  onClick={() => refetchPhotos()}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  ព្យាយាមម្តងទៀត
                </Button>
              </div>
            ) : albumPhotos.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center space-y-4 shadow-soft">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-xl">
                  🖼️
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-foreground">
                    មិនទាន់មានរូបភាពក្នុង Album នេះនៅឡើយទេ។
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Album នេះត្រូវបានបង្កើតរួចរាល់ ប៉ុន្តែមិនទាន់មានការបង្ហោះរូបភាពចូលនៅឡើយ។
                  </p>
                </div>
                <Button
                  onClick={handleBackToAlbums}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  ← ត្រឡប់ទៅ Albums ផ្សេងទៀត
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-4">
                {albumPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 flex flex-col justify-between"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square w-full overflow-hidden bg-secondary">
                      <img
                        src={resolveImageUrl(photo.thumbnailUrl || photo.src)}
                        alt={photo.caption}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = resolveImageUrl(null);
                        }}
                      />
                    </div>

                    {/* Caption & Metadata */}
                    <div className="p-2.5 space-y-1">
                      <p
                        className="truncate text-xs font-semibold text-foreground group-hover:text-gold transition-colors"
                        title={photo.caption}
                      >
                        {photo.caption || "រូបភាពបណ្ណសារវត្តពារាំង"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="truncate">{photo.photographer || "វត្តពារាំង"}</span>
                        {photo.dateTaken && <span>{photo.dateTaken}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lightbox Reusable Viewer */}
        <Lightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={(i) => setLightboxIndex(i)}
        />
      </div>
    </AdminLayout>
  );
}
