import { useState } from "react";
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
import { Upload, X, Rocket, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadImage, useCreateAlbum } from "@/hooks/useAdminData";
import { useAlbums, useFestivals, useYears } from "@/hooks/useArchiveData";

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
  const { data: allAlbums = [] } = useAlbums();

  const [year, setYear] = useState<number>(dbYears[0] || 2027);
  const [festivalId, setFestivalId] = useState<string>(dbFestivals[0]?.id || "chaul-chnam");
  const [files, setFiles] = useState<{ id: string; file: File; url: string; name: string }[]>([]);
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const uploadImageMutation = useUploadImage();
  const createAlbumMutation = useCreateAlbum();

  const festival =
    dbFestivals.find((f) => f.id === festivalId) ?? dbFestivals[0] ?? defaultFestivals[0]!;

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
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      // 1. Locate or create target album
      const targetAlbum = allAlbums.find(
        (a) =>
          (a.festivalId === festivalId || a.id.startsWith(festivalId)) &&
          Number(a.year) === Number(year),
      );

      const finalAlbumId: string = targetAlbum?.id || `${festivalId}-${year}`;
      if (!targetAlbum?.id) {
        const albumTitle = title.trim() || `${festival.name} ឆ្នាំ ${year}`;
        await createAlbumMutation.mutateAsync({
          festivalId,
          year,
          title: albumTitle,
          location: location.trim() || "វត្តពារាំង",
          description: description.trim() || undefined,
        });
      }

      let successCount = 0;
      for (const item of files) {
        try {
          const itemTitle = item.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("albumId", finalAlbumId);
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
        toast.success(`បានបង្ហោះ Album «${festival.name}» ដោយជោគជ័យ!`, {
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
                <span className="font-bold text-gold">
                  {title.trim() || `${festival.name} ឆ្នាំ ${year}`}
                </span>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <Label>ជំហាន ១ · ជ្រើសរើសឆ្នាំប្រារព្ធ</Label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {dbYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors font-medium",
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

          <section className="space-y-3">
            <Label>ជំហាន ២ · ជ្រើសរើសពិធីបុណ្យ</Label>
            <div className="grid max-h-48 overflow-y-auto gap-2 sm:grid-cols-2">
              {dbFestivals.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFestivalId(f.id)}
                  style={f.id === festivalId ? { borderColor: f.accent } : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
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

          <section className="space-y-3">
            <Label>ជំហាន ៣ · ជ្រើសរើសរូបភាព (រហូតដល់ {toKhmerNumber(MAX)} រូប)</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-cream px-6 py-10 text-center transition-colors hover:border-gold">
              <ImagePlus className="h-8 w-8 text-gold" />
              <span className="text-sm font-medium">អូសទម្លាក់រូបភាព ឬចុចដើម្បីជ្រើសរើស</span>
              <span className="text-xs text-muted-foreground">JPG · PNG · HEIC</span>
              <input
                type="file"
                accept="image/*"
                multiple
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

          {files.length > 0 && (
            <section className="space-y-3">
              <Label>ជំហាន ៤ · Preview</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {files.map((f) => (
                  <div key={f.id} className="group relative overflow-hidden rounded-xl">
                    <img
                      src={f.url}
                      alt={f.name}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((p) => p.id !== f.id))}
                      className="absolute right-1 top-1 rounded-full bg-background/85 p-1 text-foreground"
                      aria-label="ដកចេញ"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <Label>ជំហាន ៥ · ព័ត៌មាន Album</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="ចំណងជើង"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Input
                placeholder="ទីកន្លែង"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="ការពិពណ៌នា / Tags"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </section>

          <Button
            size="lg"
            className="w-full rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
            disabled={files.length === 0 || isUploading}
            onClick={publish}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> កំពុង Upload ចូល Cloudflare R2...
              </>
            ) : (
              <>
                <Rocket className="mr-1 h-4 w-4" /> បង្ហោះ Album
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
