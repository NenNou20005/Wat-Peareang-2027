import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, Share2, Download, ImageOff, Loader2 } from "lucide-react";
import { toKhmerNumber } from "@/data/archive";
import { trackImageView } from "@/lib/analytics";
import { downloadArchiveImage } from "@/lib/utils";
import { LikeButton } from "./LikeButton";
import { FavoriteButton } from "./FavoriteButton";
import { toast } from "sonner";

export type LightboxPhoto = {
  id: string;
  src: string;
  caption: string;
  thumbnailUrl?: string | null | undefined;
};

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
  const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
  const [isThumbLoaded, setIsThumbLoaded] = useState(false);
  const [isThumbError, setIsThumbError] = useState(false);
  const [isOriginalError, setIsOriginalError] = useState(false);

  // In-memory set of already downloaded & cached original URLs
  const loadedOriginalsRef = useRef<Set<string>>(new Set());
  const touchStartXRef = useRef<number | null>(null);

  const move = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return;
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

  // Preload adjacent images (thumbnails only to conserve bandwidth for active original)
  useEffect(() => {
    if (index === null || photos.length <= 1) return;

    const nextIndex = (index + 1) % photos.length;
    const prevIndex = (index - 1 + photos.length) % photos.length;

    const nextPhoto = photos[nextIndex];
    const prevPhoto = photos[prevIndex];

    const preload = (url?: string | null) => {
      if (!url) return;
      const img = new Image();
      img.src = url;
    };

    if (nextPhoto) {
      preload(nextPhoto.thumbnailUrl);
    }
    if (prevPhoto && prevIndex !== nextIndex) {
      preload(prevPhoto.thumbnailUrl);
    }
  }, [index, photos]);

  // Reset/sync loading states on photo change
  useEffect(() => {
    if (index === null) return;
    const current = photos[index];
    if (!current) return;

    const isAlreadyCached = loadedOriginalsRef.current.has(current.src);
    setIsOriginalLoaded(isAlreadyCached);
    setIsThumbLoaded(false);
    setIsThumbError(false);
    setIsOriginalError(false);
  }, [index, photos]);

  // Keyboard navigation
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

  // Mobile Touch Gestures (Swipe Next/Previous)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? null;
    if (touchEndX !== null) {
      const diffX = touchStartXRef.current - touchEndX;
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) move(1);
        else move(-1);
      }
    }
    touchStartXRef.current = null;
  };

  if (index === null) return null;
  const photo = photos[index]!;
  const thumbSrc = photo.thumbnailUrl || photo.src;
  const originalSrc = photo.src;
  const isTotalError = isOriginalError && (isThumbError || !thumbSrc);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-temple-deep/97 backdrop-blur-md"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar */}
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

      {/* Main Image Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 overflow-hidden">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="រូបមុន"
          className="absolute left-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-background/15 text-temple-foreground hover:bg-background/25 transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {isTotalError ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-black/30 border border-white/10 text-temple-foreground/70 max-w-sm text-center">
            <ImageOff className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">មិនអាចបង្ហាញរូបភាពនេះបានទេ</p>
            <p className="text-xs text-muted-foreground mt-1">
              រូបភាពអាចនឹងត្រូវបានផ្លាស់ប្តូរ ឬបាត់បង់
            </p>
          </div>
        ) : (
          <div className="relative flex h-full w-full items-center justify-center p-2">
            {/* Spinner displayed ONLY while neither thumbnail nor original is ready */}
            {!isThumbLoaded && !isOriginalLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-temple-foreground/60 z-0 pointer-events-none">
                <Loader2 className="h-8 w-8 animate-spin text-gold mb-2" />
                <span className="text-xs">កំពុងផ្ទុករូបភាព...</span>
              </div>
            )}

            {/* 1. Fast Thumbnail Layer (Shows immediately) */}
            {thumbSrc && (
              <img
                key={`thumb-${photo.id}`}
                src={thumbSrc}
                alt={photo.caption}
                onLoad={() => setIsThumbLoaded(true)}
                onError={() => setIsThumbError(true)}
                className={`max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-opacity duration-300 ${
                  isOriginalLoaded
                    ? "opacity-0 absolute inset-0 m-auto pointer-events-none"
                    : isThumbLoaded
                      ? "opacity-100"
                      : "opacity-0 absolute inset-0 m-auto pointer-events-none"
                }`}
              />
            )}

            {/* 2. Original Full-Res Layer (Loads in background, smoothly takes over) */}
            <img
              key={`orig-${photo.id}`}
              src={originalSrc}
              alt={photo.caption}
              onLoad={() => {
                setIsOriginalLoaded(true);
                loadedOriginalsRef.current.add(originalSrc);
              }}
              onError={() => {
                setIsOriginalError(true);
              }}
              className={`max-h-full max-w-full rounded-2xl object-contain shadow-2xl transition-opacity duration-300 ${
                isOriginalLoaded
                  ? "opacity-100"
                  : "opacity-0 absolute inset-0 m-auto pointer-events-none"
              }`}
            />

            {/* Subtle indicator while original is downloading in background */}
            {!isOriginalLoaded && isThumbLoaded && !isOriginalError && thumbSrc !== originalSrc && (
              <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md border border-white/10 shadow-lg pointer-events-none transition-all">
                <Loader2 className="h-3 w-3 animate-spin text-gold" />
                <span>កំពុងផ្ទុក Full HD...</span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => move(1)}
          aria-label="រូបបន្ទាប់"
          className="absolute right-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-background/15 text-temple-foreground hover:bg-background/25 transition-all"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom Bar & Actions */}
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
            onClick={async () => {
              if (!photo?.src) return;
              toast("កំពុងទាញយករូបភាព...");
              const filename = `${photo.id || "wat-peareang-photo"}.jpg`;
              const success = await downloadArchiveImage(photo.src, filename);
              if (success) {
                toast.success("បានទាញយករូបភាពដោយជោគជ័យ");
              } else {
                toast.error("មិនអាចទាញយករូបភាពបានឡើយ");
              }
            }}
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
