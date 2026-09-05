import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  UploadCloud,
  Trash2,
  Edit,
  ArrowLeft,
  Folder,
  Image as ImageIcon,
  Video,
  Film,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  ShieldCheck,
  AlertTriangle,
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
  usePrivateArchiveSession,
  useUnlockPrivateArchive,
  useLockPrivateArchive,
  usePrivateAlbums,
  usePrivateAlbum,
  useCreatePrivateAlbum,
  useUpdatePrivateAlbum,
  useDeletePrivateAlbum,
  useUploadPrivateImage,
  useDeletePrivateImage,
  useUploadPrivateVideo,
  useDeletePrivateVideo,
  useChangePrivateCode,
  type PrivateAlbumItem,
  type PrivateImageItem,
  type PrivateVideoItem,
} from "@/hooks/usePrivateArchive";

export const Route = createFileRoute("/admin/private-archive")({
  head: () => ({
    meta: [{ title: "បណ្ណសារសម្ងាត់ — Wat Peareang Admin" }],
  }),
  component: AdminPrivateArchivePage,
});

function AdminPrivateArchivePage() {
  const { user, isSuperAdmin } = useAuth();
  const { data: sessionData, isLoading: checkingSession } = usePrivateArchiveSession();
  const unlockMutation = useUnlockPrivateArchive();
  const lockMutation = useLockPrivateArchive();

  // Navigation state: selected album id for viewing inside album
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // Unlock state
  const [accessCode, setAccessCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");

  const [editingAlbum, setEditingAlbum] = useState<PrivateAlbumItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [deletingAlbum, setDeletingAlbum] = useState<PrivateAlbumItem | null>(null);
  const [deletingImage, setDeletingImage] = useState<PrivateImageItem | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<PrivateVideoItem | null>(null);

  // Sub-tab inside album view: images vs videos
  const [mediaTab, setMediaTab] = useState<"images" | "videos">("images");

  // Change code modal (Super Admin)
  const [isChangeCodeOpen, setIsChangeCodeOpen] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState("");

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Uploading state inside album
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadVideoProgressText, setUploadVideoProgressText] = useState("");
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const createAlbumMutation = useCreatePrivateAlbum();
  const updateAlbumMutation = useUpdatePrivateAlbum();
  const deleteAlbumMutation = useDeletePrivateAlbum();
  const uploadImageMutation = useUploadPrivateImage();
  const deleteImageMutation = useDeletePrivateImage();
  const uploadVideoMutation = useUploadPrivateVideo();
  const deleteVideoMutation = useDeletePrivateVideo();
  const changeCodeMutation = useChangePrivateCode();

  // Data queries
  const isUnlocked = Boolean(sessionData?.unlocked);
  const { data: albums = [], isLoading: loadingAlbums } = usePrivateAlbums(isUnlocked);
  const { data: albumDetail, isLoading: loadingAlbumDetail } = usePrivateAlbum(
    selectedAlbumId || "",
    isUnlocked && Boolean(selectedAlbumId),
  );

  // Handlers
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      toast.error("សូមបញ្ចូលលេខកូដសម្ងាត់។");
      return;
    }
    try {
      await unlockMutation.mutateAsync(accessCode.trim());
      setAccessCode("");
      toast.success("បានដោះសោបណ្ណសារសម្ងាត់ដោយជោគជ័យ!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "លេខកូដមិនត្រឹមត្រូវឡើយ។";
      toast.error(msg);
    }
  };

  const handleLock = async () => {
    try {
      await lockMutation.mutateAsync();
      setSelectedAlbumId(null);
      setLightboxIndex(null);
      toast.success("បានចាក់សោបណ្ណសារសម្ងាត់រួចរាល់។");
    } catch {
      toast.error("មានបញ្ហាក្នុងការចាក់សោ។");
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumTitle.trim()) {
      toast.error("សូមបញ្ចូលចំណងជើង Album។");
      return;
    }
    try {
      await createAlbumMutation.mutateAsync({
        title: albumTitle.trim(),
        description: albumDescription.trim() || undefined,
      });
      setAlbumTitle("");
      setAlbumDescription("");
      setIsCreateOpen(false);
      toast.success("បានបង្កើត Album សម្ងាត់ជោគជ័យ!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "បរាជ័យក្នុងការបង្កើត Album";
      toast.error(msg);
    }
  };

  const handleUpdateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum || !editTitle.trim()) {
      toast.error("សូមបញ្ចូលចំណងជើង Album។");
      return;
    }
    try {
      await updateAlbumMutation.mutateAsync({
        id: editingAlbum.id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditingAlbum(null);
      toast.success("បានកែសម្រួល Album សម្ងាត់ជោគជ័យ!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "បរាជ័យក្នុងការកែសម្រួល Album";
      toast.error(msg);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!deletingAlbum) return;
    try {
      await deleteAlbumMutation.mutateAsync(deletingAlbum.id);
      if (selectedAlbumId === deletingAlbum.id) {
        setSelectedAlbumId(null);
      }
      setDeletingAlbum(null);
      toast.success("បានលុប Album សម្ងាត់ជោគជ័យ!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "បរាជ័យក្នុងការលុប Album";
      toast.error(msg);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedAlbumId) return;

    const fileList = Array.from(files);
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    const maxSizeBytes = 15 * 1024 * 1024; // 15MB

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      setUploadProgressText(`កំពុងបង្ហោះរូបភាពទី ${i + 1}/${fileList.length} (${file.name})...`);

      if (!validMimes.includes(file.type.toLowerCase())) {
        toast.error(`ឯកសារ «${file.name}» មិនមែនជារូបភាពត្រឹមត្រូវឡើយ`);
        failCount++;
        continue;
      }

      if (file.size > maxSizeBytes) {
        toast.error(`ឯកសារ «${file.name}» មានទំហំធំជាង 15MB`);
        failCount++;
        continue;
      }

      try {
        await uploadImageMutation.mutateAsync({
          file,
          privateAlbumId: selectedAlbumId,
        });
        successCount++;
      } catch (err: unknown) {
        failCount++;
        const msg = err instanceof Error ? err.message : "បរាជ័យ";
        toast.error(`មិនអាចបង្ហោះ «${file.name}»: ${msg}`);
      }
    }

    setIsUploading(false);
    setUploadProgressText("");
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (successCount > 0) {
      toast.success(`បានបង្ហោះរូបភាព ${successCount} សន្លឹកដោយជោគជ័យ!`);
    }
  };

  const handleDeleteImage = async () => {
    if (!deletingImage || !selectedAlbumId) return;
    try {
      await deleteImageMutation.mutateAsync({
        id: deletingImage.id,
        albumId: selectedAlbumId,
      });
      setDeletingImage(null);
      if (lightboxIndex !== null) setLightboxIndex(null);
      toast.success("បានលុបរូបភាពសម្ងាត់រួចរាល់!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "បរាជ័យក្នុងការលុបរូបភាព";
      toast.error(msg);
    }
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedAlbumId) return;

    const fileList = Array.from(files);
    const validMimes = ["video/mp4", "video/webm", "video/quicktime"];
    const validExts = [".mp4", ".webm", ".mov"];
    const maxSizeBytes = 100 * 1024 * 1024; // 100MB

    setIsUploadingVideo(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      setUploadVideoProgressText(
        `កំពុងបង្ហោះវីដេអូទី ${i + 1}/${fileList.length} (${file.name})...`,
      );

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const isMimeValid = validMimes.includes(file.type.toLowerCase());
      const isExtValid = validExts.includes(ext);

      if (!isMimeValid && !isExtValid) {
        toast.error(`ឯកសារ «${file.name}» មិនមែនជាវីដេអូត្រឹមត្រូវឡើយ (អនុញ្ញាត MP4, WebM, MOV)`);
        failCount++;
        continue;
      }

      if (file.size > maxSizeBytes) {
        toast.error(`ឯកសារ «${file.name}» មានទំហំលើសពី 100MB`);
        failCount++;
        continue;
      }

      try {
        await uploadVideoMutation.mutateAsync({
          file,
          privateAlbumId: selectedAlbumId,
        });
        successCount++;
      } catch (err: unknown) {
        failCount++;
        const msg = err instanceof Error ? err.message : "បរាជ័យ";
        toast.error(`មិនអាចបង្ហោះ «${file.name}»: ${msg}`);
      }
    }

    setIsUploadingVideo(false);
    setUploadVideoProgressText("");
    if (videoFileInputRef.current) videoFileInputRef.current.value = "";

    if (successCount > 0) {
      toast.success(`បានបង្ហោះវីដេអូ ${successCount} ដោយជោគជ័យ!`);
    }
  };

  const handleDeleteVideo = async () => {
    if (!deletingVideo || !selectedAlbumId) return;
    try {
      await deleteVideoMutation.mutateAsync({
        id: deletingVideo.id,
        albumId: selectedAlbumId,
      });
      setDeletingVideo(null);
      toast.success("បានលុបវីដេអូសម្ងាត់ជោគជ័យ!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "បរាជ័យក្នុងការលុបវីដេអូ";
      toast.error(msg);
    }
  };

  const handleChangeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAccessCode.trim().length < 4) {
      toast.error("លេខកូដសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៤ តួអក្សរ។");
      return;
    }
    try {
      await changeCodeMutation.mutateAsync(newAccessCode.trim());
      setNewAccessCode("");
      setIsChangeCodeOpen(false);
      toast.success("បានប្តូរលេខកូដសម្ងាត់ជោគជ័យ! សូមដោះសោឡើងវិញ។");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "បរាជ័យក្នុងការប្តូរលេខកូដ";
      toast.error(msg);
    }
  };

  // Render Loading Screen
  if (checkingSession) {
    return (
      <AdminLayout requiredPermission="manage_albums">
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">កំពុងពិនិត្យសិទ្ធិចូលដំណើរការ...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Render Lock Screen if not unlocked
  if (!isUnlocked) {
    return (
      <AdminLayout requiredPermission="manage_albums">
        <div className="flex min-h-[70vh] items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
                <Lock className="h-8 w-8" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
                បណ្ណសារសម្ងាត់ (Private Archive)
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                ទិន្នន័យក្នុងផ្នែកនេះត្រូវបានការពារយ៉ាងតឹងរ៉ឹង និងមិនបង្ហាញជាសាធារណៈឡើយ។
                សូមបញ្ចូលលេខកូដសម្ងាត់ដើម្បីចូលដំណើរការ។
              </p>
            </div>

            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="accessCode" className="text-xs font-semibold">
                  លេខកូដសម្ងាត់ (Access Code)
                </Label>
                <div className="relative">
                  <Input
                    id="accessCode"
                    type={showCode ? "text" : "password"}
                    placeholder="បញ្ចូលលេខកូដសម្ងាត់..."
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="pr-10 text-center tracking-widest font-mono text-lg"
                    autoFocus
                    disabled={unlockMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                disabled={unlockMutation.isPending}
              >
                {unlockMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    កំពុងផ្ទៀងផ្ទាត់...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Unlock className="h-4 w-4" />
                    ដោះសោ (Unlock)
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>
                  ប្រព័ន្ធការពារ Brute-force សកម្ម (កំណត់ ៥ ដងក្នុង ១៥ នាទី)។ សម័យកាលមានសុពលភាព ២
                  ម៉ោង។
                </span>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // --- UNLOCKED PRIVATE ARCHIVE VIEW ---
  return (
    <AdminLayout requiredPermission="manage_albums">
      <div className="space-y-6">
        {/* Top Header & Actions Bar */}
        <div className="flex flex-col gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  បណ្ណសារសម្ងាត់ (Private Archive)
                </h1>
                <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  សម្ងាត់
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                ទិន្នន័យ និងរូបភាពទាំងអស់ក្នុងផ្នែកនេះ ត្រូវបានរក្សាទុកដោយឡែកពីប្រព័ន្ធសាធារណៈ។
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChangeCodeOpen(true)}
                className="gap-1.5 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" />
                ប្តូរលេខកូដ
              </Button>
            )}

            {!selectedAlbumId && (
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                បង្កើត Album ថ្មី
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={handleLock}
              disabled={lockMutation.isPending}
              className="gap-1.5 text-xs"
            >
              <Lock className="h-3.5 w-3.5" />
              ចាក់សោវិញ
            </Button>
          </div>
        </div>

        {/* VIEW 1: INSIDE AN ALBUM (GALLERY & UPLOAD) */}
        {selectedAlbumId ? (
          <div className="space-y-6">
            {/* Album Breadcrumb & Subheader */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAlbumId(null)}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeft className="h-4 w-4" />
                  ត្រឡប់ទៅ Albums
                </Button>

                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {albumDetail?.album?.title || "កំពុងផ្ទុក..."}
                  </h2>
                  {albumDetail?.album?.description && (
                    <p className="text-xs text-muted-foreground">
                      {albumDetail.album.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {mediaTab === "images" ? (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="hidden"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {uploadProgressText || "កំពុង Upload..."}
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4" />
                          បង្ហោះរូបភាពសម្ងាត់
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      ref={videoFileInputRef}
                      onChange={handleVideoFileSelect}
                      multiple
                      accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                      className="hidden"
                    />
                    <Button
                      onClick={() => videoFileInputRef.current?.click()}
                      disabled={isUploadingVideo}
                      className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    >
                      {isUploadingVideo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {uploadVideoProgressText || "កំពុង Upload..."}
                        </>
                      ) : (
                        <>
                          <UploadCloud className="h-4 w-4" />
                          បង្ហោះវីដេអូសម្ងាត់
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Media Switcher Tabs inside Album */}
            <div className="flex items-center gap-2 border-b border-border/60 pb-2">
              <Button
                variant={mediaTab === "images" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMediaTab("images")}
                className={`rounded-xl px-4 text-xs font-semibold ${
                  mediaTab === "images"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> រូបភាព ({albumDetail?.images?.length ?? 0})
              </Button>
              <Button
                variant={mediaTab === "videos" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMediaTab("videos")}
                className={`rounded-xl px-4 text-xs font-semibold ${
                  mediaTab === "videos"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Video className="mr-1.5 h-3.5 w-3.5" /> វីដេអូ ({albumDetail?.videos?.length ?? 0})
              </Button>
            </div>

            {/* Media Content Area */}
            {mediaTab === "images" ? (
              loadingAlbumDetail ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                </div>
              ) : !albumDetail?.images || albumDetail.images.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="font-semibold text-foreground">មិនទាន់មានរូបភាពនៅក្នុង Album នេះឡើយ</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    ចុចប៊ូតុង «បង្ហោះរូបភាពសម្ងាត់» ខាងលើ ដើម្បីជ្រើសរើសរូបភាពបង្ហោះចូល។
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 gap-2 text-xs"
                  >
                    {/* Zero-crop aspect-square frame with object-contain */}
                    <UploadCloud className="h-4 w-4" />
                    ជ្រើសរើសរូបភាព
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {albumDetail.images.map((img, idx) => (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden rounded-lg border bg-muted/20 transition-all hover:shadow-md"
                    >
                      {/* Zero-crop aspect-square frame with object-contain */}
                      <div
                        className="aspect-square w-full cursor-pointer overflow-hidden bg-black/5 dark:bg-black/20 flex items-center justify-center p-1"
                        onClick={() => setLightboxIndex(idx)}
                      >
                        <img
                          src={img.fileUrl}
                          alt={img.title || img.filename}
                          loading="lazy"
                          className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>

                      {/* Image Footer / Title & Delete */}
                      <div className="flex items-center justify-between p-2 text-xs bg-card">
                        <span className="truncate text-muted-foreground font-medium" title={img.filename}>
                          {img.title || img.filename}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingImage(img);
                          }}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          title="លុបរូបភាព"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Videos Tab */
              loadingAlbumDetail ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                </div>
              ) : !albumDetail?.videos || albumDetail.videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                  <Film className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <h3 className="font-semibold text-foreground">មិនទាន់មានវីដេអូនៅក្នុង Album នេះឡើយ</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    ចុចប៊ូតុង «បង្ហោះវីដេអូសម្ងាត់» ខាងលើ ដើម្បីជ្រើសរើសវីដេអូ (MP4, WebM, MOV) ទំហំរហូតដល់ 100MB។
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => videoFileInputRef.current?.click()}
                    className="mt-4 gap-2 text-xs"
                  >
                    <UploadCloud className="h-4 w-4" />
                    ជ្រើសរើសវីដេអូ
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {albumDetail.videos.map((vid) => {
                    const sizeInMb = vid.size ? (vid.size / (1024 * 1024)).toFixed(1) : null;
                    return (
                      <div
                        key={vid.id}
                        className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md"
                      >
                        {/* Video player preview with native HTML5 controls and streaming endpoint */}
                        <div className="aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
                          <video
                            src={vid.fileUrl}
                            controls
                            preload="metadata"
                            playsInline
                            className="h-full w-full object-contain"
                          />
                        </div>

                        {/* Video Footer / Metadata & Delete */}
                        <div className="flex items-center justify-between p-3 text-xs bg-card border-t border-border/50">
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-semibold text-foreground" title={vid.title || vid.filename}>
                              {vid.title || vid.filename}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {vid.mimeType && <span className="font-mono">{vid.mimeType}</span>}
                              {sizeInMb && <span>• {sizeInMb} MB</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setDeletingVideo(vid)}
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors shrink-0"
                            title="លុបវីដេអូ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        ) : (
          /* VIEW 2: ALBUMS LIST OVERVIEW */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                បញ្ជី Albums សម្ងាត់ ({albums.length})
              </h2>
            </div>

            {loadingAlbums ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
              </div>
            ) : albums.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
                <Folder className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold text-foreground">មិនទាន់មាន Album សម្ងាត់នៅឡើយទេ</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  បង្កើត Album សម្ងាត់ដំបូងរបស់អ្នក ដើម្បីចាប់ផ្តើមផ្ទុករូបភាពឯកជន។
                </p>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                >
                  <Plus className="h-4 w-4" />
                  បង្កើត Album ថ្មី
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {albums.map((alb) => (
                  <div
                    key={alb.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md"
                  >
                    {/* Album Cover Thumbnail */}
                    <div
                      className="aspect-video w-full cursor-pointer overflow-hidden bg-muted/40 flex items-center justify-center"
                      onClick={() => setSelectedAlbumId(alb.id)}
                    >
                      {alb.coverUrl ? (
                        <img
                          src={alb.coverUrl}
                          alt={alb.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground/40">
                          <Folder className="h-10 w-10 mb-1" />
                          <span className="text-xs">គ្មានរូបភាព</span>
                        </div>
                      )}
                    </div>

                    {/* Album Metadata */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className="font-semibold text-foreground hover:text-amber-600 cursor-pointer line-clamp-1"
                          onClick={() => setSelectedAlbumId(alb.id)}
                        >
                          {alb.title}
                        </h3>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                          {alb.photoCount} សន្លឹក
                          {alb.photoCount} រូប{alb.videoCount ? ` • ${alb.videoCount} វីដេអូ` : ""}
                        </span>
                      </div>

                      {alb.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {alb.description}
                        </p>
                      )}

                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAlbumId(alb.id)}
                          className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          បើកមើល →
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingAlbum(alb);
                              setEditTitle(alb.title);
                              setEditDescription(alb.description || "");
                            }}
                            title="កែសម្រួល"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingAlbum(alb)}
                            title="លុប"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL: CREATE ALBUM */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-amber-500" />
                បង្កើត Album សម្ងាត់ថ្មី
              </DialogTitle>
              <DialogDescription className="text-xs">
                Album នេះនឹងត្រូវបានរក្សាទុកក្នុងប្រព័ន្ធ Private ដោយឡែក។
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAlbum} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="createTitle" className="text-xs font-semibold">
                  ចំណងជើង Album <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="createTitle"
                  placeholder="ឧ. ឯកសារសម្ងាត់ឆ្នាំ២០២៦"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  disabled={createAlbumMutation.isPending}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="createDesc" className="text-xs font-semibold">
                  ពិពណ៌នា (ស្រេចចិត្ត)
                </Label>
                <Textarea
                  id="createDesc"
                  placeholder="ព័ត៌មានលម្អិតបន្ថែមអំពី Album នេះ..."
                  value={albumDescription}
                  onChange={(e) => setAlbumDescription(e.target.value)}
                  disabled={createAlbumMutation.isPending}
                  rows={3}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={createAlbumMutation.isPending}
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={createAlbumMutation.isPending}
                >
                  {createAlbumMutation.isPending ? "កំពុងបង្កើត..." : "បង្កើត"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: EDIT ALBUM */}
        <Dialog open={Boolean(editingAlbum)} onOpenChange={(open) => !open && setEditingAlbum(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-amber-500" />
                កែសម្រួល Album សម្ងាត់
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateAlbum} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="editTitle" className="text-xs font-semibold">
                  ចំណងជើង Album <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={updateAlbumMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editDesc" className="text-xs font-semibold">
                  ពិពណ៌នា
                </Label>
                <Textarea
                  id="editDesc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={updateAlbumMutation.isPending}
                  rows={3}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAlbum(null)}
                  disabled={updateAlbumMutation.isPending}
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={updateAlbumMutation.isPending}
                >
                  {updateAlbumMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: DELETE ALBUM CONFIRMATION */}
        <Dialog open={Boolean(deletingAlbum)} onOpenChange={(open) => !open && setDeletingAlbum(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                តើអ្នកប្រាកដជាចង់លុប Album នេះមែនទេ?
              </DialogTitle>
              <DialogDescription className="text-xs">
                Album «{deletingAlbum?.title}» ព្រមទាំងរូបភាពទាំងអស់នៅក្នុង Album
                នេះនឹងត្រូវបានលុបជាអចិន្ត្រៃយ៍ពីប្រព័ន្ធផ្ទុក R2 និង PostgreSQL។
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => setDeletingAlbum(null)}
                disabled={deleteAlbumMutation.isPending}
              >
                បោះបង់
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAlbum}
                disabled={deleteAlbumMutation.isPending}
              >
                {deleteAlbumMutation.isPending ? "កំពុងលុប..." : "លុបចេញ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: DELETE IMAGE CONFIRMATION */}
        <Dialog open={Boolean(deletingImage)} onOpenChange={(open) => !open && setDeletingImage(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                លុបរូបភាពសម្ងាត់
              </DialogTitle>
              <DialogDescription className="text-xs">
                រូបភាព «{deletingImage?.title || deletingImage?.filename}»
                នឹងត្រូវបានលុបជាអចិន្ត្រៃយ៍ពីប្រព័ន្ធផ្ទុក R2។
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => setDeletingImage(null)}
                disabled={deleteImageMutation.isPending}
              >
                បោះបង់
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteImage}
                disabled={deleteImageMutation.isPending}
              >
                {deleteImageMutation.isPending ? "កំពុងលុប..." : "លុបរូបភាព"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: DELETE VIDEO CONFIRMATION */}
        <Dialog open={Boolean(deletingVideo)} onOpenChange={(open) => !open && setDeletingVideo(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                លុបវីដេអូសម្ងាត់
              </DialogTitle>
              <DialogDescription className="text-xs">
                វីដេអូ «{deletingVideo?.title || deletingVideo?.filename}»
                នឹងត្រូវបានលុបជាអចិន្ត្រៃយ៍ពីប្រព័ន្ធផ្ទុក R2។
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => setDeletingVideo(null)}
                disabled={deleteVideoMutation.isPending}
              >
                បោះបង់
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteVideo}
                disabled={deleteVideoMutation.isPending}
              >
                {deleteVideoMutation.isPending ? "កំពុងលុប..." : "លុបវីដេអូ"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: CHANGE ACCESS CODE (SUPER ADMIN) */}
        <Dialog open={isChangeCodeOpen} onOpenChange={setIsChangeCodeOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-500" />
                ផ្លាស់ប្តូរលេខកូដសម្ងាត់ (Super Admin)
              </DialogTitle>
              <DialogDescription className="text-xs">
                ការប្តូរលេខកូដសម្ងាត់នឹងទាមទារឱ្យអ្នកប្រើទាំងអស់ត្រូវដោះសោឡើងវិញដោយលេខកូដថ្មី។
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleChangeCode} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="newCode" className="text-xs font-semibold">
                  លេខកូដសម្ងាត់ថ្មី (យ៉ាងហោចណាស់ ៤ តួ)
                </Label>
                <Input
                  id="newCode"
                  type="text"
                  placeholder="បញ្ចូលលេខកូដថ្មី..."
                  value={newAccessCode}
                  onChange={(e) => setNewAccessCode(e.target.value)}
                  disabled={changeCodeMutation.isPending}
                  autoFocus
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangeCodeOpen(false)}
                  disabled={changeCodeMutation.isPending}
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={changeCodeMutation.isPending}
                >
                  {changeCodeMutation.isPending ? "កំពុងប្តូរ..." : "ផ្លាស់ប្តូរលេខកូដ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* DEDICATED PRIVATE LIGHTBOX VIEWER */}
        {lightboxIndex !== null && albumDetail?.images && albumDetail.images[lightboxIndex] && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm select-none"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Top Bar */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent text-white z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm">
                <span className="font-semibold">
                  {albumDetail.images[lightboxIndex].title ||
                    albumDetail.images[lightboxIndex].filename}
                </span>
                <span className="ml-3 text-xs text-white/70">
                  {lightboxIndex + 1} / {albumDetail.images.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/10"
                  onClick={() => setLightboxIndex(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Navigation Buttons */}
            {albumDetail.images.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-all z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(
                      (lightboxIndex - 1 + albumDetail.images.length) % albumDetail.images.length,
                    );
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-all z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex((lightboxIndex + 1) % albumDetail.images.length);
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Image Container with Natural Aspect Ratio / Zero-crop */}
            <div
              className="relative max-h-[88vh] max-w-[92vw] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={albumDetail.images[lightboxIndex].fileUrl}
                alt={
                  albumDetail.images[lightboxIndex].title ||
                  albumDetail.images[lightboxIndex].filename
                }
                className="max-h-[88vh] max-w-[92vw] object-contain rounded shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

