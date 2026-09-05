import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Video,
  Upload,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Eye,
  Film,
  Calendar,
  Sparkles,
  FolderKanban,
  AlertTriangle,
  Loader2,
  FileVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useAdminVideos,
  useAdminAlbums,
  useAdminFestivals,
  useAdminYears,
  useUploadVideo,
  useTrashVideo,
  type AdminVideo,
} from "@/hooks/useAdminData";
import { toKhmerNumber } from "@/data/archive";

type VideoSearch = {
  festivalId?: string | undefined;
  year?: string | number | undefined;
  albumId?: string | undefined;
  search?: string | undefined;
};

export const Route = createFileRoute("/admin/videos")({
  validateSearch: (search: Record<string, unknown>): VideoSearch => ({
    festivalId: typeof search["festivalId"] === "string" ? search["festivalId"] : undefined,
    year:
      typeof search["year"] === "string" || typeof search["year"] === "number"
        ? search["year"]
        : undefined,
    albumId: typeof search["albumId"] === "string" ? search["albumId"] : undefined,
    search: typeof search["search"] === "string" ? search["search"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "គ្រប់គ្រងវីដេអូ & Upload — Wat Peareang Admin" }],
  }),
  component: AdminVideosPage,
});

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function AdminVideosPage() {
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = useAuth();
  const routeSearch = Route.useSearch();

  // Filters state
  const [search, setSearch] = useState(routeSearch.search || "");
  const [selectedFestival, setSelectedFestival] = useState<string>(routeSearch.festivalId || "all");
  const [selectedYear, setSelectedYear] = useState<string>(
    routeSearch.year ? String(routeSearch.year) : "all",
  );
  const [selectedAlbum, setSelectedAlbum] = useState<string>(routeSearch.albumId || "all");

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
          to: "/admin/videos",
          search: (prev: VideoSearch) => ({
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

  // Filtered albums for current filter dropdown
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

  // Fetch Public Videos
  const { data: videosData, isLoading: loading, refetch } = useAdminVideos({
    albumId: selectedAlbum !== "all" ? selectedAlbum : undefined,
    status: "published",
  });

  const rawVideos = useMemo(() => videosData?.videos || [], [videosData?.videos]);

  // Client-side search and year/festival filtering for videos
  const videos = useMemo(() => {
    let list = rawVideos;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.filename.toLowerCase().includes(q) ||
          (v.description && v.description.toLowerCase().includes(q)),
      );
    }
    if (selectedFestival !== "all" || selectedYear !== "all") {
      // Find valid album IDs under the selected festival/year
      const validAlbumIds = new Set(filteredAlbums.map((a) => a.id));
      list = list.filter((v) => validAlbumIds.has(v.albumId));
    }
    return list;
  }, [rawVideos, search, selectedFestival, selectedYear, filteredAlbums]);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadYear, setUploadYear] = useState<number>(2027);
  const [uploadFestivalId, setUploadFestivalId] = useState<string>("");
  const [uploadAlbumId, setUploadAlbumId] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trashing modal state
  const [trashingVideo, setTrashingVideo] = useState<AdminVideo | null>(null);

  // Mutations
  const uploadVideoMutation = useUploadVideo();
  const trashVideoMutation = useTrashVideo();

  const canUpload = isSuperAdmin || hasPermission("upload_images");
  const canDelete = isSuperAdmin || hasPermission("delete_images");

  // Albums for the upload modal
  const uploadFilteredAlbums = useMemo(() => {
    return albums.filter((a) => {
      const matchYear = !uploadYear || a.year === uploadYear;
      const matchFestival = !uploadFestivalId || a.festivalId === uploadFestivalId;
      return matchYear && matchFestival;
    });
  }, [albums, uploadYear, uploadFestivalId]);

  // Open upload modal with preselected album if filter is active
  const handleOpenUploadModal = () => {
    if (selectedAlbum !== "all") {
      const target = albums.find((a) => a.id === selectedAlbum);
      if (target) {
        setUploadYear(target.year);
        setUploadFestivalId(target.festivalId);
        setUploadAlbumId(target.id);
      }
    } else {
      if (years.length > 0 && years[0]) setUploadYear(years[0]);
      if (festivals.length > 0 && festivals[0]) setUploadFestivalId(festivals[0].id);
    }
    setSelectedFile(null);
    setUploadTitle("");
    setUploadDescription("");
    setIsUploadOpen(true);
  };

  // Handle file picker selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("ទំហំវីដេអូធំជាងកំណត់ (អតិបរមា 100MB)។");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validate type
    const validMimes = ["video/mp4", "video/webm", "video/quicktime"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["mp4", "webm", "mov"];

    if (!validMimes.includes(file.type.toLowerCase()) && (!ext || !validExts.includes(ext))) {
      toast.error("ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែវីដេអូ MP4, WebM, MOV ប៉ុណ្ណោះ។");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    if (!uploadTitle.trim()) {
      // Default title from filename without extension
      setUploadTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    }
  };

  // Submit Video Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("សូមជ្រើសរើសឯកសារវីដេអូដែលត្រូវ Upload។");
      return;
    }

    if (!uploadAlbumId) {
      toast.error("សូមជ្រើសរើស Album គោលដៅ។");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("albumId", uploadAlbumId);
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim());
      if (uploadDescription.trim()) formData.append("description", uploadDescription.trim());

      await uploadVideoMutation.mutateAsync(formData);

      toast.success("បានបង្ហោះវីដេអូដោយជោគជ័យ!");
      setIsUploadOpen(false);
      setSelectedFile(null);
      setUploadTitle("");
      setUploadDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការ Upload វីដេអូ។";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Trash Video
  const handleConfirmTrash = async () => {
    if (!trashingVideo) return;
    try {
      await trashVideoMutation.mutateAsync(trashingVideo.id);
      toast.success(`បានផ្លាស់ទីវីដេអូ «${trashingVideo.title}» ទៅកាន់ធុងសំរាមរួចរាល់។`);
      setTrashingVideo(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការផ្លាស់ទីវីដេអូទៅកាន់ធុងសំរាម។";
      toast.error(msg);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedFestival("all");
    setSelectedYear("all");
    setSelectedAlbum("all");
    navigate({
      to: "/admin/videos",
      search: {},
      replace: true,
    });
  };

  return (
    <AdminLayout requiredPermission="view_images">
      <div className="space-y-6">
        {/* Media Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Button
            asChild
            variant="ghost"
            className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Link to="/admin/images">
              <span className="mr-2">🖼️</span> គ្រប់គ្រងរូបភាព (Images)
            </Link>
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl px-4 py-2 text-sm font-bold bg-gold/15 text-gold hover:bg-gold/20 shadow-xs"
          >
            <span className="mr-2">🎬</span> គ្រប់គ្រងវីដេអូ (Videos)
          </Button>
        </div>

        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
                🎬 បណ្ណសារវីដេអូ
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                សរុប {toKhmerNumber(videos.length)} វីដេអូ
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              គ្រប់គ្រងវីដេអូ & Upload
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              បង្ហោះ និងគ្រប់គ្រងវីដេអូតាម Album ក្នុងប្រព័ន្ធបណ្ណសារវត្តពារាំង (MP4, WebM, MOV រហូតដល់ 100MB)។
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-full h-9 text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> ផ្ទុកឡើងវិញ
            </Button>

            {canUpload && (
              <Button
                onClick={handleOpenUploadModal}
                className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft h-9 text-xs gap-1.5"
              >
                <Upload className="h-4 w-4" /> បង្ហោះវីដេអូថ្មី
              </Button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid gap-3 sm:grid-cols-4 bg-card p-3.5 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកតាមចំណងជើង ឬឈ្មោះឯកសារ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl pl-10 h-10 text-xs bg-background"
            />
          </div>

          <select
            value={selectedFestival}
            onChange={(e) => {
              setSelectedFestival(e.target.value);
              setSelectedAlbum("all");
            }}
            className="rounded-xl border border-border bg-background px-3 h-10 text-xs text-foreground"
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
              setSelectedAlbum("all");
            }}
            className="rounded-xl border border-border bg-background px-3 h-10 text-xs text-foreground"
          >
            <option value="all">📅 គ្រប់ឆ្នាំទាំងអស់</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                ឆ្នាំ {toKhmerNumber(y)}
              </option>
            ))}
          </select>

          <select
            value={selectedAlbum}
            onChange={(e) => setSelectedAlbum(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 h-10 text-xs text-foreground"
          >
            <option value="all">📁 គ្រប់ Albums ទាំងអស់ ({filteredAlbums.length})</option>
            {filteredAlbums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({toKhmerNumber(a.year)})
              </option>
            ))}
          </select>
        </div>

        {/* Active Filters Bar */}
        {(selectedFestival !== "all" || selectedYear !== "all" || selectedAlbum !== "all" || search.trim()) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>តម្រងសកម្ម៖</span>
            {search.trim() && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                ស្វែងរក: «{search}»
              </span>
            )}
            {selectedFestival !== "all" && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                បុណ្យ: {festivals.find((f) => f.id === selectedFestival)?.name || selectedFestival}
              </span>
            )}
            {selectedYear !== "all" && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                ឆ្នាំ: {toKhmerNumber(selectedYear)}
              </span>
            )}
            {selectedAlbum !== "all" && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                Album: {albums.find((a) => a.id === selectedAlbum)?.title || selectedAlbum}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2 rounded-full"
            >
              <X className="h-3 w-3 mr-1" /> សម្អាតតម្រង
            </Button>
          </div>
        )}

        {/* Videos Grid / Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
              <p className="text-xs text-muted-foreground">កំពុងផ្ទុកបញ្ជីវីដេអូ...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <FileVideo className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-display font-bold text-foreground">មិនទាន់មានវីដេអូនៅឡើយទេ</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              មិនមានវីដេអូណាមួយដែលត្រូវគ្នានឹងតម្រងដែលបានជ្រើសរើសឡើយ។ លោកអ្នកអាចបង្ហោះវីដេអូថ្មីចូលក្នុង Album បាន។
            </p>
            {canUpload && (
              <Button
                onClick={handleOpenUploadModal}
                className="mt-4 rounded-full bg-gold text-primary-foreground hover:bg-gold/90 text-xs gap-1.5"
              >
                <Upload className="h-4 w-4" /> បង្ហោះវីដេអូដំបូង
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((vid) => {
              const album = albums.find((a) => a.id === vid.albumId);
              return (
                <div
                  key={vid.id}
                  className="group flex flex-col rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs transition-all hover:shadow-md hover:border-gold/40"
                >
                  {/* HTML5 Native Video Player */}
                  <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      src={vid.url}
                      className="h-full w-full object-contain"
                    />
                    <div className="absolute top-2 left-2 z-10 pointer-events-none">
                      <span className="rounded-full bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        {vid.mimeType.split("/")[1] || "VIDEO"}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 z-10 pointer-events-none">
                      <span className="rounded-full bg-black/70 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono text-white">
                        {formatFileSize(vid.size)}
                      </span>
                    </div>
                  </div>

                  {/* Video Metadata Card Body */}
                  <div className="flex flex-1 flex-col p-4 justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <FolderKanban className="h-3 w-3 text-gold shrink-0" />
                        <span className="truncate font-medium text-foreground">
                          {album?.title || vid.albumId}
                        </span>
                        {album && (
                          <span className="rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-bold">
                            {toKhmerNumber(album.year)}
                          </span>
                        )}
                      </div>

                      <h3
                        className="mt-1 font-display text-sm font-bold text-foreground line-clamp-1"
                        title={vid.title}
                      >
                        {vid.title}
                      </h3>

                      {vid.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {vid.description}
                        </p>
                      )}

                      <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
                        ឯកសារ: {vid.filename}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(vid.createdAt).toLocaleDateString("km-KH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>

                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTrashingVideo(vid)}
                          className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> ធុងសំរាម
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload Video Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-gold" /> បង្ហោះវីដេអូថ្មី (Upload Video)
              </DialogTitle>
              <DialogDescription className="text-xs">
                ជ្រើសរើស Album គោលដៅ និងឯកសារវីដេអូ (MP4, WebM, MOV ទំហំអតិបរមា 100MB)។
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-2">
              {/* Hierarchical Album Selection */}
              <div className="space-y-2 rounded-xl bg-muted/40 p-3 border border-border/60">
                <Label className="text-xs font-bold">១. ជ្រើសរើស Album គោលដៅ *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">ឆ្នាំ</Label>
                    <select
                      value={uploadYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setUploadYear(y);
                        setUploadAlbumId("");
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2.5 h-8 text-xs"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          ឆ្នាំ {toKhmerNumber(y)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">ពិធីបុណ្យ</Label>
                    <select
                      value={uploadFestivalId}
                      onChange={(e) => {
                        setUploadFestivalId(e.target.value);
                        setUploadAlbumId("");
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2.5 h-8 text-xs"
                    >
                      <option value="">-- ជ្រើសរើសបុណ្យ --</option>
                      {festivals.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.emoji} {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Album *</Label>
                  <select
                    value={uploadAlbumId}
                    onChange={(e) => setUploadAlbumId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-border bg-background px-2.5 h-8 text-xs"
                  >
                    <option value="">-- ជ្រើសរើស Album --</option>
                    {uploadFilteredAlbums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                  {uploadFilteredAlbums.length === 0 && (
                    <p className="text-[10px] text-destructive mt-1">
                      មិនមាន Album សម្រាប់ឆ្នាំ និងពិធីបុណ្យដែលបានជ្រើសរើសឡើយ។ សូមបង្កើត Album ជាមុនសិន។
                    </p>
                  )}
                </div>
              </div>

              {/* File Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">២. ជ្រើសរើសឯកសារវីដេអូ *</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-gold/60 transition-colors bg-muted/20"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <Film className="h-8 w-8 text-gold animate-bounce" />
                      <span className="text-xs font-bold text-foreground break-all">
                        {selectedFile.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ទំហំ៖ {formatFileSize(selectedFile.size)} ({selectedFile.type || "video"})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="h-6 text-[10px] text-destructive hover:bg-destructive/10 px-2 rounded-full mt-1"
                      >
                        ជ្រើសរើសឯកសារផ្សេង
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <FileVideo className="h-8 w-8 text-muted-foreground/60 mb-1" />
                      <span className="text-xs font-semibold text-foreground">
                        ចុចទីនេះដើម្បីជ្រើសរើសវីដេអូ
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        អនុញ្ញាតតែ MP4, WebM, QuickTime MOV (អតិបរមា 100MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">ចំណងជើងវីដេអូ</Label>
                  <Input
                    placeholder="ឧ. សកម្មភាពពិធីបុណ្យចូលឆ្នាំ..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">ការពិពណ៌នាបន្ថែម (Description)</Label>
                  <Textarea
                    placeholder="ព័ត៌មានលម្អិតអំពីវីដេអូ..."
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="text-xs"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploading || !selectedFile || !uploadAlbumId}
                  className="bg-gold text-primary-foreground hover:bg-gold/90 text-xs gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      កំពុង Upload វីដេអូ...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" />
                      បង្ហោះវីដេអូ
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Trashing Confirmation Dialog */}
        <Dialog open={Boolean(trashingVideo)} onOpenChange={(open) => !open && setTrashingVideo(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" /> ផ្លាស់ទីវីដេអូទៅកាន់ធុងសំរាម
              </DialogTitle>
              <DialogDescription className="text-xs">
                តើលោកអ្នកពិតជាចង់ផ្លាស់ទីវីដេអូ «{trashingVideo?.title}» ទៅកាន់ធុងសំរាមមែនឬទេ? លោកអ្នកអាចស្តារវីដេអូនេះត្រឡប់មកវិញបានគ្រប់ពេលពីទំព័រធុងសំរាម (Trash)។
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTrashingVideo(null)}
                className="text-xs"
              >
                បោះបង់
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmTrash}
                disabled={trashVideoMutation.isPending}
                className="text-xs gap-1.5"
              >
                {trashVideoMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                ផ្លាស់ទីទៅធុងសំរាម
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

