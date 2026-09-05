import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  festivals as defaultFestivals,
  years as defaultYears,
  toKhmerNumber,
} from "@/data/archive";
import { cn } from "@/lib/utils";
import { Upload, X, Rocket, ImagePlus, Loader2, FolderOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { useUploadImage } from "@/hooks/useAdminData";
import { useAlbums, useFestivals, useYears } from "@/hooks/useArchiveData";
import { resolveImageUrl } from "@/lib/asset-resolver";
import { Link } from "@tanstack/react-router";

const MAX = 50;

export function UploadModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: dbYears = defaultYears } = useYears();
  const { data: dbFestivals = defaultFestivals } = useFestivals();

  const [year, setYear] = useState<number>(dbYears[0] || 2027);
  const [festivalId, setFestivalId] = useState<string>(dbFestivals[0]?.id || "chaul-chnam");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");

  // Query existing albums for selected year and festival
  const { data: availableAlbums = [], isLoading: isLoadingAlbums } = useAlbums({
    year,
    festivalId,
  });

  const [files, setFiles] = useState<{ id: string; file: File; url: string; name: string }[]>([]);
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadImageMutation = useUploadImage();

  const festival =
    dbFestivals.find((f) => f.id === festivalId) ?? dbFestivals[0] ?? defaultFestivals[0]!;

  // Auto-select album if only 1 exists, or reset when changing festival/year
  useEffect(() => {
    if (availableAlbums.length === 1 && availableAlbums[0]) {
      setSelectedAlbumId(availableAlbums[0].id);
    } else if (
      selectedAlbumId &&
      !availableAlbums.some((a) => a.id === selectedAlbumId)
    ) {
      setSelectedAlbumId(availableAlbums[0]?.id || "");
    }
  }, [availableAlbums, selectedAlbumId]);

  const selectedAlbum = availableAlbums.find((a) => a.id === selectedAlbumId);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list)
      .slice(0, MAX - files.length)
      .map((file, i) => ({
        id: `${file.name}-${Date.now()}-${i}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
      }));
    setFiles((prev) => [...prev, ...next].slice(0, MAX));
  }

  async function publish() {
    if (!selectedAlbumId) {
      toast.error("សូមជ្រើសរើស Album គោលដៅជាមុនសិន។");
      return;
    }
    if (files.length === 0) {
      toast.error("សូមជ្រើសរើសរូបភាពយ៉ាងហោចណាស់មួយ។");
      return;
    }

    setIsUploading(true);

    try {
      let successCount = 0;
      for (const item of files) {
        try {
          const itemTitle = item.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("albumId", selectedAlbumId);
          formData.append("title", title.trim() ? `${title.trim()} (${itemTitle})` : itemTitle);
          if (location.trim()) {
            formData.append("photographer", location.trim());
          }
          if (description.trim()) {
            formData.append("tags", description.trim());
          }

          await uploadImageMutation.mutateAsync(formData);
          successCount++;
        } catch (err: unknown) {
          console.error("Upload error:", err);
          const msg = err instanceof Error ? err.message : "បរាជ័យ";
          toast.error(`មិនអាច Upload «${item.name}»: ${msg}`);
        }
      }

      if (successCount > 0) {
        toast.success(`បានបង្ហោះរូបភាពចូល Album «${selectedAlbum?.title || festival.name}» ដោយជោគជ័យ!`, {
          description: `ឆ្នាំ ${toKhmerNumber(year)} · ${toKhmerNumber(successCount)} រូបភាពបានរក្សាទុកក្នុង Cloudflare R2`,
        });
        files.forEach((f) => URL.revokeObjectURL(f.url));
        setFiles([]);
        setTitle("");
        setLocation("");
        setDescription("");
        onOpenChange(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបង្ហោះ";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl border-border/70 bg-card p-0 sm:max-w-3xl">
        <div className="border-b border-border/70 bg-cream px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-left text-xl">⬆️ បង្ហោះរូបភាពបុណ្យ</DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-7 px-6 py-6">
          {/* Selected Destination Summary Card */}
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 text-xs">
            <div className="font-semibold text-gold mb-1 flex items-center gap-1.5">
              <span>📍 គោលដៅរក្សាទុកក្នុងទិន្នន័យ៖</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-foreground">
              <div>
                📅 ឆ្នាំ៖{" "}
                <span className="font-bold text-gold">
                  {year} ({toKhmerNumber(year)})
                </span>
              </div>
              <div>
                🏮 ពិធីបុណ្យ៖{" "}
                <span className="font-bold text-gold">
                  {festival.emoji} {festival.name}
                </span>
              </div>
              <div>
                📁 Album គោលដៅ៖{" "}
                <span
                  className={cn(
                    "font-bold",
                    selectedAlbum ? "text-gold" : "text-muted-foreground italic",
                  )}
                >
                  {selectedAlbum ? selectedAlbum.title : "មិនទាន់បានជ្រើសរើស"}
                </span>
              </div>
            </div>
          </div>

          {/* Step 1: Select Year */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold">ជំហាន ១ · ជ្រើសរើសឆ្នាំប្រារព្ធ</Label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {dbYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setYear(y);
                    setSelectedAlbumId("");
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors font-medium cursor-pointer",
                    y === year
                      ? "border-transparent bg-gold text-gold-foreground shadow-sm"
                      : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  {y} ({toKhmerNumber(y)})
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Select Festival */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold">ជំហាន ២ · ជ្រើសរើសពិធីបុណ្យ</Label>
            <div className="grid max-h-48 overflow-y-auto gap-2 sm:grid-cols-2">
              {dbFestivals.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFestivalId(f.id);
                    setSelectedAlbumId("");
                  }}
                  style={f.id === festivalId ? { borderColor: f.accent } : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors cursor-pointer",
                    f.id === festivalId
                      ? "bg-secondary font-semibold"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span className="text-lg">{f.emoji}</span>
                  {f.name}
                </button>
              ))}
            </div>
          </section>

          {/* Step 3: Select Existing Album */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span>ជំហាន ៣ · ជ្រើសរើស Album គោលដៅ</span>
                {selectedAlbum && (
                  <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                    (បានជ្រើស: {selectedAlbum.title})
                  </span>
                )}
              </Label>
              {availableAlbums.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  រកឃើញ {toKhmerNumber(availableAlbums.length)} Album
                </span>
              )}
            </div>

            {isLoadingAlbums ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-gold" />
                <span>កំពុងទាញយក Albums ក្នុងទិន្នន័យ...</span>
              </div>
            ) : availableAlbums.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center space-y-3">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    មិនទាន់មាន Album សម្រាប់ពិធីបុណ្យ និងឆ្នាំនេះទេ
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    សូមជ្រើសរើសឆ្នាំ ឬពិធីបុណ្យផ្សេងទៀត ឬបង្កើត Album ថ្មីក្នុងផ្ទាំងគ្រប់គ្រង Admin
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-full text-xs"
                >
                  <Link to="/admin/albums">
                    ទៅកាន់ Album Management (ផ្ទាំងគ្រប់គ្រង Admin) →
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                {availableAlbums.map((alb) => {
                  const isSelected = alb.id === selectedAlbumId;
                  const coverSrc = alb.coverImage
                    ? resolveImageUrl(alb.coverImage, alb.festivalId)
                    : alb.festival?.cover
                      ? resolveImageUrl(alb.festival.cover, alb.festivalId)
                      : undefined;

                  return (
                    <button
                      key={alb.id}
                      type="button"
                      onClick={() => setSelectedAlbumId(alb.id)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-gold bg-gold/10 shadow-sm ring-2 ring-gold/50"
                          : "border-border bg-card hover:bg-secondary/60 hover:border-border/80",
                      )}
                    >
                      {/* Album Cover Thumbnail */}
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/50">
                        {coverSrc ? (
                          <img
                            src={coverSrc}
                            alt={alb.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-secondary text-xs text-muted-foreground">
                            📁
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-gold/40 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-primary-foreground shadow-sm">
                              ✓
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Album Info */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-bold text-foreground">
                            {alb.title}
                          </p>
                          {isSelected && (
                            <span className="rounded-full bg-gold px-1.5 py-0.2 text-[9px] font-bold text-primary-foreground">
                              បានជ្រើស
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <span>{festival.emoji} {festival.name}</span>
                          <span>·</span>
                          <span>ឆ្នាំ {toKhmerNumber(alb.year)}</span>
                        </p>
                        <p className="text-[10px] text-gold font-medium">
                          📸 {toKhmerNumber(alb.photoCount || 0)} រូបភាព
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Step 4: Select Photos */}
          <section className="space-y-3">
            <Label
              className={cn(
                "text-sm font-semibold",
                !selectedAlbumId && "text-muted-foreground",
              )}
            >
              ជំហាន ៤ · ជ្រើសរើសរូបភាព (រហូតដល់ {toKhmerNumber(MAX)} រូប)
              {!selectedAlbumId && (
                <span className="ml-2 text-xs font-normal text-destructive">
                  (សូមជ្រើសរើស Album ខាងលើជាមុនសិន)
                </span>
              )}
            </Label>
            <label
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                selectedAlbumId
                  ? "cursor-pointer border-border bg-cream hover:border-gold"
                  : "cursor-not-allowed border-border/50 bg-muted/20 opacity-60",
              )}
            >
              <ImagePlus className={cn("h-8 w-8", selectedAlbumId ? "text-gold" : "text-muted-foreground")} />
              <span className="text-sm font-medium">
                {selectedAlbumId
                  ? "អូសទម្លាក់រូបភាព ឬចុចដើម្បីជ្រើសរើស"
                  : "សូមជ្រើសរើស Album គោលដៅនៅជំហាន ៣ ជាមុនសិន"}
              </span>
              <span className="text-xs text-muted-foreground">JPG · PNG · WEBP · HEIC</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!selectedAlbumId}
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            <div className="flex items-center gap-3">
              <Progress value={(files.length / MAX) * 100} className="h-2" />
              <span className="shrink-0 text-xs text-muted-foreground">
                {toKhmerNumber(files.length)} / {toKhmerNumber(MAX)} រូប
              </span>
            </div>
          </section>

          {/* Step 5: Preview Selected Photos */}
          {files.length > 0 && (
            <section className="space-y-3">
              <Label className="text-sm font-semibold">
                ជំហាន ៥ · Preview ({toKhmerNumber(files.length)} រូបភាពដែលបានជ្រើស)
              </Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 max-h-60 overflow-y-auto p-1">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-secondary/80 flex items-center justify-center"
                  >
                    {/* Ambient Blurred Backdrop */}
                    <img
                      src={f.url}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover blur-sm scale-110 opacity-30 pointer-events-none"
                    />
                    {/* Foreground Natural-Ratio Uncropped Preview */}
                    <img
                      src={f.url}
                      alt={f.name}
                      loading="lazy"
                      className="relative z-[1] max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((p) => p.id !== f.id))}
                      className="absolute right-1 top-1 z-[2] rounded-full bg-black/70 p-1 text-white hover:bg-black/90 cursor-pointer transition-colors"
                      aria-label="ដកចេញ"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Optional Meta fields */}
          <section className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground">
              ព័ត៌មានបន្ថែម (Optional)
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="ចំណងជើងរូបភាព (Prefix / បន្ថែម)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl text-xs"
              />
              <Input
                placeholder="ឈ្មោះអ្នកថតរូប / ទីកន្លែង"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
            <Textarea
              placeholder="ការពិពណ៌នា / Tags បន្ថែម"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl text-xs resize-none"
              rows={2}
            />
          </section>

          {/* Submit Action */}
          <Button
            size="lg"
            className="w-full rounded-full bg-gold text-primary-foreground hover:bg-gold/90 cursor-pointer"
            disabled={files.length === 0 || !selectedAlbumId || isUploading}
            onClick={publish}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> កំពុង Upload ចូល Cloudflare R2...
              </>
            ) : (
              <>
                <Rocket className="mr-1 h-4 w-4" />{" "}
                {selectedAlbum
                  ? `បង្ហោះរូបភាពចូល «${selectedAlbum.title}»`
                  : "សូមជ្រើសរើស Album គោលដៅ"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UploadTrigger({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className={cn("rounded-full", className)} onClick={() => setOpen(true)}>
        {children ?? (
          <>
            <Upload className="mr-1 h-4 w-4" />
          </>
        )}
      </Button>
      <UploadModal open={open} onOpenChange={setOpen} />
    </>
  );
}
