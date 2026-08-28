import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { festivals, getAllFestivals, years, toKhmerNumber, type Festival } from "@/data/archive";
import { cn } from "@/lib/utils";
import { Upload, X, Rocket, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const MAX = 50;

export function UploadModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [availableFestivals, setAvailableFestivals] = useState<Festival[]>(festivals);
  const [year, setYear] = useState<number>(years[0]!);
  const [festivalId, setFestivalId] = useState<string>(festivals[0]!.id);
  const [files, setFiles] = useState<{ id: string; url: string; name: string }[]>([]);
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setAvailableFestivals(getAllFestivals());
    const handleUpdate = () => setAvailableFestivals(getAllFestivals());
    window.addEventListener("watpeareang-festivals-updated", handleUpdate);
    return () => window.removeEventListener("watpeareang-festivals-updated", handleUpdate);
  }, []);

  const festival = useMemo(
    () =>
      availableFestivals.find((f) => f.id === festivalId) ?? availableFestivals[0] ?? festivals[0]!,
    [availableFestivals, festivalId],
  );

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list)
      .slice(0, MAX - files.length)
      .map((file, i) => ({
        id: `${file.name}-${Date.now()}-${i}`,
        url: URL.createObjectURL(file),
        name: file.name,
      }));
    setFiles((prev) => [...prev, ...next].slice(0, MAX));
  }

  function publish() {
    toast.success("បង្ហោះ Album ដោយជោគជ័យ", {
      description: `${festival.name} · ឆ្នាំ ${toKhmerNumber(year)} · ${toKhmerNumber(files.length)} រូបភាព`,
    });
    onOpenChange(false);
    setFiles([]);
    setTitle("");
    setLocation("");
    setDescription("");
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
          <section className="space-y-3">
            <Label>ជំហាន ១ · ជ្រើសរើសឆ្នាំ</Label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
                    y === year
                      ? "border-transparent bg-gold text-gold-foreground"
                      : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  {toKhmerNumber(y)}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Label>ជំហាន ២ · ជ្រើសរើសបុណ្យ</Label>
            <div className="grid max-h-44 overflow-y-auto gap-2 sm:grid-cols-2">
              {availableFestivals.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFestivalId(f.id)}
                  style={f.id === festivalId ? { borderColor: f.accent } : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                    f.id === festivalId ? "bg-secondary" : "border-border hover:bg-secondary/60",
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
            className="w-full rounded-full"
            disabled={files.length === 0}
            onClick={publish}
          >
            <Rocket className="mr-1 h-4 w-4" /> បង្ហោះ Album
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
