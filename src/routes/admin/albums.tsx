import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Search,
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Upload,
  Video,
  RefreshCw,
  Check,
  ArrowUp,
  ArrowDown,
  Save,
  CheckSquare,
  Square,
  FolderInput,
  Copy,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toKhmerNumber } from "@/data/archive";
import {
  useAdminAlbums,
  useAdminFestivals,
  useAdminYears,
  useCreateAlbum,
  useUpdateAlbum,
  useDeleteAlbum,
  useReorderAlbums,
  useMoveAlbums,
  useCopyAlbums,
  type AdminAlbum,
} from "@/hooks/useAdminData";
import { useAlbumPhotos } from "@/hooks/useArchiveData";
import { resolveImageUrl } from "@/lib/asset-resolver";
import { cn } from "@/lib/utils";

/**
 * Component to pick, preview, and clear album cover/thumbnail
 * Section: 🖼️ Album Cover / រូបតំណាង Album
 */
function AlbumCoverPicker({
  albumId,
  selectedCover,
  onSelectCover,
}: {
  albumId?: string;
  selectedCover: string;
  onSelectCover: (url: string) => void;
}) {
  const { data: photos = [], isLoading } = useAlbumPhotos(albumId || "");
  const [customUrl, setCustomUrl] = useState(selectedCover);

  useEffect(() => {
    setCustomUrl(selectedCover);
  }, [selectedCover]);

  return (
    <div className="space-y-3.5 rounded-2xl border-2 border-gold/40 bg-card p-4 shadow-sm">
      {/* 1. Section Header & Clear Cover */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🖼️</span>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Album Cover / រូបតំណាង Album
            </h4>
            <p className="text-[10px] text-muted-foreground">
              ជ្រើសរើសរូបថតមួយពីក្នុង Album នេះ ដើម្បីធ្វើជារូបតំណាង Cover
            </p>
          </div>
        </div>
        {selectedCover && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSelectCover("")}
            className="h-7 text-[11px] text-destructive hover:bg-destructive/10 px-2.5 rounded-full cursor-pointer"
          >
            <Trash2 className="h-3 w-3 mr-1" /> ដករូប Cover ចេញ (Clear)
          </Button>
        )}
      </div>

      {/* 2. Current / Selected Cover Preview Box */}
      <div className="flex items-center gap-3.5 rounded-xl bg-muted/30 p-2.5 border border-border/50">
        <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/80 flex items-center justify-center shadow-xs">
          {selectedCover ? (
            <>
              {/* Ambient Blurred Backdrop */}
              <img
                src={resolveImageUrl(selectedCover)}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover blur-sm scale-110 opacity-30 pointer-events-none"
              />
              {/* Natural Aspect Ratio Uncropped Cover */}
              <img
                src={resolveImageUrl(selectedCover)}
                alt="Album Cover Preview"
                className="relative z-[1] max-h-full max-w-full object-contain"
              />
            </>
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground text-center p-1 bg-secondary/40">
              <ImageIcon className="h-6 w-6 opacity-40" />
            </div>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            {selectedCover ? (
              <span className="inline-flex items-center gap-1 text-gold font-bold">
                <Check className="h-3.5 w-3.5 stroke-[3]" /> បានជ្រើសរូបតំណាង Cover
              </span>
            ) : (
              <span className="text-muted-foreground font-medium">
                មិនទាន់ជ្រើស (ប្រើ Default Fallback)
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            {selectedCover
              ? "រូបនេះនឹងបង្ហាញលើ Album Card នៅលើទំព័រដើម និងទំព័រ Archive"
              : "ចុចលើរូបថតណាមួយខាងក្រោមដើម្បីកំណត់ជារូប Cover សម្រាប់ Album នេះ"}
          </p>
        </div>
      </div>

      {/* 3. Photo Picker Grid (From album photos) */}
      {albumId && (
        <div className="space-y-2 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <span>រូបថតទាំងអស់ក្នុង Album នេះ</span>
              <span className="text-muted-foreground font-normal">
                ({toKhmerNumber(photos.length)} រូប)
              </span>
            </span>
            {photos.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                ចុចលើរូបដើម្បីជ្រើសជា Cover
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2 rounded-xl border border-border/50 bg-background/50">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-muted animate-pulse border border-border"
                />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2 px-3 rounded-xl bg-card/60 border border-dashed border-border">
              មិនទាន់មានរូបថតក្នុង Album នេះនៅឡើយទេ។ អ្នកអាចបញ្ចូល Link រូបភាពផ្ទាល់ខាងក្រោម។
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-52 overflow-y-auto p-2 rounded-xl bg-background/60 border border-border/60 shadow-inner">
              {photos.map((photo, idx) => {
                const canonicalUrl = photo.rawUrl || photo.thumbnailUrl || photo.src || "";
                const isSelected =
                  selectedCover === canonicalUrl ||
                  selectedCover === photo.src ||
                  selectedCover === photo.thumbnailUrl ||
                  (photo.rawUrl && selectedCover === photo.rawUrl);
                const isUpload =
                  canonicalUrl.startsWith("/uploads/") ||
                  canonicalUrl.startsWith("/api/storage/") ||
                  photo.src.startsWith("/uploads/") ||
                  photo.src.startsWith("/api/storage/");

                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onSelectCover(canonicalUrl)}
                    title={photo.caption || `Photo ${idx + 1}`}
                    className={cn(
                      "group relative aspect-square w-full overflow-hidden rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center bg-secondary/80",
                      isSelected
                        ? "border-gold ring-3 ring-gold/60 scale-95 shadow-md z-10"
                        : "border-border/80 hover:border-gold/60 opacity-80 hover:opacity-100 hover:scale-[1.02]",
                    )}
                  >
                    {/* Ambient Blurred Backdrop */}
                    <img
                      src={resolveImageUrl(photo.thumbnailUrl || photo.src)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover blur-xs scale-110 opacity-30 pointer-events-none"
                    />
                    {/* Foreground Natural-Ratio Uncropped Photo */}
                    <img
                      src={resolveImageUrl(photo.thumbnailUrl || photo.src)}
                      alt={photo.caption || "Album photo"}
                      loading="lazy"
                      className="relative z-[1] max-h-full max-w-full object-contain"
                    />
                    {isUpload && (
                      <span className="absolute top-1 left-1 z-[2] rounded bg-black/80 px-1 py-0.2 text-[8px] text-gold font-bold">
                        Upload
                      </span>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 z-[2] bg-gold/35 grid place-items-center backdrop-blur-[1px]">
                        <div className="rounded-full bg-gold text-primary-foreground p-1 shadow-md">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Manual URL Input */}
      <div className="space-y-1 pt-1 border-t border-border/50">
        <Label className="text-[11px] text-muted-foreground">
          ឬបញ្ចូល Link រូបភាពផ្ទាល់ (URL) ៖
        </Label>
        <Input
          value={customUrl}
          onChange={(e) => {
            setCustomUrl(e.target.value);
            onSelectCover(e.target.value);
          }}
          placeholder="https://... ឬ /assets/..."
          className="h-8 text-xs rounded-xl"
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/albums")({
  head: () => ({
    meta: [
      { title: "គ្រប់គ្រង Albums — Wat Peareang Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminAlbumsPage,
});

function AdminAlbumsPage() {
  const navigate = useNavigate();

  // Filters & Pagination state
  const [search, setSearch] = useState("");
  const [selectedFestival, setSelectedFestival] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [page, setPage] = useState(1);

  const hasSearch = search.trim().length > 0;
  const isScoped = selectedFestival !== "all" && selectedYear !== "all";
  const effectiveLimit = isScoped ? 1000 : 24;

  // Queries
  const { data: festivals = [] } = useAdminFestivals();
  const { data: years = [] } = useAdminYears();
  const { data: albumsData, isLoading: loading } = useAdminAlbums({
    page: isScoped ? 1 : page,
    limit: effectiveLimit,
    search,
    festivalId: selectedFestival,
    year: selectedYear,
  });

  const fetchedAlbums = useMemo(() => albumsData?.albums || [], [albumsData?.albums]);
  const albums = fetchedAlbums;
  const totalPages = albumsData?.totalPages || 1;
  const totalCount = albumsData?.total || 0;
  const isScopeFullyLoaded = isScoped ? totalCount === fetchedAlbums.length : true;
  const isReorderActive = isScoped && !hasSearch && isScopeFullyLoaded;

  // Selected parent scope for ordering (null = Root albums, string = parent album ID)
  const [selectedParentScope, setSelectedParentScope] = useState<string | null>(null);

  // Reset selected parent scope when festival or year changes
  useEffect(() => {
    setSelectedParentScope(null);
  }, [selectedFestival, selectedYear]);

  // Derive available parents with children in this festival + year scope
  const availableParents = useMemo(() => {
    if (!isScoped) return [];
    const parentMap = new Map<string, { id: string; title: string; count: number }>();
    for (const alb of fetchedAlbums) {
      if (alb.parentAlbumId) {
        const pId = alb.parentAlbumId;
        const existing = parentMap.get(pId);
        if (existing) {
          existing.count++;
        } else {
          const parentAlb = fetchedAlbums.find((a) => a.id === pId);
          parentMap.set(pId, {
            id: pId,
            title: parentAlb ? parentAlb.title : pId,
            count: 1,
          });
        }
      }
    }
    return Array.from(parentMap.values());
  }, [fetchedAlbums, isScoped]);

  const rootCount = useMemo(() => {
    return fetchedAlbums.filter((a) => !a.parentAlbumId).length;
  }, [fetchedAlbums]);

  // Sibling albums matching the current scope
  const siblingAlbums = useMemo(() => {
    if (!isScoped) return fetchedAlbums;
    if (selectedParentScope) {
      return fetchedAlbums.filter((a) => a.parentAlbumId === selectedParentScope);
    }
    return fetchedAlbums.filter((a) => !a.parentAlbumId);
  }, [fetchedAlbums, isScoped, selectedParentScope]);

  // Local reorder & selection state
  const [localAlbums, setLocalAlbums] = useState<AdminAlbum[]>([]);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isReorderActive) {
      setLocalAlbums(siblingAlbums);
    } else {
      setLocalAlbums(fetchedAlbums);
    }
    setHasOrderChanged(false);
    setSelectedIds(new Set());
  }, [siblingAlbums, isReorderActive, fetchedAlbums, search, page]);

  const handleScopeChange = (newScope: string | null) => {
    if (hasOrderChanged) {
      const confirmed = window.confirm(
        "អ្នកមានការកែប្រែលំដាប់មិនទាន់រក្សាទុក។ តើអ្នកពិតជាចង់ប្តូរកម្រិតដោយមិនរក្សាទុកឬទេ?",
      );
      if (!confirmed) return;
    }
    setSelectedParentScope(newScope);
    setSelectedIds(new Set());
    setHasOrderChanged(false);
  };

  const toggleSelectAlbum = (id: string) => {
    if (!isReorderActive) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected =
    isReorderActive && localAlbums.length > 0 && localAlbums.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (!isReorderActive) return;
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(localAlbums.map((a) => a.id)));
    }
  };

  const canMoveUp = useMemo(() => {
    if (!isReorderActive || selectedIds.size === 0 || localAlbums.length <= 1) return false;
    for (let i = 1; i < localAlbums.length; i++) {
      if (selectedIds.has(localAlbums[i]!.id) && !selectedIds.has(localAlbums[i - 1]!.id)) {
        return true;
      }
    }
    return false;
  }, [isReorderActive, selectedIds, localAlbums]);

  const canMoveDown = useMemo(() => {
    if (!isReorderActive || selectedIds.size === 0 || localAlbums.length <= 1) return false;
    for (let i = 0; i < localAlbums.length - 1; i++) {
      if (selectedIds.has(localAlbums[i]!.id) && !selectedIds.has(localAlbums[i + 1]!.id)) {
        return true;
      }
    }
    return false;
  }, [isReorderActive, selectedIds, localAlbums]);

  const handleMove = (direction: "up" | "down") => {
    if (!isReorderActive || selectedIds.size === 0 || localAlbums.length <= 1) return;

    const items = [...localAlbums];

    if (direction === "up") {
      let moved = false;
      for (let i = 1; i < items.length; i++) {
        if (selectedIds.has(items[i]!.id) && !selectedIds.has(items[i - 1]!.id)) {
          const temp = items[i]!;
          items[i] = items[i - 1]!;
          items[i - 1] = temp;
          moved = true;
        }
      }
      if (moved) {
        setLocalAlbums(items);
        setHasOrderChanged(true);
      }
    } else {
      let moved = false;
      for (let i = items.length - 2; i >= 0; i--) {
        if (selectedIds.has(items[i]!.id) && !selectedIds.has(items[i + 1]!.id)) {
          const temp = items[i]!;
          items[i] = items[i + 1]!;
          items[i + 1] = temp;
          moved = true;
        }
      }
      if (moved) {
        setLocalAlbums(items);
        setHasOrderChanged(true);
      }
    }
  };

  // Mutations
  const createAlbumMutation = useCreateAlbum();
  const updateAlbumMutation = useUpdateAlbum();
  const deleteAlbumMutation = useDeleteAlbum();
  const reorderAlbumsMutation = useReorderAlbums();
  const moveAlbumsMutation = useMoveAlbums();

  const handleSaveOrder = async () => {
    if (!isReorderActive || !hasOrderChanged) return;
    try {
      await reorderAlbumsMutation.mutateAsync({
        festivalId: selectedFestival,
        year: Number(selectedYear),
        parentAlbumId: selectedParentScope,
        items: localAlbums.map((alb, idx) => ({
          id: alb.id,
          sortOrder: idx + 1,
        })),
      });
      toast.success("បានរក្សាទុកលំដាប់ Albums ដោយជោគជ័យ!");
      setHasOrderChanged(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការរក្សាទុកលំដាប់ Albums";
      toast.error(msg);
    }
  };

  // Move Modal & State
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [movingAlbums, setMovingAlbums] = useState<AdminAlbum[]>([]);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const openMoveModalForSingle = (album: AdminAlbum) => {
    setMovingAlbums([album]);
    setTargetParentId(album.parentAlbumId || null);
    setIsMoveOpen(true);
  };

  const openMoveModalForSelected = () => {
    const selectedList = localAlbums.filter((a) => selectedIds.has(a.id));
    if (selectedList.length === 0) return;
    setMovingAlbums(selectedList);
    const firstParent = selectedList[0]?.parentAlbumId || null;
    const allSame = selectedList.every((a) => (a.parentAlbumId || null) === firstParent);
    setTargetParentId(allSame ? firstParent : null);
    setIsMoveOpen(true);
  };

  const candidateParents = useMemo(() => {
    if (movingAlbums.length === 0) return [];
    const movingSet = new Set(movingAlbums.map((a) => a.id));
    const parentMap = new Map<string, string | null>();
    for (const a of fetchedAlbums) {
      parentMap.set(a.id, a.parentAlbumId || null);
    }
    const scopeFestId = movingAlbums[0]?.festivalId;
    const scopeYr = movingAlbums[0]?.year;

    return fetchedAlbums.filter((cand) => {
      if (cand.festivalId !== scopeFestId || cand.year !== scopeYr) return false;
      if (cand.status === "trashed") return false;
      if (movingSet.has(cand.id)) return false;

      // Prevent cycles: Ensure candidate is not a descendant of any moving album
      let curr = cand.parentAlbumId;
      const visited = new Set<string>();
      while (curr) {
        if (movingSet.has(curr)) return false;
        if (visited.has(curr)) break;
        visited.add(curr);
        curr = parentMap.get(curr) || null;
      }
      return true;
    });
  }, [movingAlbums, fetchedAlbums]);

  const handleExecuteMove = async () => {
    if (movingAlbums.length === 0) return;
    const albumIds = movingAlbums.map((a) => a.id);
    try {
      await moveAlbumsMutation.mutateAsync({
        albumIds,
        targetParentAlbumId: targetParentId,
      });
      const targetTitle = targetParentId
        ? fetchedAlbums.find((a) => a.id === targetParentId)?.title || "Album មេ"
        : "កម្រិត Root (ថតចម្បង)";
      toast.success(
        albumIds.length === 1
          ? `បានផ្លាស់ទី Album ទៅកាន់ «${targetTitle}» ជោគជ័យ!`
          : `បានផ្លាស់ទី ${toKhmerNumber(albumIds.length)} Albums ទៅកាន់ «${targetTitle}» ជោគជ័យ!`
      );
      setIsMoveOpen(false);
      setMovingAlbums([]);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការផ្លាស់ទី Album";
      toast.error(msg);
    }
  };

  // Copy / Paste Clipboard State (Stored in sessionStorage for explorer-like UX)
  const CLIPBOARD_STORAGE_KEY = "wat_peareang_album_clipboard";

  const [clipboard, setClipboard] = useState<{
    sourceAlbumIds: string[];
    sourceTitles: string[];
    sourceFestivalId: string;
    sourceYear: number;
    timestamp: number;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const updateClipboard = (data: {
    sourceAlbumIds: string[];
    sourceTitles: string[];
    sourceFestivalId: string;
    sourceYear: number;
    timestamp: number;
  } | null) => {
    setClipboard(data);
    if (typeof window !== "undefined") {
      try {
        if (data) {
          sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(data));
        } else {
          sessionStorage.removeItem(CLIPBOARD_STORAGE_KEY);
        }
      } catch (e) {
        console.warn("Failed to update sessionStorage clipboard:", e);
      }
    }
  };

  const copyAlbumsMutation = useCopyAlbums();
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteTargetParentId, setPasteTargetParentId] = useState<string | null>(null);

  const pasteDestFestivalId =
    selectedFestival !== "all" ? selectedFestival : clipboard?.sourceFestivalId;
  const pasteDestYear =
    selectedYear !== "all" ? Number(selectedYear) : clipboard?.sourceYear;

  const isDestValid = Boolean(
    pasteDestFestivalId &&
      pasteDestFestivalId !== "all" &&
      pasteDestYear !== undefined &&
      !isNaN(pasteDestYear),
  );

  // Unpaginated query for paste destination candidate parents (up to 1000 albums in target festival/year)
  const { data: pasteDestinationData, isLoading: isPasteDestinationLoading } = useAdminAlbums(
    isDestValid
      ? {
          festivalId: pasteDestFestivalId,
          year: pasteDestYear,
          limit: 1000,
        }
      : undefined,
  );

  const candidatePasteParents = useMemo(() => {
    if (!clipboard || clipboard.sourceAlbumIds.length === 0) return [];
    const sourceSet = new Set(clipboard.sourceAlbumIds);

    const pool = pasteDestinationData ? pasteDestinationData.albums : fetchedAlbums;

    return pool.filter((cand) => {
      // Must not be trashed
      if (cand.status === "trashed") return false;
      // Do not allow any source album to appear as candidate parent
      if (sourceSet.has(cand.id)) return false;
      // Destination scope matching
      if (pasteDestFestivalId && cand.festivalId !== pasteDestFestivalId) return false;
      if (pasteDestYear && cand.year !== pasteDestYear) return false;
      return true;
    });
  }, [
    clipboard,
    pasteDestinationData,
    fetchedAlbums,
    pasteDestFestivalId,
    pasteDestYear,
  ]);

  const handleCopySingle = (album: AdminAlbum) => {
    const data = {
      sourceAlbumIds: [album.id],
      sourceTitles: [album.title],
      sourceFestivalId: album.festivalId,
      sourceYear: album.year,
      timestamp: Date.now(),
    };
    updateClipboard(data);
    toast.success(`បានចម្លង Album «${album.title}» ទៅកាន់ Clipboard (Copy)`);
  };

  const handleCopySelected = () => {
    const selectedList = localAlbums.filter((a) => selectedIds.has(a.id));
    if (selectedList.length === 0) return;
    const data = {
      sourceAlbumIds: selectedList.map((a) => a.id),
      sourceTitles: selectedList.map((a) => a.title),
      sourceFestivalId: selectedList[0]!.festivalId,
      sourceYear: selectedList[0]!.year,
      timestamp: Date.now(),
    };
    updateClipboard(data);
    toast.success(`បានចម្លង ${toKhmerNumber(selectedList.length)} Albums ទៅកាន់ Clipboard (Copy)`);
    setSelectedIds(new Set());
  };

  const handleClearClipboard = () => {
    updateClipboard(null);
    toast.info("បានសម្អាត Clipboard រួចរាល់");
  };

  const openPasteModal = (targetParentId: string | null = null) => {
    if (!clipboard || clipboard.sourceAlbumIds.length === 0) {
      toast.error("គ្មាន Album ក្នុង Clipboard សម្រាប់បិទភ្ជាប់ (Paste) ឡើយ");
      return;
    }
    setPasteTargetParentId(targetParentId);
    const sourceSet = new Set(clipboard.sourceAlbumIds);
    const safeTargetParentId =
      targetParentId && !sourceSet.has(targetParentId) ? targetParentId : null;
    setPasteTargetParentId(safeTargetParentId);
    setIsPasteOpen(true);
  };

  const handleExecutePaste = async () => {
    if (!clipboard || clipboard.sourceAlbumIds.length === 0) return;
    if (pasteTargetParentId && clipboard.sourceAlbumIds.includes(pasteTargetParentId)) {
      toast.error("មិនអាចបិទភ្ជាប់ Album ចូលទៅក្នុងខ្លួនវាបានឡើយ");
      return;
    }
    try {
      const res = await copyAlbumsMutation.mutateAsync({
        sourceAlbumIds: clipboard.sourceAlbumIds,
        targetParentAlbumId: pasteTargetParentId,
        destinationFestivalId: selectedFestival !== "all" ? selectedFestival : clipboard.sourceFestivalId,
        destinationYear: selectedYear !== "all" ? Number(selectedYear) : clipboard.sourceYear,
      });

      const targetTitle = pasteTargetParentId
        ? candidatePasteParents.find((a) => a.id === pasteTargetParentId)?.title ||
          localAlbums.find((a) => a.id === pasteTargetParentId)?.title ||
          "Album មេ"
        : "កម្រិត Root (ថតចម្បង)";

      toast.success(
        res.copiedCount === 1
          ? `បានបិទភ្ជាប់ (Paste) Album ទៅកាន់ «${targetTitle}» ជោគជ័យ!`
          : `បានបិទភ្ជាប់ ${toKhmerNumber(res.copiedCount)} Albums ទៅកាន់ «${targetTitle}» ជោគជ័យ!`,
      );

      setIsPasteOpen(false);
      updateClipboard(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបិទភ្ជាប់ Album";
      toast.error(msg);
    }
  };

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<AdminAlbum | null>(null);

  // Form states
  const [formFestId, setFormFestId] = useState("");
  const [formYear, setFormYear] = useState<number>(2026);
  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("វត្តពារាំង");
  const [formDescription, setFormDescription] = useState("");
  const [formCoverImage, setFormCoverImage] = useState("");

  const handleAddAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveFestId = formFestId || festivals[0]?.id;
    const effectiveYear = formYear || years[0] || 2026;

    if (!formTitle.trim() || !effectiveFestId || !effectiveYear) {
      toast.error("សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់។");
      return;
    }

    try {
      await createAlbumMutation.mutateAsync({
        festivalId: effectiveFestId,
        year: effectiveYear,
        title: formTitle.trim(),
        location: formLocation.trim() || "វត្តពារាំង",
        description: formDescription.trim() || undefined,
        coverImage: formCoverImage.trim() || undefined,
      });
      toast.success("បានបង្កើត Album ថ្មីជោគជ័យ!");
      setIsAddOpen(false);
      setFormTitle("");
      setFormDescription("");
      setFormCoverImage("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបង្កើត Album។";
      toast.error(errorMsg);
    }
  };

  const openEditModal = (album: AdminAlbum) => {
    setEditingAlbum(album);
    setFormTitle(album.title);
    setFormLocation(album.location || "វត្តពារាំង");
    setFormDescription(album.description || "");
    setFormCoverImage(album.coverImage || "");
  };

  const handleEditAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum) return;

    try {
      await updateAlbumMutation.mutateAsync({
        id: editingAlbum.id,
        title: formTitle.trim(),
        location: formLocation.trim(),
        description: formDescription.trim() || undefined,
        coverImage: formCoverImage.trim() ? formCoverImage.trim() : "",
      });
      toast.success("បានកែសម្រួល Album ជោគជ័យ!");
      setEditingAlbum(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកែប្រែ Album។";
      toast.error(errorMsg);
    }
  };

  const handleDeleteAlbum = async (album: AdminAlbum) => {
    if (
      !confirm(
        `តើលោកអ្នកពិតជាចង់ផ្លាស់ទី Album «${album.title}» ទៅកាន់ធុងសំរាម (Trash) មែនឬទេ?\n(អ្នកអាចស្តារឡើងវិញបានគ្រប់ពេល)`,
      )
    ) {
      return;
    }

    try {
      await deleteAlbumMutation.mutateAsync(album.id);
      toast.success("បានផ្លាស់ទី Album ទៅកាន់ធុងសំរាមរួចរាល់។");
      navigate({ to: "/admin/albums" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការលុប Album។";
      toast.error(errorMsg);
    }
  };

  return (
    <AdminLayout requiredPermission="manage_albums">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
                📁 បណ្ដុំរូបភាព
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                សរុប {totalCount} Albums
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              គ្រប់គ្រង Albums
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              រៀបចំ និងគ្រប់គ្រងបណ្ដុំរូបភាពតាមឋានានុក្រម៖ បុណ្យ ➔ ឆ្នាំ ➔ Album ➔ រូបភាព។
            </p>
          </div>

          <Button
            onClick={() => {
              setFormTitle("");
              setFormLocation("វត្តពារាំង");
              setFormDescription("");
              setFormCoverImage("");
              if (festivals.length > 0 && !formFestId && festivals[0])
                setFormFestId(festivals[0].id);
              if (years.length > 0 && years[0] !== undefined) setFormYear(years[0]);
              setIsAddOpen(true);
            }}
            className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
          >
            <Plus className="mr-1.5 h-4 w-4" /> បង្កើត Album ថ្មី
          </Button>
        </div>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកតាមចំណងជើង..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl pl-10 h-10 text-xs bg-card"
            />
          </div>

          <select
            value={selectedFestival}
            onChange={(e) => {
              setSelectedFestival(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground"
          >
            <option value="all">🎉 គ្រប់ពិធីបុណ្យទាំងអស់</option>
            {festivals.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji} {f.name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground"
          >
            <option value="all">📅 គ្រប់ឆ្នាំទាំងអស់</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                ឆ្នាំ {y} ({toKhmerNumber(y)})
              </option>
            ))}
          </select>
        </div>

        {/* Scoped Reordering Toolbar */}
        {isReorderActive ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-card p-3 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Parent Scope Selector (Root vs Sub-albums) */}
              {availableParents.length > 0 ? (
                <div className="flex items-center gap-1.5 mr-1">
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                    📁 កម្រិត៖
                  </span>
                  <select
                    value={selectedParentScope || "root"}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleScopeChange(val === "root" ? null : val);
                    }}
                    className="rounded-xl border border-gold/50 bg-background px-2.5 py-1 text-xs text-foreground font-medium focus:ring-1 focus:ring-gold"
                  >
                    <option value="root">
                      📁 Root Albums ({toKhmerNumber(rootCount)})
                    </option>
                    {availableParents.map((p) => (
                      <option key={p.id} value={p.id}>
                        ↳ Sub-albums ក្រោម «{p.title}» ({toKhmerNumber(p.count)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-[11px] text-muted-foreground mr-1">
                  📁 កម្រិត Root ({toKhmerNumber(localAlbums.length)})
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                disabled={localAlbums.length === 0}
                className="h-8 rounded-full text-xs"
              >
                {isAllSelected ? (
                  <>
                    <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-gold" /> ដោះការជ្រើសរើស (Deselect All)
                  </>
                ) : (
                  <>
                    <Square className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /> ជ្រើសរើសទាំងអស់ (Select All)
                  </>
                )}
              </Button>

              {selectedIds.size > 0 && (
                <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold">
                  បានជ្រើសរើស {toKhmerNumber(selectedIds.size)} / {toKhmerNumber(localAlbums.length)}
                </span>
              )}

              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openMoveModalForSelected}
                  className="h-8 rounded-full text-xs border-gold/60 text-gold hover:bg-gold/10 font-medium"
                >
                  <FolderInput className="mr-1.5 h-3.5 w-3.5" /> ផ្លាស់ទី ({toKhmerNumber(selectedIds.size)})
                </Button>
              )}

              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySelected}
                  className="h-8 rounded-full text-xs border-blue-500/60 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-medium"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> ចម្លង ({toKhmerNumber(selectedIds.size)})
                </Button>
              )}

              {hasOrderChanged && (
                <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 text-xs font-medium">
                  ● មានការកែប្រែលំដាប់មិនទាន់រក្សាទុក
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-xl border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => handleMove("up")}
                  disabled={!canMoveUp}
                  title="រំកិលឡើងលើ (Move Up)"
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove("down")}
                  disabled={!canMoveDown}
                  title="រំកិលចុះក្រោម (Move Down)"
                  className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleSaveOrder}
                disabled={!hasOrderChanged || reorderAlbumsMutation.isPending}
                className="h-8 rounded-full bg-gold text-primary-foreground font-medium hover:bg-gold/90 shadow-soft"
              >
                {reorderAlbumsMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> កំពុងរក្សាទុក...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> រក្សាទុកលំដាប់
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : isScoped && hasSearch ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                មិនអាចរៀបលំដាប់ក្នុងពេលស្វែងរកបានទេ។ សូមលុបពាក្យស្វែងរកជាមុនសិន ដើម្បីរៀបចំ Albums ទាំងអស់ក្នុងពិធីបុណ្យ និងឆ្នាំនេះ។
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearch("")}
              className="h-7 text-xs rounded-full border-amber-500/40 hover:bg-amber-500/20"
            >
              លុបការស្វែងរក
            </Button>
          </div>
        ) : isScoped && !isScopeFullyLoaded ? (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <span className="text-base">⚠️</span>
            <span>
              មិនទាន់អាចរៀបលំដាប់បានទេ ព្រោះទិន្នន័យមិនទាន់បានទាញយកពេញលេញ ({toKhmerNumber(fetchedAlbums.length)} / {toKhmerNumber(totalCount)} Albums)។
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground">
            <span className="text-base">💡</span>
            <span>
              ដើម្បីរៀបលំដាប់ Albums (Move Up / Down) សូមជ្រើសរើស <strong>ពិធីបុណ្យ</strong> និង <strong>ឆ្នាំ</strong> ជាក់លាក់មួយនៅក្នុង Filter ខាងលើ។
            </span>
          </div>
        )}

        {/* Active Clipboard Dock / Banner */}
        {clipboard && clipboard.sourceAlbumIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-foreground shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Clipboard className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-blue-700 dark:text-blue-300">
                  Clipboard: បានចម្លង {toKhmerNumber(clipboard.sourceAlbumIds.length)} Album{clipboard.sourceAlbumIds.length > 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  «{clipboard.sourceTitles.slice(0, 2).join("», «")}»{clipboard.sourceTitles.length > 2 ? ` និង ${toKhmerNumber(clipboard.sourceTitles.length - 2)} ផ្សេងទៀត` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => openPasteModal(null)}
                className="h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-soft text-xs"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> បិទភ្ជាប់ (Paste)
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearClipboard}
                className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
              >
                សម្អាត (Clear)
              </Button>
            </div>
          </div>
        )}

        {/* Albums Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
              កំពុងទាញយក Albums...
            </div>
          ) : localAlbums.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground rounded-3xl border border-border/80 bg-card">
              រកមិនឃើញ Album ណាឡើយ។
            </div>
          ) : (
            localAlbums.map((album, index) => {
              const fest = festivals.find((f) => f.id === album.festivalId);
              const coverSrc = album.coverImage || fest?.coverUrl || `/assets/fest-${album.festivalId}.jpg`;
              const isSelected = isReorderActive && selectedIds.has(album.id);
              return (
                <div
                  key={album.id}
                  className={cn(
                    "rounded-3xl border bg-card p-4 shadow-soft transition-all hover:shadow-card flex flex-col justify-between",
                    isSelected ? "ring-2 ring-gold border-gold/80" : "border-border/80",
                  )}
                >
                  <div className="space-y-3">
                    {/* Album Cover Thumbnail */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-secondary/80 flex items-center justify-center">
                      {/* Ambient Blurred Backdrop */}
                      <img
                        src={coverSrc}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover blur-md scale-110 opacity-35 dark:opacity-25 pointer-events-none"
                      />
                      {/* Natural Aspect Ratio Uncropped Cover */}
                      <img
                        src={coverSrc}
                        alt={album.title}
                        loading="lazy"
                        className="relative z-[1] max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-105"
                      />
                      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />

                      {/* Scoped Checkbox / Position Order Badge */}
                      {isReorderActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectAlbum(album.id);
                          }}
                          title={isSelected ? "ដកចេញពីការជ្រើសរើស" : "ជ្រើសរើសដើម្បីរៀបលំដាប់"}
                          className={cn(
                            "absolute top-2 left-2 z-[4] flex items-center justify-center h-6 min-w-6 px-1.5 rounded-lg transition-all cursor-pointer shadow-md",
                            isSelected
                              ? "bg-gold text-primary-foreground font-bold"
                              : "bg-black/65 text-white/90 hover:bg-black/80 hover:text-white border border-white/20 text-[10px] font-semibold",
                          )}
                        >
                          {isSelected ? (
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          ) : (
                            <span>#{toKhmerNumber(index + 1)}</span>
                          )}
                        </button>
                      )}

                      <span className="absolute bottom-2 left-2 z-[3] rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white backdrop-blur-xs flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-gold" /> {toKhmerNumber(album.photoCount)} រូប
                      </span>
                      {album.coverImage && (
                        <span className="absolute top-2 right-2 z-[3] rounded-full bg-gold text-primary-foreground px-2 py-0.5 text-[10px] font-bold shadow-xs">
                          Cover
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
                          {fest?.emoji || "🎉"} {fest?.name || album.festivalId}
                        </span>
                        {album.parentAlbumId ? (
                          <span
                            title={`Sub-album ក្រោម៖ ${fetchedAlbums.find((a) => a.id === album.parentAlbumId)?.title || album.parentAlbumId}`}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-semibold border border-blue-500/20"
                          >
                            <span>↳ Sub-album</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 text-muted-foreground px-2 py-0.5 text-[10px]">
                            Root
                          </span>
                        )}
                      </div>
                      <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold">
                        ឆ្នាំ {album.year}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">
                        {album.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {album.description || "គ្មានការពិពណ៌នាបន្ថែមឡើយ។"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gold" /> {album.location || "វត្តពារាំង"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-full h-8 text-xs"
                      >
                        <Link
                          to="/admin/images"
                          search={{
                            albumId: album.id,
                            year: album.year,
                            festivalId: album.festivalId,
                          }}
                        >
                          <Upload className="mr-1 h-3.5 w-3.5" /> Upload រូប
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="rounded-full h-8 text-xs"
                      >
                        <Link
                          to="/admin/videos"
                          search={{
                            albumId: album.id,
                            year: album.year,
                            festivalId: album.festivalId,
                          }}
                        >
                          <Video className="mr-1 h-3.5 w-3.5" /> Upload វីដេអូ
                        </Link>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-xl" title="មើល Album">
                        <a href={`/album/${album.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openMoveModalForSingle(album)}
                        title="ផ្លាស់ទី Album (Move)"
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-gold hover:bg-gold/10"
                      >
                        <FolderInput className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopySingle(album)}
                        title="ចម្លង Album (Copy)"
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(album)}
                        title="កែសម្រួល Album"
                        className="h-8 w-8 rounded-xl"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleteAlbumMutation.isPending}
                        onClick={() => handleDeleteAlbum(album)}
                        title="ផ្លាស់ទីទៅធុងសំរាម"
                        className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {!isScoped && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              ទំព័រទី {page} នៃ {totalPages} (សរុប {totalCount} Albums)
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full h-8 text-xs"
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> ថយក្រោយ
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-full h-8 text-xs"
              >
                បន្ទាប់ <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Modal: Create Album */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                ➕ បង្កើត Album ថ្មី
              </DialogTitle>
            </DialogHeader>

            {/* Destination Summary Banner */}
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3.5 text-xs shadow-sm">
              <div className="font-semibold text-gold mb-1 flex items-center gap-1.5">
                <span>📍 គោលដៅបង្កើត Album ក្នុងទិន្នន័យ (PostgreSQL Record)៖</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-foreground font-medium">
                <div>
                  📅 ឆ្នាំ៖{" "}
                  <span className="font-bold text-gold">
                    {formYear || (years[0] ?? 2027)} (
                    {toKhmerNumber(formYear || (years[0] ?? 2027))})
                  </span>
                </div>
                <div>
                  🏮 ពិធីបុណ្យ៖{" "}
                  <span className="font-bold text-gold">
                    {festivals.find((f) => f.id === (formFestId || festivals[0]?.id))?.name ||
                      "បុណ្យ"}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddAlbum} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ជ្រើសរើសពិធីបុណ្យ</Label>
                <select
                  value={formFestId}
                  onChange={(e) => setFormFestId(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-card px-3 h-10 text-xs"
                  required
                >
                  {festivals.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.emoji} {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ជ្រើសរើសឆ្នាំប្រារព្ធ</Label>
                <select
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                  className="w-full rounded-2xl border border-border bg-card px-3 h-10 text-xs"
                  required
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      ឆ្នាំ {y} ({toKhmerNumber(y)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ចំណងជើង Album</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="ឧ. ពិធីដង្ហែផ្កាប្រាក់មហាសាមគ្គី"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ទីកន្លែងប្រារព្ធ</Label>
                <Input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="វត្តពារាំង"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ការពិពណ៌នាបន្ថែម (ជម្រើស)</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ព័ត៌មានបន្ថែមអំពីកម្មវិធីបុណ្យ..."
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              {/* Album Cover / Thumbnail Picker */}
              <AlbumCoverPicker
                selectedCover={formCoverImage}
                onSelectCover={setFormCoverImage}
              />

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={createAlbumMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {createAlbumMutation.isPending ? "កំពុងបង្កើត..." : "បង្កើត Album"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Album */}
        <Dialog open={!!editingAlbum} onOpenChange={(v) => !v && setEditingAlbum(null)}>
          <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                <span>✏️ កែសម្រួល Album</span>
                {editingAlbum && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({editingAlbum.title})
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditAlbum} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ចំណងជើង Album</Label>
                  <Input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="rounded-2xl h-10 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ទីកន្លែងប្រារព្ធ</Label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="rounded-2xl h-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ការពិពណ៌នា</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ព័ត៌មានបន្ថែម..."
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              {/* 🖼️ Album Cover / រូបតំណាង Album */}
              {editingAlbum && (
                <AlbumCoverPicker
                  albumId={editingAlbum.id}
                  selectedCover={formCoverImage}
                  onSelectCover={setFormCoverImage}
                />
              )}

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAlbum(null)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={updateAlbumMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 font-medium px-6"
                >
                  {updateAlbumMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុក (Save)"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Move Album(s) */}
        <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                <FolderInput className="h-5 w-5 text-gold" />
                <span>ផ្លាស់ទី Album (Move)</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Items being moved summary */}
              <div className="rounded-2xl border border-border/80 bg-muted/30 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Album ដែលត្រូវផ្លាស់ទី៖</span>
                  <span className="font-bold text-gold">
                    {toKhmerNumber(movingAlbums.length)} Albums
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {movingAlbums.map((alb) => (
                    <div
                      key={alb.id}
                      className="truncate rounded-md bg-background/80 px-2 py-1 text-[11px] border border-border/50 text-foreground"
                    >
                      📁 {alb.title}
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  ជ្រើសរើសទីតាំងគោលដៅ (Destination Parent)៖
                </Label>

                {/* Option 1: Root Album */}
                <button
                  type="button"
                  onClick={() => setTargetParentId(null)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer",
                    targetParentId === null
                      ? "border-gold bg-gold/10 ring-2 ring-gold/40 shadow-xs"
                      : "border-border/80 bg-card hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🏠</span>
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        កម្រិត Root (ថតចម្បង / No Parent)
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ដាក់ជា Album កម្រិតខ្ពស់បំផុត (គ្មាន Album មេ)
                      </div>
                    </div>
                  </div>
                  {targetParentId === null && (
                    <div className="rounded-full bg-gold text-primary-foreground p-1 shadow-xs">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>

                {/* Option 2: Candidate Parent Album Selection */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[11px] text-muted-foreground">
                    ឬជ្រើសរើសដាក់ចូលក្នុង Album មេណាមួយ (Sub-album) ៖
                  </Label>

                  {candidateParents.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground p-3 rounded-xl border border-dashed border-border bg-card/40 text-center">
                      គ្មាន Album ផ្សេងទៀតក្នុងឆ្នាំ និងបុណ្យនេះដែលអាចជ្រើសជាមេបានឡើយ។
                    </p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 rounded-2xl border border-border/70 bg-background/50">
                      {candidateParents.map((cand) => {
                        const isTarget = targetParentId === cand.id;
                        return (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => setTargetParentId(cand.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                              isTarget
                                ? "border-gold bg-gold/15 ring-2 ring-gold/40 shadow-xs"
                                : "border-border/60 bg-card hover:bg-secondary/60",
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-base shrink-0">📁</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-foreground truncate">
                                  {cand.title}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                  <span>{toKhmerNumber(cand.photoCount)} រូប</span>
                                  {cand.parentAlbumId && (
                                    <span className="text-blue-500 font-medium">↳ Sub-album</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {isTarget && (
                              <div className="shrink-0 rounded-full bg-gold text-primary-foreground p-1 shadow-xs">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Preservation note */}
              <p className="text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40">
                ℹ️ ការផ្លាស់ទី (Move) នឹងរក្សារាល់ ID, URL, រូបថត, ការចូលចិត្ត, និងទិន្នន័យទាំងអស់នៃ Album ដដែល ដោយគ្រាន់តែកែប្រែទំនាក់ទំនងឋានានុក្រម និងលំដាប់លំដោយប៉ុណ្ណោះ។
              </p>

              <DialogFooter className="mt-5 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsMoveOpen(false)}
                  className="rounded-full h-9 text-xs"
                >
                  បោះបង់
                </Button>
                <Button
                  type="button"
                  disabled={moveAlbumsMutation.isPending || movingAlbums.length === 0}
                  onClick={handleExecuteMove}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 h-9 text-xs font-medium px-5"
                >
                  {moveAlbumsMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> កំពុងផ្លាស់ទី...
                    </>
                  ) : (
                    <>
                      <FolderInput className="mr-1.5 h-3.5 w-3.5" /> បញ្ជាក់ការផ្លាស់ទី
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal: Paste Album(s) */}
        <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Copy className="h-5 w-5" />
                <span>បិទភ្ជាប់ Album (Paste)</span>
              </DialogTitle>
            </DialogHeader>

            {clipboard && (
              <div className="space-y-4 pt-2">
                {/* Items being pasted summary */}
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>Album ដែលត្រូវចម្លង៖</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {toKhmerNumber(clipboard.sourceAlbumIds.length)} Albums
                    </span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {clipboard.sourceTitles.map((title, idx) => (
                      <div
                        key={idx}
                        className="truncate rounded-md bg-background/80 px-2 py-1 text-[11px] border border-border/50 text-foreground"
                      >
                        📋 {title}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Destination info */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                  <div>
                    គោលដៅ៖ ពិធីបុណ្យ <strong>{festivals.find((f) => f.id === (selectedFestival !== "all" ? selectedFestival : clipboard.sourceFestivalId))?.name || (selectedFestival !== "all" ? selectedFestival : clipboard.sourceFestivalId)}</strong>, ឆ្នាំ <strong>{selectedYear !== "all" ? selectedYear : clipboard.sourceYear}</strong>
                  </div>
                </div>

                {/* Destination parent selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-foreground">
                    ជ្រើសរើសទីតាំងដាក់ Album ចម្លង៖
                  </Label>

                  {/* Option 1: Root Album */}
                  <button
                    type="button"
                    onClick={() => setPasteTargetParentId(null)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer",
                      pasteTargetParentId === null
                        ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/40 shadow-xs"
                        : "border-border/80 bg-card hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🏠</span>
                      <div>
                        <div className="font-semibold text-xs text-foreground">
                          កម្រិត Root (ថតចម្បង / No Parent)
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          ដាក់ជា Album កម្រិតខ្ពស់បំផុត (គ្មាន Album មេ)
                        </div>
                      </div>
                    </div>
                    {pasteTargetParentId === null && (
                      <div className="rounded-full bg-blue-600 text-white p-1 shadow-xs">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {/* Option 2: Candidate Parent Album Selection */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[11px] text-muted-foreground">
                      ឬជ្រើសរើសដាក់ចូលក្នុង Album មេណាមួយ (Sub-album) ៖
                    </Label>

                    {isPasteDestinationLoading && candidatePasteParents.length === 0 ? (
                      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                        កំពុងទាញយកបញ្ជី Album...
                      </div>
                    ) : candidatePasteParents.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground p-3 rounded-xl border border-dashed border-border bg-card/40 text-center">
                        គ្មាន Album ក្នុងឆ្នាំ និងបុណ្យនេះដែលអាចជ្រើសជាមេបានឡើយ (នឹងដាក់នៅ Root)។
                      </p>
                    ) : (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 rounded-2xl border border-border/70 bg-background/50">
                        {candidatePasteParents.map((cand) => {
                          const isTarget = pasteTargetParentId === cand.id;
                          return (
                            <button
                              key={cand.id}
                              type="button"
                              onClick={() => setPasteTargetParentId(cand.id)}
                              className={cn(
                                "w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                                isTarget
                                  ? "border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/40 shadow-xs"
                                  : "border-border/60 bg-card hover:bg-secondary/60",
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="text-base shrink-0">📁</span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-foreground truncate">
                                    {cand.title}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                    <span>{toKhmerNumber(cand.photoCount)} រូប</span>
                                    {cand.parentAlbumId && (
                                      <span className="text-blue-500 font-medium">↳ Sub-album</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isTarget && (
                                <div className="shrink-0 rounded-full bg-blue-600 text-white p-1 shadow-xs">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Option A Structure note */}
                <p className="text-[10px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40">
                  ℹ️ ការចម្លង (Option A) នឹងចម្លងរចនាសម្ព័ន្ធ និងព័ត៌មាន Album (Title «... (ចម្លង)», Description, Location)។ Album ថ្មីនឹងចាប់ផ្ដើមដោយគ្មានរូបថត (0 រូប) ដើម្បីសុវត្ថិភាពទិន្នន័យរូបភាពដើម។
                </p>

                <DialogFooter className="mt-5 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPasteOpen(false)}
                    className="rounded-full h-9 text-xs"
                  >
                    បោះបង់
                  </Button>
                  <Button
                    type="button"
                    disabled={copyAlbumsMutation.isPending || clipboard.sourceAlbumIds.length === 0}
                    onClick={handleExecutePaste}
                    className="rounded-full bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs font-medium px-5"
                  >
                    {copyAlbumsMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> កំពុងបិទភ្ជាប់...
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> បញ្ជាក់ការបិទភ្ជាប់ (Paste)
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
