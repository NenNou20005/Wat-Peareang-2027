import {
  CalendarDays,
  PartyPopper,
  Plus,
  Camera,
  ArrowRight,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { toKhmerNumber, type Festival } from "@/data/archive";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AddFestivalModal } from "@/components/site/AddFestivalModal";
import { useYears, useFestivals, useAlbums } from "@/hooks/useArchiveData";
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

export function YearPills({
  value,
  onChange,
}: {
  value: number | "all";
  onChange: (v: number | "all") => void;
}) {
  const { data: dbYears = [] } = useYears();
  const [extraYears, setExtraYears] = useState<number[]>([]);
  const { isAuthenticated, isSuperAdmin, isAdmin, hasPermission } = useAuth();
  const canManageYears = isAuthenticated && (isSuperAdmin || isAdmin || hasPermission("manage_years"));
  const allYears = useMemo(() => {
    const base = [...dbYears, ...extraYears];
    return Array.from(new Set(base)).sort((a, b) => a - b);
  }, [dbYears, extraYears]);

  const nextYear = useMemo(() => Math.max(...allYears, 2026) + 1, [allYears]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft md:flex-row md:items-center">
      <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
        <CalendarDays className="h-4 w-4 text-gold" /> ឆ្នាំ
      </span>
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
        {allYears.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors cursor-pointer select-none",
              value === y
                ? "border-transparent bg-gold text-gold-foreground font-medium shadow-sm"
                : "border-border bg-card hover:bg-secondary text-foreground",
            )}
          >
            {toKhmerNumber(y)}
          </button>
        ))}
        {canManageYears && (
          <button
            type="button"
            onClick={() => setExtraYears((prev) => [...prev, nextYear])}
            aria-label="បន្ថែមឆ្នាំ"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-gold text-gold transition-colors hover:bg-gold-soft cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors cursor-pointer select-none",
          value === "all"
            ? "border-transparent bg-primary text-primary-foreground font-medium shadow-sm"
            : "border-border bg-card hover:bg-secondary text-foreground",
        )}
      >
        មើលឆ្នាំទាំងអស់ ↓
      </button>
    </div>
  );
}

export function FestivalPills({
  selected,
  onToggle,
  onClear,
  activeYear,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  activeYear?: number | "all" | undefined;
}) {
  const { data: dbFestivals = [] } = useFestivals();
  const [extraFestivals, setExtraFestivals] = useState<Festival[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const allFestivals = useMemo(() => {
    const list = dbFestivals;
    const existingIds = new Set(list.map((f) => f.id));
    return [...list, ...extraFestivals.filter((f) => !existingIds.has(f.id))];
  }, [dbFestivals, extraFestivals]);

  // Single active festival selection handler
  const handleFestivalClick = (id: string) => {
    if (selected.includes(id)) {
      onClear();
    } else {
      onToggle(id);
    }
  };

  // Find currently active festival
  const activeFestival = useMemo(() => {
    if (selected.length === 0) return null;
    return allFestivals.find((f) => selected.includes(f.id)) || null;
  }, [selected, allFestivals]);

  const selectedYearNumber = typeof activeYear === "number" ? activeYear : undefined;

  // Query ONLY albums belonging to this specific Festival AND Year from PostgreSQL
  const { data: festivalYearAlbums = [], isLoading: loadingAlbums } = useAlbums({
    festivalId: activeFestival?.id,
    year: selectedYearNumber,
  });

  // Strict isolation filter: guarantees only albums matching both festival AND year are shown
  const displayedAlbums = useMemo(() => {
    if (!activeFestival) return [];
    return festivalYearAlbums.filter((album) => {
      const matchFestival = album.festivalId === activeFestival.id;
      const matchYear =
        selectedYearNumber !== undefined ? album.year === selectedYearNumber : true;
      return matchFestival && matchYear;
    });
  }, [festivalYearAlbums, activeFestival, selectedYearNumber]);

  // Add Album Modal State
  const { isAuthenticated, isSuperAdmin, isAdmin, hasPermission } = useAuth();
  const canManageFestivals = isAuthenticated && (isSuperAdmin || isAdmin || hasPermission("manage_festivals"));
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

    const targetYear = selectedYearNumber || new Date().getFullYear();

    try {
      await createAlbumMutation.mutateAsync({
        festivalId: activeFestival.id,
        year: targetYear,
        title: newAlbumTitle.trim(),
        location: newAlbumLocation.trim() || "វត្តពារាំង",
        description: newAlbumDescription.trim() || undefined,
        coverImage: newAlbumCover.trim() || undefined,
      });

      toast.success(
        `បានបន្ថែម Album «${newAlbumTitle.trim()}» ទៅ ${activeFestival.name} ឆ្នាំ ${toKhmerNumber(targetYear)} រួចរាល់!`,
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
    <>
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft transition-all duration-300">
        {/* 1. Horizontal Festival Filter Row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
            <PartyPopper className="h-4 w-4 text-gold" /> បុណ្យ
          </span>
          <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors cursor-pointer select-none",
                selected.length === 0
                  ? "border-transparent bg-primary text-primary-foreground font-medium shadow-sm"
                  : "border-border bg-card hover:bg-secondary text-foreground",
              )}
            >
              ទាំងអស់
            </button>
            {allFestivals.map((f) => {
              const active = selected.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFestivalClick(f.id)}
                  style={active ? { backgroundColor: f.accent, borderColor: f.accent } : undefined}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors cursor-pointer select-none",
                    active
                      ? "text-primary-foreground shadow-sm font-medium"
                      : "border-border bg-card hover:bg-secondary text-foreground",
                  )}
                >
                  {f.emoji} {f.name.replace("បុណ្យ", "")}
                </button>
              );
            })}
            {canManageFestivals && (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                aria-label="បន្ថែមបុណ្យផ្សេងៗទៀត"
                title="បន្ថែមបុណ្យផ្សេងៗទៀត"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-gold text-gold transition-colors hover:bg-gold-soft cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Compact Horizontal Albums Row (When Festival is selected) */}
        {activeFestival && (
          <div className="mt-2 pt-4 border-t border-border/60 animate-in fade-in-50 duration-200 space-y-3">
            {/* Header / Context indicator */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-foreground">
                <span className="text-base">{activeFestival.emoji}</span>
                <span>{activeFestival.name}</span>
                <span className="text-muted-foreground font-normal">
                  {selectedYearNumber ? `— ឆ្នាំ ${toKhmerNumber(selectedYearNumber)}` : "— គ្រប់ឆ្នាំ"}
                </span>
                <span className="text-[11px] font-medium text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                  {toKhmerNumber(displayedAlbums.length)} Albums
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                ចុចលើ Album ណាមួយ ដើម្បីមើលរូបថត និង Lightbox
              </span>
            </div>

            {/* Horizontal Scrollable Row */}
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
                  <div className="flex items-center gap-2.5 py-2 px-3 rounded-xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
                    <span>
                      {selectedYearNumber
                        ? `មិនទាន់មាន Album សម្រាប់ «${activeFestival.name}» ក្នុងឆ្នាំ ${toKhmerNumber(selectedYearNumber)} នៅឡើយទេ។`
                        : `មិនទាន់មាន Album សម្រាប់ «${activeFestival.name}» នៅឡើយទេ។`}
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
                      {/* Album Thumbnail */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                        <img
                          src={alb.coverImage || alb.festival?.cover || activeFestival.cover}
                          alt={alb.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-25 transition-opacity" />
                        <span className="absolute bottom-1 right-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-xs flex items-center gap-0.5">
                          <Camera className="h-2 w-2" />
                          {toKhmerNumber(alb.photoCount || 0)}
                        </span>
                      </div>

                      {/* Album Title */}
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
                      {activeFestival.name.replace("បុណ្យ", "")}{" "}
                      {selectedYearNumber ? toKhmerNumber(selectedYearNumber) : ""}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add Festival */}
      {canManageFestivals && (
        <AddFestivalModal
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          existingFestivalIds={allFestivals.map((f) => f.id)}
          onFestivalAdded={(newFest) => {
            setExtraFestivals((prev) => [...prev, newFest]);
          }}
        />
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
              Album នឹងត្រូវបានចងភ្ជាប់ជាមួយ {activeFestival?.name} {selectedYearNumber ? `ឆ្នាំ ${toKhmerNumber(selectedYearNumber)}` : ""}
            </DialogDescription>
          </DialogHeader>

          {/* Target Destination Info Badge */}
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-foreground font-medium">
              <span>🏮 ពិធីបុណ្យ ៖ <strong className="text-gold">{activeFestival?.name}</strong></span>
              <span>📅 ឆ្នាំ ៖ <strong className="text-gold">{selectedYearNumber ? toKhmerNumber(selectedYearNumber) : "ទូទៅ"}</strong></span>
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
    </>
  );
}
