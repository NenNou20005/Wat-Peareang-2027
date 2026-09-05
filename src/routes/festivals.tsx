import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Sparkles,
  ChevronDown,
  Camera,
  FolderKanban,
  ArrowRight,
  LayoutGrid,
  ArrowLeft,
  Calendar,
  MapPin,
  Images,
  Plus,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { toKhmerNumber, type Festival } from "@/data/archive";
import { cn } from "@/lib/utils";
import { useFestivals, useYears, useAlbums } from "@/hooks/useArchiveData";
import { useCreateAlbum } from "@/hooks/useAdminData";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/festivals")({
  head: () => ({
    meta: [
      { title: "តាមពិធីបុណ្យខ្មែរ — បណ្ណសារប្រពៃណីវត្តពារាំង" },
      {
        name: "description",
        content:
          "រុករកបណ្ណសាររូបភាពតាមប្រភេទបុណ្យជាតិខ្មែរ និងឆ្នាំនីមួយៗ៖ Year → Festival → Albums → Photos។",
      },
      { property: "og:title", content: "តាមពិធីបុណ្យខ្មែរ — វត្តពារាំង" },
      {
        property: "og:description",
        content: "រុករកបណ្ណសាររូបភាពប្រពៃណីវត្តពារាំង តាមបុណ្យ និងឆ្នាំនីមួយៗ។",
      },
    ],
  }),
  component: FestivalsPage,
});

function FestivalsPage() {
  const { data: festivals = [], isLoading: loadingFestivals } = useFestivals();
  const { data: years = [], isLoading: loadingYears } = useYears();
  const { data: allAlbums = [] } = useAlbums();

  // View mode: "detail" (showing specific festival hierarchy) or "overview" (showing all festival cards)
  const [viewMode, setViewMode] = useState<"detail" | "overview">("detail");
  const [activeFestivalId, setActiveFestivalId] = useState<string>("chaul-chnam");
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Active festival object
  const activeFestival = useMemo(() => {
    return (
      festivals.find((f) => f.id === activeFestivalId) ||
      festivals[0] || {
        id: "chaul-chnam",
        name: "បុណ្យចូលឆ្នាំខ្មែរ",
        emoji: "🎉",
        accent: "#D4AF37",
        month: "មេសា",
        cover: "",
      }
    );
  }, [festivals, activeFestivalId]);

  // Query ONLY albums belonging to this specific Festival AND Year from PostgreSQL
  const { data: festivalYearAlbums = [], isLoading: loadingAlbums } = useAlbums({
    festivalId: activeFestival.id,
    year: selectedYear,
  });

  // Strict isolation filter: guarantees only albums matching both festival AND year are shown
  const displayedAlbums = useMemo(() => {
    return festivalYearAlbums.filter((album) => {
      const matchFestival = album.festivalId === activeFestival.id;
      const matchYear = album.year === selectedYear;
      return matchFestival && matchYear;
    });
  }, [festivalYearAlbums, activeFestival.id, selectedYear]);

  // Albums for active festival across all years (for header counts)
  const allFestivalAlbums = useMemo(() => {
    return allAlbums.filter((a) => a.festivalId === activeFestival.id);
  }, [allAlbums, activeFestival.id]);

  const totalPhotos = useMemo(() => {
    return allFestivalAlbums.reduce((sum, a) => sum + (a.photoCount || 0), 0);
  }, [allFestivalAlbums]);

  const handleSelectFestival = (festId: string) => {
    setActiveFestivalId(festId);
    setViewMode("detail");
  };

  // Add Album Modal State
  const { isAuthenticated, isSuperAdmin, isAdmin, hasPermission } = useAuth();
  const canManageAlbums = isAuthenticated && (isSuperAdmin || isAdmin || hasPermission("manage_albums"));

  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumLocation, setNewAlbumLocation] = useState("វត្តពារាំង");
  const [newAlbumDescription, setNewAlbumDescription] = useState("");
  const [newAlbumCover, setNewAlbumCover] = useState("");

  const createAlbumMutation = useCreateAlbum();

  const handleCreateAlbumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFestival || !newAlbumTitle.trim()) {
      toast.error("សូមបញ្ចូលចំណងជើង Album!");
      return;
    }

    try {
      await createAlbumMutation.mutateAsync({
        festivalId: activeFestival.id,
        year: selectedYear,
        title: newAlbumTitle.trim(),
        location: newAlbumLocation.trim() || "វត្តពារាំង",
        description: newAlbumDescription.trim() || undefined,
        coverImage: newAlbumCover.trim() || undefined,
      });

      toast.success(
        `បានបន្ថែម Album «${newAlbumTitle.trim()}» ទៅ ${activeFestival.name} ឆ្នាំ ${toKhmerNumber(selectedYear)} រួចរាល់!`,
      );
      setIsAddAlbumOpen(false);
      setNewAlbumTitle("");
      setNewAlbumDescription("");
      setNewAlbumCover("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបង្កើត Album។";
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto max-w-[1340px] px-4 py-8 lg:px-8 space-y-8">
      {/* 1. TOP BREADCRUMB & SWITCHER HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="space-y-1">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-gold transition-colors">
              ទំព័រដើម
            </Link>
            <span>/</span>
            {viewMode === "detail" ? (
              <>
                <button
                  type="button"
                  onClick={() => setViewMode("overview")}
                  className="hover:text-gold transition-colors cursor-pointer"
                >
                  តាមពិធីបុណ្យ
                </button>
                <span>/</span>
                <span className="font-bold text-foreground">{activeFestival.name}</span>
              </>
            ) : (
              <span className="font-bold text-foreground">ពិធីបុណ្យទាំងអស់</span>
            )}
          </nav>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {viewMode === "detail" ? activeFestival.name : "🎉 ពិធីបុណ្យប្រពៃណីជាតិខ្មែរ"}
          </h1>
        </div>

        {/* View Mode Toggle Button */}
        <div className="flex items-center gap-2">
          {viewMode === "detail" ? (
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary hover:border-gold/40 transition-all cursor-pointer shadow-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-gold" />
              <span>មើលបុណ្យទាំងអស់ ({toKhmerNumber(festivals.length)})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode("detail")}
              className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold/15 px-4 py-2 text-xs font-bold text-gold-foreground hover:bg-gold/25 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-gold" />
              <span>ត្រឡប់ទៅបណ្ណសារ ៖ {activeFestival.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FESTIVAL OVERVIEW LISTING (When in 'overview' mode) */}
      {viewMode === "overview" && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          <p className="text-sm text-muted-foreground">
            ជ្រើសរើសពិធីបុណ្យណាមួយ ដើម្បីចូលទៅកាន់រចនាសម្ព័ន្ធបណ្ណសាររូបភាព (ឆ្នាំ → បុណ្យ → Albums → Photos)៖
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {festivals.map((f) => {
              const albumsOfFest = allAlbums.filter((a) => a.festivalId === f.id);
              const photosOfFest = albumsOfFest.reduce((sum, a) => sum + (a.photoCount || 0), 0);

              return (
                <article
                  key={f.id}
                  onClick={() => handleSelectFestival(f.id)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-card-hover"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-secondary mb-4">
                    {f.cover ? (
                      <>
                        {/* Ambient Blurred Backdrop for Portrait/Irregular Covers */}
                        <img
                          src={f.cover}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full object-cover blur-md scale-110 opacity-35 dark:opacity-25 pointer-events-none"
                        />
                        {/* Uncropped Contained Cover */}
                        <img
                          src={f.cover}
                          alt={f.name}
                          className="relative z-[1] h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                        />
                      </>
                    ) : (
                      <div className="grid h-full w-full place-items-center text-4xl">
                        {f.emoji}
                      </div>
                    )}
                    <div className="absolute inset-0 z-[2] bg-linear-to-t from-black/60 via-transparent to-transparent" />
                    <span
                      className="absolute left-3 top-3 z-[3] grid h-9 w-9 place-items-center rounded-xl text-lg shadow-sm"
                      style={{ backgroundColor: f.accent }}
                    >
                      {f.emoji}
                    </span>
                    <span className="absolute bottom-2.5 right-3 z-[3] rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                      {f.month}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-foreground group-hover:text-gold transition-colors">
                    {f.name}
                  </h3>

                  <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <FolderKanban className="h-3.5 w-3.5 text-primary" />
                      {toKhmerNumber(albumsOfFest.length)} Albums
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Images className="h-3.5 w-3.5 text-muted-foreground" />
                      {toKhmerNumber(photosOfFest)} រូបភាព
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. FESTIVAL DETAIL VIEW: Festival Header -> Year Selector -> Horizontal Albums Row */}
      {viewMode === "detail" && (
        <div className="space-y-8 animate-in fade-in-50 duration-300">
          {/* HERO BANNER FOR ACTIVE FESTIVAL */}
          <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card">
            <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-secondary">
              {activeFestival.cover ? (
                <>
                  {/* Ambient Backdrop */}
                  <img
                    src={activeFestival.cover}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-lg scale-110 opacity-35 dark:opacity-25 pointer-events-none"
                  />
                  {/* Contained Hero Image */}
                  <img
                    src={activeFestival.cover}
                    alt={activeFestival.name}
                    className="relative z-[1] h-full w-full object-contain"
                  />
                </>
              ) : (
                <div className="grid h-full w-full place-items-center bg-secondary text-6xl">
                  {activeFestival.emoji}
                </div>
              )}
              <div className="absolute inset-0 z-[2] bg-linear-to-t from-black/85 via-black/40 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 z-[3] p-6 sm:p-8 text-white space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-2xl text-xl shadow-md"
                    style={{ backgroundColor: activeFestival.accent }}
                  >
                    {activeFestival.emoji}
                  </span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-xs">
                    រៀងរាល់ខែ {activeFestival.month}
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight drop-shadow-md">
                    {activeFestival.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/80 max-w-2xl mt-1">
                    បណ្ណសារប្រវត្តិសាស្ត្រ និងរូបភាពអនុស្សាវរីយ៍ពិធីបុណ្យវត្តពារាំង តាមឆ្នាំ និងកម្រងរូបភាព Albums
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs sm:text-sm text-white/90">
                  <span className="inline-flex items-center gap-1.5">
                    <FolderKanban className="h-4 w-4 text-gold" />
                    {toKhmerNumber(allFestivalAlbums.length)} Albums សរុប
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Images className="h-4 w-4 text-gold" />
                    {toKhmerNumber(totalPhotos)} រូបភាពសរុប
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-gold" />
                    វត្តពារាំង
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* FESTIVAL QUICK SELECTOR PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-border/60">
            <span className="text-xs font-bold text-muted-foreground shrink-0 flex items-center gap-1.5 mr-1">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> ប្តូរបុណ្យ៖
            </span>
            {festivals.map((f) => {
              const active = f.id === activeFestival.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectFestival(f.id)}
                  style={active ? { backgroundColor: f.accent, borderColor: f.accent } : undefined}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-all cursor-pointer select-none",
                    active
                      ? "text-primary-foreground font-bold shadow-xs"
                      : "border-border bg-card hover:bg-secondary text-foreground",
                  )}
                >
                  {f.emoji} {f.name.replace("បុណ្យ", "")}
                </button>
              );
            })}
          </div>

          {/* YEAR SELECTOR BAR */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center">
            <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-foreground">
              <Calendar className="h-4 w-4 text-gold" /> ជ្រើសរើសឆ្នាំ ៖
            </span>
            <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all cursor-pointer select-none",
                    selectedYear === y
                      ? "border-gold bg-gold text-gold-foreground shadow-xs font-bold"
                      : "border-border bg-background hover:bg-secondary text-foreground",
                  )}
                >
                  ឆ្នាំ {toKhmerNumber(y)}
                </button>
              ))}
            </div>
          </div>

          {/* COMPACT ALBUMS ROW FOR SELECTED FESTIVAL + YEAR */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="text-base">{activeFestival.emoji}</span>
                <span>{activeFestival.name}</span>
                <span className="text-muted-foreground font-normal">
                  — ឆ្នាំ {toKhmerNumber(selectedYear)}
                </span>
                <span className="text-xs font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                  {toKhmerNumber(displayedAlbums.length)} Albums
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                ចុចលើ Album ដើម្បីមើលរូបភាព និង Lightbox
              </span>
            </div>

            {loadingAlbums ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-28 sm:w-32 h-28 shrink-0 rounded-xl border border-border bg-muted/40 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 px-0.5">
                {displayedAlbums.length === 0 ? (
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl border border-dashed border-border bg-card/40 text-xs text-muted-foreground">
                    <span>
                      មិនទាន់មាន Album សម្រាប់ «{activeFestival.name}» ក្នុងឆ្នាំ {toKhmerNumber(selectedYear)} នៅឡើយទេ។
                    </span>
                  </div>
                ) : (
                  displayedAlbums.map((alb) => (
                    <Link
                      key={alb.id}
                      to="/album/$albumId"
                      params={{ albumId: alb.id }}
                      className="group relative flex flex-col w-28 sm:w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-card cursor-pointer"
                    >
                      {/* Cover Thumbnail */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/80">
                        {/* Ambient Backdrop */}
                        <img
                          src={alb.coverImage || activeFestival.cover}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full object-cover blur-md scale-110 opacity-35 dark:opacity-25 pointer-events-none"
                        />
                        {/* Uncropped Cover */}
                        <img
                          src={alb.coverImage || activeFestival.cover}
                          alt={alb.title}
                          loading="lazy"
                          className="relative z-[1] h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-25 transition-opacity" />
                        <span className="absolute bottom-1 right-1 z-[3] rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs flex items-center gap-0.5">
                          <Camera className="h-2 w-2" />
                          {toKhmerNumber(alb.photoCount || 0)}
                        </span>
                      </div>

                      {/* Title */}
                      <div className="p-1.5 pt-1.5 pb-2">
                        <h4 className="text-[11px] sm:text-xs font-semibold text-foreground truncate group-hover:text-gold transition-colors leading-tight">
                          {alb.title}
                        </h4>
                      </div>
                    </Link>
                  ))
                )}

                {/* [+ បន្ថែម Album] Action Card */}
                {canManageAlbums && (
                  <button
                    type="button"
                    onClick={() => setIsAddAlbumOpen(true)}
                    className="group flex flex-col items-center justify-center w-28 sm:w-32 shrink-0 aspect-[4/3.4] rounded-xl border-2 border-dashed border-gold/40 bg-gold/5 hover:bg-gold/10 hover:border-gold transition-all duration-200 cursor-pointer p-2 text-center"
                  >
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-gold/20 text-gold group-hover:scale-110 transition-transform mb-1">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-bold text-foreground group-hover:text-gold leading-tight">
                      + បន្ថែម Album
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-full">
                      {activeFestival.name.replace("បុណ្យ", "")} {toKhmerNumber(selectedYear)}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Album (Associated directly with active Festival and Year) */}
      {canManageAlbums && (
        <Dialog open={isAddAlbumOpen} onOpenChange={setIsAddAlbumOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-gold" />
              <span>បន្ថែម Album ថ្មី</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Album នឹងត្រូវបានចងភ្ជាប់ជាមួយ {activeFestival?.name} ឆ្នាំ {toKhmerNumber(selectedYear)}
            </DialogDescription>
          </DialogHeader>

          {/* Target Destination Info Badge */}
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-foreground font-medium">
              <span>🏮 ពិធីបុណ្យ ៖ <strong className="text-gold">{activeFestival?.name}</strong></span>
              <span>📅 ឆ្នាំ ៖ <strong className="text-gold">{toKhmerNumber(selectedYear)}</strong></span>
            </div>
          </div>

          <form onSubmit={handleCreateAlbumSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ចំណងជើង Album *</Label>
              <Input
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder="ឧ. 🏮 មហាសង្ក្រាន្ត ឬ 🙏 សូត្រមន្តព្រឹក"
                required
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ទីកន្លែងប្រារព្ធ</Label>
              <Input
                value={newAlbumLocation}
                onChange={(e) => setNewAlbumLocation(e.target.value)}
                placeholder="វត្តពារាំង"
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">រូបភាពតំណាង (Cover URL - ជម្រើស)</Label>
              <Input
                value={newAlbumCover}
                onChange={(e) => setNewAlbumCover(e.target.value)}
                placeholder="https://... ឬទុករក្សារូបបុណ្យដើម"
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ការពិពណ៌នាសង្ខេប (ជម្រើស)</Label>
              <Input
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
                placeholder="ព័ត៌មានលម្អិតអំពី Album នេះ..."
                className="rounded-xl text-xs h-10"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddAlbumOpen(false)}
                className="rounded-full"
              >
                បោះបង់
              </Button>
              <Button
                type="submit"
                disabled={createAlbumMutation.isPending}
                className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 font-medium"
              >
                {createAlbumMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    កំពុងបង្កើត...
                  </>
                ) : (
                  "បង្កើត Album"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
