import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Upload,
  Trash2,
  Search,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Eye,
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
import { Lightbox, type LightboxPhoto } from "@/components/site/Lightbox";
import { toast } from "sonner";
import {
  useAdminImages,
  useAdminAlbums,
  useAdminFestivals,
  useAdminYears,
  useUploadImage,
  useUpdateImage,
  useTrashImage,
  useCreateAlbum,
  type AdminImage,
} from "@/hooks/useAdminData";
import { resolveImageUrl } from "@/lib/asset-resolver";
import { toKhmerNumber } from "@/data/archive";

type ImageSearch = {
  festivalId?: string | undefined;
  year?: string | number | undefined;
  albumId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/admin/images")({
  validateSearch: (search: Record<string, unknown>): ImageSearch => ({
    festivalId: typeof search["festivalId"] === "string" ? search["festivalId"] : undefined,
    year:
      typeof search["year"] === "string" || typeof search["year"] === "number"
        ? search["year"]
        : undefined,
    albumId: typeof search["albumId"] === "string" ? search["albumId"] : undefined,
    search: typeof search["search"] === "string" ? search["search"] : undefined,
    page: typeof search["page"] === "number" ? search["page"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "គ្រប់គ្រងរូបភាព & Upload — Wat Peareang Admin" }],
  }),
  component: AdminImagesPage,
});

function AdminImagesPage() {
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = useAuth();
  const routeSearch = Route.useSearch();

  // Filters & Pagination state
  const [search, setSearch] = useState(routeSearch.search || "");
  const [selectedFestival, setSelectedFestival] = useState<string>(routeSearch.festivalId || "all");
  const [selectedYear, setSelectedYear] = useState<string>(
    routeSearch.year ? String(routeSearch.year) : "all",
  );
  const [selectedAlbum, setSelectedAlbum] = useState<string>(routeSearch.albumId || "all");
  const [page, setPage] = useState(routeSearch.page || 1);

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Queries
  const { data: festivals = [] } = useAdminFestivals();
  const { data: years = [] } = useAdminYears();
  const { data: albumsData } = useAdminAlbums({ limit: 500 });
  const albums = useMemo(() => albumsData?.albums || [], [albumsData?.albums]);

  // Validate routeSearch.albumId against active albums
  useEffect(() => {
    if (!albumsData) return;
    const urlAlbumId = routeSearch.albumId;
    if (urlAlbumId && urlAlbumId !== "all") {
      const exists = albums.some((a) => a.id === urlAlbumId);
      if (!exists) {
        toast.warning("Album ដែលបានជ្រើសរើសមិនមាន ឬត្រូវបានផ្លាស់ទីទៅកាន់ធុងសំរាមរួចហើយ។");
        setSelectedAlbum("all");
        navigate({
          to: "/admin/images",
          search: (prev: ImageSearch) => ({
            ...prev,
            albumId: undefined,
          }),
          replace: true,
        });
      } else if (selectedAlbum !== urlAlbumId) {
        setSelectedAlbum(urlAlbumId);
      }
    } else if (!urlAlbumId && selectedAlbum !== "all") {
      setSelectedAlbum("all");
    }
  }, [albumsData, routeSearch.albumId, albums, navigate, selectedAlbum]);

  // Matching albums for target selection
  const filteredAlbums = useMemo(() => {
    return albums.filter((a) => {
      const matchYear = selectedYear === "all" || a.year === Number(selectedYear);
      const matchFestival =
        selectedFestival === "all" ||
        a.festivalId === selectedFestival ||
        a.id.startsWith(selectedFestival);
      return matchYear && matchFestival;
    });
  }, [albums, selectedYear, selectedFestival]);

  // Direct Image Query (Year + Festival -> Images directly)
  const { data: imagesData, isLoading: loading } = useAdminImages({
    page,
    limit: 24,
    search: search.trim() || undefined,
    festivalId: selectedFestival !== "all" ? selectedFestival : undefined,
    year: selectedYear !== "all" ? Number(selectedYear) : undefined,
    albumId: selectedAlbum !== "all" ? selectedAlbum : undefined,
  });

  const images = useMemo(() => imagesData?.images || [], [imagesData?.images]);
  const totalPages = imagesData?.totalPages || 1;
  const totalCount = imagesData?.total || 0;

  // Active filter objects
  const activeFestival = festivals.find((f) => f.id === selectedFestival);
  const isFilterActive =
    selectedFestival !== "all" ||
    selectedYear !== "all" ||
    selectedAlbum !== "all" ||
    search.trim().length > 0;

  // Lightbox photos mapping
  const lightboxPhotos: LightboxPhoto[] = useMemo(() => {
    return images.map((img) => ({
      id: img.id,
      src: resolveImageUrl(img.url),
      caption: `${img.title} (${img.albumTitle || img.albumId})`,
    }));
  }, [images]);

  // Mutations
  const uploadImageMutation = useUploadImage();
  const createAlbumMutation = useCreateAlbum();
  const updateImageMutation = useUpdateImage();
  const trashImageMutation = useTrashImage();

  // Upload modal hierarchical state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadYear, setUploadYear] = useState<number>(2027);
  const [uploadFestivalId, setUploadFestivalId] = useState<string>("");
  const [uploadAlbumId, setUploadAlbumId] = useState<string>("");
  const [isCreatingNewAlbum, setIsCreatingNewAlbum] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadPhotographer, setUploadPhotographer] = useState("វត្តពារាំង");
  const [uploadTags, setUploadTags] = useState("");
  const [fileList, setFileList] = useState<Array<{ id: string; previewUrl: string; file: File }>>(
    [],
  );
  const [isUploading, setIsUploading] = useState(false);

  // Edit modal state
  const [editingImage, setEditingImage] = useState<AdminImage | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPhotographer, setEditPhotographer] = useState("");
  const [editTags, setEditTags] = useState("");

  const canUpload = isSuperAdmin || hasPermission("upload_images");
  const canEdit = isSuperAdmin || hasPermission("edit_images");
  const canDelete = isSuperAdmin || hasPermission("delete_images");

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setSelectedFestival("all");
    setSelectedYear("all");
    setSelectedAlbum("all");
    setPage(1);
    navigate({
      to: "/admin/images",
      search: {},
      replace: true,
    });
  };

  // Open Upload modal with defaults
  const openUploadModal = () => {
    if (selectedYear !== "all") {
      setUploadYear(Number(selectedYear));
    } else if (years.length > 0 && years[0]) {
      setUploadYear(years[0]);
    }

    if (selectedFestival !== "all") {
      setUploadFestivalId(selectedFestival);
    } else if (festivals.length > 0 && festivals[0]) {
      setUploadFestivalId(festivals[0].id);
    }

    const isValidSelectedAlbum =
      selectedAlbum !== "all" && albums.some((a) => a.id === selectedAlbum);

    if (isValidSelectedAlbum) {
      setUploadAlbumId(selectedAlbum);
    } else {
      // Do NOT automatically fallback to an arbitrary album - require explicit selection or creation
      setUploadAlbumId("");
    }
    setIsUploadOpen(true);
  };

  // File selection handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
    const newItems: Array<{ id: string; previewUrl: string; file: File }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      if (!allowedTypes.includes(f.type)) {
        toast.error(`ឯកសារ «${f.name}» មិនមែនជារូបភាពត្រឹមត្រូវទេ (JPG, PNG, WEBP, AVIF, GIF)`);
        continue;
      }
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`ឯកសារ «${f.name}» មានទំហំធំជាង 15MB`);
        continue;
      }

      newItems.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        previewUrl: URL.createObjectURL(f),
        file: f,
      });
    }

    setFileList((prev) => [...prev, ...newItems]);
  };

  const removeFileFromList = (id: string) => {
    setFileList((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  // Submit Upload with real multipart FormData via useUploadImage mutation
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpload) {
      toast.error("លោកអ្នកគ្មានសិទ្ធិ Upload រូបភាពឡើយ។");
      return;
    }
    if (fileList.length === 0) {
      toast.error("សូមជ្រើសរើសរូបភាពយ៉ាងហោចណាស់មួយ។");
      return;
    }

    setIsUploading(true);

    try {
      let effectiveAlbumId = uploadAlbumId;

      // Create new album if requested
      if (isCreatingNewAlbum) {
        if (!newAlbumTitle.trim()) {
          toast.error("សូមបញ្ចូលចំណងជើង Album ថ្មី។");
          setIsUploading(false);
          return;
        }

        const effectiveFestivalId = uploadFestivalId || (festivals[0] ? festivals[0].id : "other");
        const canonicalId = `${effectiveFestivalId}-${uploadYear}`;

        const createdAlbum = await createAlbumMutation.mutateAsync({
          title: newAlbumTitle.trim(),
          year: uploadYear,
          festivalId: effectiveFestivalId,
          description: `Album ពិធីបុណ្យ ${newAlbumTitle.trim()} ឆ្នាំ ${uploadYear}`,
        });

        if (createdAlbum?.id) {
          effectiveAlbumId = createdAlbum.id;
        } else {
          effectiveAlbumId = canonicalId;
        }
      }

      if (!effectiveAlbumId) {
        toast.error("សូមជ្រើសរើស ឬបង្កើត Album គោលដៅជាមុនសិន។");
        setIsUploading(false);
        return;
      }

      if (!isCreatingNewAlbum) {
        const targetAlbumExists = albums.some((a) => a.id === effectiveAlbumId);
        if (!targetAlbumExists) {
          toast.error("Album គោលដៅមិនមាន ឬត្រូវបានផ្លាស់ទីទៅកាន់ធុងសំរាមរួចហើយ។");
          setIsUploading(false);
          return;
        }
      }

      let successCount = 0;
      const parsedTags = uploadTags
        ? uploadTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      // Upload items sequentially
      for (const item of fileList) {
        try {
          const itemTitle = uploadTitle.trim()
            ? uploadTitle.trim()
            : item.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("albumId", effectiveAlbumId);
          formData.append("title", itemTitle);
          if (uploadPhotographer.trim()) {
            formData.append("photographer", uploadPhotographer.trim());
          }
          if (parsedTags && parsedTags.length > 0) {
            formData.append("tags", parsedTags.join(", "));
          }

          await uploadImageMutation.mutateAsync(formData);
          successCount++;
        } catch (err: unknown) {
          console.error("Upload error:", err);
          const msg = err instanceof Error ? err.message : "បរាជ័យ";
          toast.error(`មិនអាច Upload «${item.file.name}»: ${msg}`);
        }
      }

      fileList.forEach((item) => URL.revokeObjectURL(item.previewUrl));

      if (successCount > 0) {
        toast.success(`បានបង្ហោះរូបភាព ${successCount} សន្លឹកដោយជោគជ័យ!`);
        setIsUploadOpen(false);
        setFileList([]);
        setUploadTitle("");
        setUploadTags("");
        setIsCreatingNewAlbum(false);
        setNewAlbumTitle("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងដំណើរការ Upload";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;

    try {
      const parsedTags = editTags
        ? editTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;

      await updateImageMutation.mutateAsync({
        id: editingImage.id,
        albumId: editingImage.albumId,
        title: editTitle.trim(),
        photographer: editPhotographer.trim(),
        tags: parsedTags,
      });

      toast.success("បានកែសម្រួលព័ត៌មានរូបភាពជោគជ័យ!");
      setEditingImage(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកែប្រែរូបភាព។";
      toast.error(errorMsg);
    }
  };

  // Soft Delete Image (Moves to Trash)
  const handleDeleteImage = async (img: AdminImage) => {
    if (!canDelete) {
      toast.error("លោកអ្នកគ្មានសិទ្ធិលុបរូបភាពឡើយ។");
      return;
    }
    if (
      !confirm(
        `តើលោកអ្នកពិតជាចង់ផ្លាស់ទីរូបភាព «${img.title}» ទៅកាន់ធុងសំរាម (Trash) មែនឬទេ?\n(អ្នកអាចស្តារឡើងវិញបានគ្រប់ពេល)`,
      )
    ) {
      return;
    }

    try {
      await trashImageMutation.mutateAsync({ id: img.id, albumId: img.albumId });
      toast.success("បានផ្លាស់ទីរូបភាពទៅកាន់ធុងសំរាមរួចរាល់។");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការលុបរូបភាព។";
      toast.error(errorMsg);
    }
  };

  return (
    <AdminLayout requiredPermission="view_images">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
                📸 គ្រប់គ្រងរូបភាព
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                សរុប {totalCount.toLocaleString()} រូបភាព
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              គ្រប់គ្រងរូបភាព & Upload
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              រុករករូបភាពផ្ទាល់តាម ឆ្នាំ និង ពិធីបុណ្យ កែសម្រួលព័ត៌មាន បង្ហោះរូបភាពថ្មី
              ឬផ្លាស់ទីរូបភាពទៅកាន់ធុងសំរាម។
            </p>
          </div>

          {canUpload && (
            <Button
              onClick={openUploadModal}
              className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
            >
              <Upload className="mr-1.5 h-4 w-4" /> + បង្ហោះរូបភាពថ្មី
            </Button>
          )}
        </div>

        {/* Direct Filters: Search, Year, Festival, Album */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកតាមចំណងជើងរូប..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl pl-10 h-10 text-xs bg-card"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* 📅 1. Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedAlbum("all");
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground shadow-sm"
          >
            <option value="all">📅 គ្រប់ឆ្នាំទាំងអស់</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                ឆ្នាំ {y} ({toKhmerNumber(y)})
              </option>
            ))}
          </select>

          {/* 🎉 2. Festival Filter */}
          <select
            value={selectedFestival}
            onChange={(e) => {
              setSelectedFestival(e.target.value);
              setSelectedAlbum("all");
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground shadow-sm"
          >
            <option value="all">🎉 គ្រប់ពិធីបុណ្យទាំងអស់</option>
            {festivals.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji} {f.name}
              </option>
            ))}
          </select>

          {/* 🖼️ 3. Optional Album Target Filter */}
          <select
            value={selectedAlbum}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAlbum(val);
              setPage(1);
              navigate({
                to: "/admin/images",
                search: (prev: ImageSearch) => ({
                  ...prev,
                  albumId: val === "all" ? undefined : val,
                  page: 1,
                }),
                replace: true,
              });
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground shadow-sm"
          >
            <option value="all">🖼️ គ្រប់ Albums ទាំងអស់ ({filteredAlbums.length})</option>
            {filteredAlbums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.year})
              </option>
            ))}
          </select>
        </div>

        {/* Active Selection Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-soft text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">📍 កំពុងបង្ហាញរូបភាពនៃ៖</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
              {selectedYear !== "all"
                ? `📅 ឆ្នាំ ${selectedYear} (${toKhmerNumber(Number(selectedYear))})`
                : "📅 គ្រប់ឆ្នាំ"}
            </span>
            <span className="text-muted-foreground">➔</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
              {activeFestival
                ? `${activeFestival.emoji} ${activeFestival.name}`
                : "🎉 គ្រប់ពិធីបុណ្យ"}
            </span>
            {selectedAlbum !== "all" && (
              <>
                <span className="text-muted-foreground">➔</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-foreground">
                  🖼️ {albums.find((a) => a.id === selectedAlbum)?.title || selectedAlbum}
                </span>
              </>
            )}
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
            <span className="font-bold text-gold font-mono">
              📸 រកឃើញ៖ {totalCount.toLocaleString()} រូបភាព
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

        {/* Direct Images Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
              កំពុងទាញយករូបភាពពីបណ្ណសារ...
            </div>
          ) : images.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground rounded-3xl border border-border/80 bg-card space-y-3">
              <p>រកមិនឃើញរូបភាពដែលត្រូវនឹងការជ្រើសរើសឡើយ។</p>
              {isFilterActive && (
                <Button
                  onClick={handleResetFilters}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  ជម្រះការច្រោះទាំងអស់ (Show All)
                </Button>
              )}
            </div>
          ) : (
            images.map((img, idx) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft transition-all hover:shadow-card flex flex-col justify-between"
              >
                <div
                  onClick={() => setLightboxIndex(idx)}
                  className="aspect-square w-full overflow-hidden bg-secondary cursor-pointer relative"
                >
                  <img
                    src={resolveImageUrl(img.thumbnailUrl || img.url)}
                    alt={img.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = resolveImageUrl(null);
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-full p-1.5 backdrop-blur text-foreground">
                      <Eye className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <div className="p-2.5 space-y-1">
                  <p className="truncate text-xs font-semibold text-foreground" title={img.title}>
                    {img.title}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span className="truncate">{img.photographer || "វត្តពារាំង"}</span>
                    {img.size && <span>{(img.size / 1024).toFixed(0)} KB</span>}
                  </div>
                </div>

                {/* Hover Action Overlay */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingImage(img);
                        setEditTitle(img.title);
                        setEditPhotographer(img.photographer || "វត្តពារាំង");
                        setEditTags(
                          img.tags
                            ? Array.isArray(img.tags)
                              ? img.tags.join(", ")
                              : String(img.tags)
                            : "",
                        );
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground backdrop-blur hover:bg-gold hover:text-primary-foreground shadow-sm transition-colors"
                      title="កែសម្រួលព័ត៌មាន"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      disabled={trashImageMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(img);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full bg-background/90 text-destructive backdrop-blur hover:bg-destructive hover:text-destructive-foreground shadow-sm transition-colors"
                      title="ផ្លាស់ទីទៅធុងសំរាម"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border/60 text-xs">
            <span className="text-muted-foreground">
              ទំព័រទី {toKhmerNumber(page)} នៃ {toKhmerNumber(totalPages)} (សរុប{" "}
              {totalCount.toLocaleString()} រូប)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 rounded-xl px-2 text-xs"
              >
                <ChevronLeft className="h-4 w-4" /> មុន
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 rounded-xl px-2 text-xs"
              >
                បន្ទាប់ <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Upload Modal (Hierarchical Destination + File Dropzone) */}
        <Dialog
          open={isUploadOpen}
          onOpenChange={(v) => {
            if (!v) {
              fileList.forEach((item) => URL.revokeObjectURL(item.previewUrl));
              setIsUploadOpen(false);
              setFileList([]);
            }
          }}
        >
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-gold" /> បង្ហោះរូបភាពថ្មីទៅកាន់បណ្ណសារ
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {/* Destination Selector: Year + Festival + Album */}
              <div className="space-y-3 rounded-2xl border border-border/80 bg-secondary/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    🎯 ជ្រើសរើសគោលដៅ Album
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewAlbum(!isCreatingNewAlbum)}
                    className="text-xs font-semibold text-gold hover:underline"
                  >
                    {isCreatingNewAlbum ? "ជ្រើសរើស Album ដែលមានស្រាប់" : "+ បង្កើត Album ថ្មី"}
                  </button>
                </div>

                {!isCreatingNewAlbum ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">ឆ្នាំ</Label>
                        <select
                          value={uploadYear}
                          onChange={(e) => setUploadYear(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 h-9 text-xs"
                        >
                          {years.map((y) => (
                            <option key={y} value={y}>
                              ឆ្នាំ {y} ({toKhmerNumber(y)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">ពិធីបុណ្យ</Label>
                        <select
                          value={uploadFestivalId}
                          onChange={(e) => setUploadFestivalId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 h-9 text-xs"
                        >
                          {festivals.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.emoji} {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">ជ្រើសរើស Album</Label>
                      <select
                        value={uploadAlbumId}
                        onChange={(e) => setUploadAlbumId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 h-9 text-xs"
                      >
                        <option value="">-- សូមជ្រើសរើស Album --</option>
                        {albums
                          .filter(
                            (a) =>
                              (!uploadYear || a.year === uploadYear) &&
                              (!uploadFestivalId ||
                                a.festivalId === uploadFestivalId ||
                                a.id.startsWith(uploadFestivalId)),
                          )
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title} ({a.year})
                            </option>
                          ))}
                        {albums.length === 0 && <option value="">គ្មាន Album ត្រូវគ្នាទេ</option>}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">ឆ្នាំនៃ Album</Label>
                        <select
                          value={uploadYear}
                          onChange={(e) => setUploadYear(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 h-9 text-xs"
                        >
                          {years.map((y) => (
                            <option key={y} value={y}>
                              ឆ្នាំ {y} ({toKhmerNumber(y)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">ពិធីបុណ្យ</Label>
                        <select
                          value={uploadFestivalId}
                          onChange={(e) => setUploadFestivalId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-border bg-card px-2.5 h-9 text-xs"
                        >
                          {festivals.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.emoji} {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        ចំណងជើង Album ថ្មី
                      </Label>
                      <Input
                        value={newAlbumTitle}
                        onChange={(e) => setNewAlbumTitle(e.target.value)}
                        placeholder="ឧ. បុណ្យចូលឆ្នាំខ្មែរ ២០២៧"
                        className="mt-1 rounded-xl h-9 text-xs"
                        required={isCreatingNewAlbum}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ចំណងជើងរូបភាព (ទុកទំនេរដើម្បីយកឈ្មោះឯកសារ)</Label>
                  <Input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="រូបភាពបណ្ណសារវត្តពារាំង"
                    className="rounded-2xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">អ្នកថតរូប (Photographer)</Label>
                  <Input
                    value={uploadPhotographer}
                    onChange={(e) => setUploadPhotographer(e.target.value)}
                    className="rounded-2xl h-10 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ស្លាកសម្គាល់ (Tags - បំបែកដោយសញ្ញាក្បៀស , )</Label>
                <Input
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="ពិធីបុណ្យ, ព្រះសង្ឃ, ពុទ្ធបរិស័ទ"
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              {/* Dropzone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  ជ្រើសរើសរូបភាព (JPG, PNG, WEBP, AVIF, Max: 15MB)
                </Label>
                <div className="rounded-2xl border-2 border-dashed border-border/80 bg-secondary/30 p-6 text-center hover:border-gold transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                    id="admin-file-upload-input"
                  />
                  <label
                    htmlFor="admin-file-upload-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      ចុចទីនេះ ឬទម្លាក់រូបភាពដើម្បីជ្រើសរើស
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      អាចជ្រើសរើសរូបភាពច្រើនសន្លឹកក្នុងពេលតែមួយ
                    </span>
                  </label>
                </div>
              </div>

              {/* Selected Files Preview */}
              {fileList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    បានជ្រើសរើស {fileList.length} រូប៖
                  </p>
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1 border border-border/50 rounded-2xl bg-secondary/20">
                    {fileList.map((item) => (
                      <div
                        key={item.id}
                        className="group/img relative aspect-square rounded-xl overflow-hidden border border-border"
                      >
                        <img
                          src={item.previewUrl}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFileFromList(item.id)}
                          className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-white opacity-90 hover:opacity-100 shadow-sm"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    fileList.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                    setIsUploadOpen(false);
                    setFileList([]);
                  }}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading || fileList.length === 0}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {isUploading ? "កំពុងបង្ហោះ..." : `បង្ហោះរូបភាព (${fileList.length})`}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Image Modal */}
        <Dialog open={!!editingImage} onOpenChange={(v) => !v && setEditingImage(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-gold" /> កែសម្រួលព័ត៌មានរូបភាព
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              {editingImage && (
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/30 p-3">
                  <img
                    src={resolveImageUrl(editingImage.thumbnailUrl || editingImage.url)}
                    alt={editingImage.title}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      ID: {editingImage.id}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      Album: {editingImage.albumId}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ចំណងជើងរូបភាព</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">អ្នកថតរូប (Photographer)</Label>
                <Input
                  value={editPhotographer}
                  onChange={(e) => setEditPhotographer(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ស្លាកសម្គាល់ (Tags - បំបែកដោយសញ្ញាក្បៀស , )</Label>
                <Input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="បុណ្យ, ព្រះសង្ឃ, វត្តពារាំង"
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingImage(null)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={updateImageMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {updateImageMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុកការកែប្រែ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Fullscreen Lightbox Viewer */}
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
