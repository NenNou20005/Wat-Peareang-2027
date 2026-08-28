import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Share2, Download, ImageOff, Loader2 } from "lucide-react";
import { toKhmerNumber } from "@/data/archive";
import { trackImageView } from "@/lib/analytics";
import { LikeButton } from "./LikeButton";
import { FavoriteButton } from "./FavoriteButton";
import { toast } from "sonner";

export type LightboxPhoto = { id: string; src: string; caption: string };

export function Lightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const move = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return;
      setIsLoading(true);
      setHasError(false);
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, onIndexChange, photos.length],
  );

  // Track current image view
  useEffect(() => {
    if (index === null) return;
    const currentPhoto = photos[index];
    if (currentPhoto?.id) {
      trackImageView(currentPhoto.id);
    }
  }, [index, photos]);

  // Preload adjacent images (1 ahead, 1 behind)
  useEffect(() => {
    if (index === null || photos.length <= 1) return;

    const nextIndex = (index + 1) % photos.length;
    const prevIndex = (index - 1 + photos.length) % photos.length;

    const nextPhoto = photos[nextIndex];
    const prevPhoto = photos[prevIndex];

    if (nextPhoto?.src) {
      const imgNext = new Image();
      imgNext.src = nextPhoto.src;
    }
    if (prevPhoto?.src && prevIndex !== nextIndex) {
      const imgPrev = new Image();
      imgPrev.src = prevPhoto.src;
    }
  }, [index, photos]);

  // Reset loading state on photo change
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, move, onClose]);

  if (index === null) return null;
  const photo = photos[index]!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-temple-deep/97 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-4 text-temple-foreground">
        <p className="truncate text-sm text-temple-foreground/80">{photo.caption}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="បិទ"
          className="rounded-full p-2 hover:bg-background/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="រូបមុន"
          className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-background/15 text-temple-foreground hover:bg-background/25 transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-temple-foreground/60">
            <Loader2 className="h-8 w-8 animate-spin text-gold mb-2" />
            <span className="text-xs">កំពុងផ្ទុករូបភាព...</span>
          </div>
        )}

        {hasError ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-black/30 border border-white/10 text-temple-foreground/70 max-w-sm text-center">
            <ImageOff className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">មិនអាចបង្ហាញរូបភាពនេះបានទេ</p>
            <p className="text-xs text-muted-foreground mt-1">
              រូបភាពអាចនឹងត្រូវបានផ្លាស់ប្តូរ ឬបាត់បង់
            </p>
          </div>
        ) : (
          <img
            src={photo.src}
            alt={photo.caption}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            className={`max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-opacity duration-200 ${
              isLoading ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        <button
          type="button"
          onClick={() => move(1)}
          aria-label="រូបបន្ទាប់"
          className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full bg-background/15 text-temple-foreground hover:bg-background/25 transition-all"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center justify-between px-6 py-5 text-temple-foreground border-t border-white/10">
        <div className="flex items-center gap-2">
          <LikeButton
            key={`like-${photo.id}`}
            resourceType="image"
            resourceId={photo.id}
            variant="pill"
            size="sm"
          />
          <FavoriteButton
            key={`fav-${photo.id}`}
            resourceType="image"
            resourceId={photo.id}
            titleText={photo.caption}
            variant="pill"
            size="sm"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              toast.success("បានចម្លង Link រូបភាព");
            }}
            aria-label="ចែករំលែក"
            className="grid h-8 w-8 place-items-center rounded-full bg-background/15 text-temple-foreground hover:bg-background/25 transition-colors"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toast("កំពុងទាញយករូបភាព...")}
            aria-label="Download"
            className="grid h-8 w-8 place-items-center rounded-full bg-background/15 text-temple-foreground hover:bg-background/25 transition-colors"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
        <span className="text-sm font-mono text-gold">
          {toKhmerNumber(index + 1)} / {toKhmerNumber(photos.length)}
        </span>
      </div>
    </div>
  );
}
