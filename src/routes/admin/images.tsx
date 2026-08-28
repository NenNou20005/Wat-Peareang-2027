import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import {
  useAdminImages,
  useAdminAlbums,
  useAdminFestivals,
  useUploadImage,
  useUpdateImage,
  useTrashImage,
  type AdminImage,
} from "@/hooks/useAdminData";

export const Route = createFileRoute("/admin/images")({
  head: () => ({
    meta: [{ title: "រូបភាព & Upload — Wat Peareang Admin" }],
  }),
  component: AdminImagesPage,
});

function AdminImagesPage() {
  const { hasPermission, isSuperAdmin } = useAuth();

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [selectedFestival, setSelectedFestival] = useState<string>("all");
  const [selectedAlbum, setSelectedAlbum] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Queries
  const { data: festivals = [] } = useAdminFestivals();
  const { data: albumsData } = useAdminAlbums({ limit: 500 });
  const albums = albumsData?.albums || [];

  const { data: imagesData, isLoading: loading } = useAdminImages({
    page,
    limit: 24,
    search,
    festivalId: selectedFestival,
    albumId: selectedAlbum,
  });

  const images = imagesData?.images || [];
  const totalPages = imagesData?.totalPages || 1;
  const totalCount = imagesData?.total || 0;

  // Mutations
  const uploadImageMutation = useUploadImage();
  const updateImageMutation = useUpdateImage();
  const trashImageMutation = useTrashImage();

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadAlbumId, setUploadAlbumId] = useState("");
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
    const targetAlbumId = uploadAlbumId || albums[0]?.id;
    if (!targetAlbumId) {
      toast.error("សូមជ្រើសរើស Album គោលដៅ។");
      return;
    }

    setIsUploading(true);
    let successCount = 0;

    const parsedTags = uploadTags
      ? uploadTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    // Upload items sequentially as multipart/form-data binaries
    for (const item of fileList) {
      try {
        const itemTitle = uploadTitle.trim()
          ? uploadTitle.trim()
          : item.file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("albumId", targetAlbumId);
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

    setIsUploading(false);
    fileList.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    if (successCount > 0) {
      toast.success(`បានបង្ហោះរូបភាព ${successCount} សន្លឹកដោយជោគជ័យ!`);
      setIsUploadOpen(false);
      setFileList([]);
      setUploadTitle("");
      setUploadTags("");
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
                📸 បណ្ណសាររូបភាព
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                សរុប {totalCount.toLocaleString()} រូបភាព
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              គ្រប់គ្រងរូបភាព & Upload
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ស្វែងរក កែសម្រួលព័ត៌មាន បង្ហោះរូបភាពថ្មី ឬផ្លាស់ទីរូបភាពទៅកាន់ធុងសំរាម។
            </p>
          </div>

          {canUpload && (
            <Button
              onClick={() => {
                if (albums.length > 0 && !uploadAlbumId && albums[0])
                  setUploadAlbumId(albums[0].id);
                setIsUploadOpen(true);
              }}
              className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
            >
              <Upload className="mr-1.5 h-4 w-4" /> បង្ហោះរូបភាពថ្មី
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-3">
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
            value={selectedAlbum}
            onChange={(e) => {
              setSelectedAlbum(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground"
          >
            <option value="all">🖼️ គ្រប់ Albums ទាំងអស់</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.year})
              </option>
            ))}
          </select>
        </div>

        {/* Images Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
              កំពុងទាញយករូបភាពពីបណ្ណសារ...
            </div>
          ) : images.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground rounded-3xl border border-border/80 bg-card">
              រកមិនឃើញរូបភាពឡើយ។
            </div>
          ) : (
            images.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft transition-all hover:shadow-card flex flex-col justify-between"
              >
                <div className="aspect-square w-full overflow-hidden bg-secondary">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
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
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingImage(img);
                        setEditTitle(img.title);
                        setEditPhotographer(img.photographer || "វត្តពារាំង");
                        setEditTags(img.tags ? img.tags.join(", ") : "");
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
                      onClick={() => handleDeleteImage(img)}
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
              ទំព័រទី {page} នៃ {totalPages} (សរុប {totalCount} រូប)
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

        {/* Upload Modal */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent className="max-w-lg rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-gold" /> បង្ហោះរូបភាពចូលបណ្ណសារ
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ជ្រើសរើស Album គោលដៅ</Label>
                <select
                  value={uploadAlbumId}
                  onChange={(e) => setUploadAlbumId(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-3 h-10 text-xs"
                  required
                >
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} (ឆ្នាំ {a.year})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ចំណងជើងរូបភាព (ជម្រើស)</Label>
                  <Input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="ឧ. ពិធីដង្ហែផ្កាប្រាក់"
                    className="rounded-2xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">អ្នកថតរូប (Photographer)</Label>
                  <Input
                    value={uploadPhotographer}
                    onChange={(e) => setUploadPhotographer(e.target.value)}
                    placeholder="វត្តពារាំង"
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
                    src={editingImage.url}
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
      </div>
    </AdminLayout>
  );
}
