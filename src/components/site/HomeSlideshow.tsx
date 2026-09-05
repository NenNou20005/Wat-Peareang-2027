import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Sparkles,
  Calendar,
  Tag,
  Maximize2,
  Play,
  Pause,
  Monitor,
  Smartphone,
  MapPin,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSlideshowAlbums } from "@/hooks/useArchiveData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";
import { resolveImageUrl } from "@/lib/asset-resolver";
import { Lightbox, type LightboxPhoto } from "@/components/site/Lightbox";

export function HomeSlideshow() {
  // Fetch ALL albums with ALL their active images from PostgreSQL
  const { data: albums = [], isLoading } = useSlideshowAlbums();

  const [activeAlbumIndex, setActiveAlbumIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [aspectMap, setAspectMap] = useState<Record<string, number>>({});
  const [landscapeIndex, setLandscapeIndex] = useState(0);
  const [portraitIndex, setPortraitIndex] = useState(0);

  const touchStartXLandscape = useRef<number | null>(null);
  const touchStartXPortrait = useRef<number | null>(null);
  const thumbStripRef = useRef<HTMLDivElement>(null);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  // Safe active album selection
  const safeAlbumIndex =
    albums.length > 0 ? Math.min(Math.max(0, activeAlbumIndex), albums.length - 1) : 0;
  const currentAlbum = albums[safeAlbumIndex];
  const albumImages = useMemo(() => currentAlbum?.images || [], [currentAlbum]);

  // Total images across all albums
  const totalImagesAllAlbums = useMemo(
    () => albums.reduce((sum, a) => sum + (a.images?.length || 0), 0),
    [albums],
  );

  const handleNextAlbum = useCallback(() => {
    if (albums.length === 0) return;
    setActiveAlbumIndex((prev) => (prev + 1) % albums.length);
    setLandscapeIndex(0);
    setPortraitIndex(0);
  }, [albums.length]);

  const handlePrevAlbum = useCallback(() => {
    if (albums.length === 0) return;
    setActiveAlbumIndex((prev) => (prev - 1 + albums.length) % albums.length);
    setLandscapeIndex(0);
    setPortraitIndex(0);
  }, [albums.length]);

  // Split active album's images into Landscape and Portrait strictly based on actual dimensions
  const { landscapeImages, portraitImages } = useMemo(() => {
    const landscapes: typeof albumImages = [];
    const portraits: typeof albumImages = [];

    for (const img of albumImages) {
      const ratio = aspectMap[img.id];
      if (ratio !== undefined) {
        if (ratio < 0.95) {
          portraits.push(img);
        } else {
          landscapes.push(img);
        }
      } else {
        // Fast metadata fallback before image finishes loading aspect ratio
        if ((img as any).tall === true) {
          portraits.push(img);
        } else {
          landscapes.push(img);
        }
      }
    }

    // Strict orientation separation: NEVER copy images from one orientation into the other
    return {
      landscapeImages: landscapes,
      portraitImages: portraits,
    };
  }, [albumImages, aspectMap]);

  // Safe current indices within current album
  const safeLandscapeIndex =
    landscapeImages.length > 0 ? landscapeIndex % landscapeImages.length : 0;
  const safePortraitIndex =
    portraitImages.length > 0 ? portraitIndex % portraitImages.length : 0;

  const currentLandscape = landscapeImages.length > 0 ? landscapeImages[safeLandscapeIndex] : null;
  const currentPortrait = portraitImages.length > 0 ? portraitImages[safePortraitIndex] : null;

  // Sliding Window Preloader: Only preload small sliding window (±3) around current visible slides
  useEffect(() => {
    if (albumImages.length === 0) return;

    const windowImageIds = new Set<string>();

    const addSlidingWindow = (list: typeof albumImages, currentIndex: number, windowRadius = 3) => {
      if (list.length === 0) return;
      for (let offset = -windowRadius; offset <= windowRadius; offset++) {
        const idx = (currentIndex + offset + list.length) % list.length;
        if (list[idx]) {
          windowImageIds.add(list[idx].id);
        }
      }
    };

    addSlidingWindow(landscapeImages, safeLandscapeIndex, 3);
    addSlidingWindow(portraitImages, safePortraitIndex, 3);

    const activePreloaders: HTMLImageElement[] = [];
    let isCancelled = false;

    windowImageIds.forEach((id) => {
      const img = albumImages.find((item) => item.id === id);
      if (!img) return;

      const url = resolveImageUrl(img.thumbnailUrl || img.url);
      if (preloadedUrlsRef.current.has(url) && aspectMap[id] !== undefined) {
        return;
      }
      preloadedUrlsRef.current.add(url);

      const preloader = new Image();
      activePreloaders.push(preloader);

      preloader.onload = () => {
        if (isCancelled) return;
        if (preloader.naturalWidth && preloader.naturalHeight) {
          const ratio = preloader.naturalWidth / preloader.naturalHeight;
          setAspectMap((prev) => (prev[id] === ratio ? prev : { ...prev, [id]: ratio }));
        }
      };
      preloader.src = url;
    });

    return () => {
      isCancelled = true;
      // Memory safety: cancel and detach references to prevent retention or network blockage
      activePreloaders.forEach((img) => {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      });
    };
  }, [safeLandscapeIndex, safePortraitIndex, landscapeImages, portraitImages, albumImages]);

  // Map active album photos for Lightbox viewer
  const lightboxPhotos: LightboxPhoto[] = useMemo(() => {
    return albumImages.map((img) => ({
      id: img.id,
      src: resolveImageUrl(img.url || img.thumbnailUrl),
      caption: `${img.title || currentAlbum?.title || "រូបភាពបណ្ណសារវត្តពារាំង"}${currentAlbum?.year ? ` — ឆ្នាំ ${toKhmerNumber(currentAlbum.year)}` : ""}${currentAlbum?.festivalName ? ` (${currentAlbum.festivalName})` : ""}`,
    }));
  }, [albumImages, currentAlbum]);

  // Next slide handlers within current album
  const handleNextLandscape = useCallback(() => {
    if (landscapeImages.length === 0) return;
    setLandscapeIndex((prev) => (prev + 1) % landscapeImages.length);
  }, [landscapeImages.length]);

  const handlePrevLandscape = useCallback(() => {
    if (landscapeImages.length === 0) return;
    setLandscapeIndex((prev) => (prev - 1 + landscapeImages.length) % landscapeImages.length);
  }, [landscapeImages.length]);

  const handleNextPortrait = useCallback(() => {
    if (portraitImages.length === 0) return;
    setPortraitIndex((prev) => (prev + 1) % portraitImages.length);
  }, [portraitImages.length]);

  const handlePrevPortrait = useCallback(() => {
    if (portraitImages.length === 0) return;
    setPortraitIndex((prev) => (prev - 1 + portraitImages.length) % portraitImages.length);
  }, [portraitImages.length]);

  // Global Next and Prev handlers: rotates current album, then advances to next album
  const handleNext = useCallback(() => {
    const maxCount = Math.max(landscapeImages.length, portraitImages.length);
    if (maxCount === 0) return;

    if (maxCount <= 1 && albums.length > 1) {
      handleNextAlbum();
      return;
    }

    // Determine if the current album has completed a full cycle across all available images
    const isCycleComplete =
      landscapeImages.length >= portraitImages.length
        ? safeLandscapeIndex >= landscapeImages.length - 1
        : safePortraitIndex >= portraitImages.length - 1;

    // When current album's images finish rotating, seamlessly move to the next album
    if (isCycleComplete && albums.length > 1) {
      handleNextAlbum();
    } else {
      handleNextLandscape();
      handleNextPortrait();
    }
  }, [
    landscapeImages.length,
    portraitImages.length,
    safeLandscapeIndex,
    safePortraitIndex,
    albums.length,
    handleNextAlbum,
    handleNextLandscape,
    handleNextPortrait,
  ]);

  const handlePrev = useCallback(() => {
    handlePrevLandscape();
    handlePrevPortrait();
  }, [handlePrevLandscape, handlePrevPortrait]);

  // Auto-advance every 1.5 seconds (1500ms) - paused on hover or when Lightbox is open
  useEffect(() => {
    if (isPaused || lightboxIndex !== null) return;
    if (albums.length === 0) return;
    if (landscapeImages.length <= 1 && portraitImages.length <= 1 && albums.length <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, 1500);

    return () => clearInterval(timer);
  }, [handleNext, isPaused, lightboxIndex, albums.length, landscapeImages.length, portraitImages.length]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "PageUp") handlePrevAlbum();
    if (e.key === "PageDown") handleNextAlbum();
  };

  // Open Lightbox for specific image
  const openLightboxForImage = (targetImageId: string) => {
    setIsPaused(true);
    const targetIdx = albumImages.findIndex((img) => img.id === targetImageId);
    setLightboxIndex(targetIdx !== -1 ? targetIdx : 0);
  };

  // Active thumbnail index for the current album
  const activeThumbIndex = useMemo(() => {
    const idx = albumImages.findIndex(
      (img) => img.id === currentLandscape?.id || img.id === currentPortrait?.id,
    );
    return idx !== -1 ? idx : 0;
  }, [albumImages, currentLandscape?.id, currentPortrait?.id]);



  // Windowed Thumbnail Filmstrip: Lightweight sliding window (28 thumbs max in DOM)
  const THUMB_WINDOW_SIZE = 28;
  const { visibleThumbnails, hasLeadingThumbs, hasTrailingThumbs, leadCount, trailCount } =
    useMemo(() => {
      const total = albumImages.length;
      if (total <= THUMB_WINDOW_SIZE) {
        return {
          visibleThumbnails: albumImages.map((img, index) => ({ img, originalIndex: index })),
          hasLeadingThumbs: false,
          hasTrailingThumbs: false,
          leadCount: 0,
          trailCount: 0,
        };
      }

      const half = Math.floor(THUMB_WINDOW_SIZE / 2);
      let start = Math.max(0, activeThumbIndex - half);
      let end = start + THUMB_WINDOW_SIZE;

      if (end > total) {
        end = total;
        start = Math.max(0, end - THUMB_WINDOW_SIZE);
      }

      const slice = albumImages.slice(start, end).map((img, offset) => ({
        img,
        originalIndex: start + offset,
      }));

      return {
        visibleThumbnails: slice,
        hasLeadingThumbs: start > 0,
        hasTrailingThumbs: end < total,
        leadCount: start,
        trailCount: total - end,
      };
    }, [albumImages, activeThumbIndex]);

  // Smoothly scroll active thumbnail horizontally inside container without affecting window scroll
  useEffect(() => {
    const container = thumbStripRef.current;
    if (!container) return;

    const activeEl = container.querySelector<HTMLElement>(
      `[data-thumb-id="${currentLandscape?.id || currentPortrait?.id}"]`,
    );
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const offset = activeRect.left - containerRect.left;
      const targetLeft =
        container.scrollLeft + offset - container.clientWidth / 2 + activeRect.width / 2;
      container.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
  }, [currentLandscape?.id, currentPortrait?.id]);

  // Loading skeleton state
  if (isLoading) {
    return (
      <section className="mx-auto mt-20 max-w-[1400px] px-4 lg:px-8">
        <div className="relative min-h-[440px] sm:min-h-[520px] w-full overflow-hidden rounded-3xl border border-border/80 bg-muted/30 animate-pulse flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground/60 text-sm">
            <Sparkles className="h-4 w-4 animate-spin text-gold" />
            <span>កំពុងរៀបចំផ្ទាំងរូបភាពតាម Album ពីបណ្ណសារ...</span>
          </div>
        </div>
      </section>
    );
  }

  // If no albums or images found
  if (albums.length === 0 || !currentAlbum || albumImages.length === 0) {
    return null;
  }

  return (
    <section
      className="mx-auto mt-20 max-w-[1400px] px-4 lg:px-8"
      aria-label="ផ្ទាំងរូបភាពបណ្ណសារវត្តពារាំងតាម Album"
    >
      {/* Section Title Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>រូបភាពជ្រើសរើសតាម Album ពីបណ្ណសារ (Archive Albums Showcase)</span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
            🖼️ ទស្សនារូបភាពអនុស្សាវរីយ៍វត្តពារាំង តាម Album
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            រូបភាពទាំងអស់ត្រូវបានរៀបចំតាម Album នីមួយៗ និងបែងចែកជា ២ ផ្ទាំង (រូបភាពផ្ដេក និងរូបភាពបញ្ឈរ)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Play Toggle Button */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer select-none"
            title={isPaused ? "បន្ត Auto Slideshow" : "ផ្អាក Auto Slideshow"}
          >
            {isPaused ? (
              <>
                <Play className="h-3 w-3 text-gold fill-gold" />
                <span>បន្ត Slide</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3 text-gold" />
                <span>ផ្អាក</span>
              </>
            )}
          </button>

          {/* Master Slide & Album Counter */}
          <div className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="font-semibold text-gold">
              Album {toKhmerNumber(safeAlbumIndex + 1)}/{toKhmerNumber(albums.length)}
            </span>
            <span>•</span>
            <span>{toKhmerNumber(totalImagesAllAlbums)} រូបសរុប</span>
          </div>
        </div>
      </div>

      {/* Active Album Summary Bar */}
      <div className="mb-5 rounded-2xl border border-border/80 bg-card/70 p-3 sm:p-4 backdrop-blur-sm shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-gold/15 px-2.5 py-0.5 font-bold text-gold border border-gold/30 flex items-center gap-1">
                <span>{currentAlbum.festivalEmoji || "🎉"}</span>
                <span>{currentAlbum.festivalName}</span>
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground/80 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gold" />
                <span>ឆ្នាំ {toKhmerNumber(currentAlbum.year)}</span>
              </span>
              {currentAlbum.location && (
                <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3 text-gold" />
                  <span>{currentAlbum.location}</span>
                </span>
              )}
            </div>

            <h3 className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2 truncate">
              <FolderOpen className="h-4 w-4 text-gold shrink-0" />
              <span className="truncate">{currentAlbum.title}</span>
              <span className="text-xs font-normal text-muted-foreground shrink-0">
                ({toKhmerNumber(albumImages.length)} រូបក្នុង Album នេះ)
              </span>
            </h3>
          </div>

          {/* Album Controls: Prev Album / Next Album & Direct Link */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <div className="flex items-center gap-1 border border-border/70 rounded-full p-0.5 bg-background/80">
              <button
                type="button"
                onClick={handlePrevAlbum}
                title="Album មុន (PageUp)"
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-gold hover:text-primary-foreground text-muted-foreground transition-colors cursor-pointer"
                aria-label="Previous Album"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-foreground">
                {toKhmerNumber(safeAlbumIndex + 1)} / {toKhmerNumber(albums.length)}
              </span>
              <button
                type="button"
                onClick={handleNextAlbum}
                title="Album បន្ទាប់ (PageDown)"
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-gold hover:text-primary-foreground text-muted-foreground transition-colors cursor-pointer"
                aria-label="Next Album"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <Link
              to="/album/$albumId"
              params={{ albumId: currentAlbum.id }}
              className="rounded-full bg-gold/90 hover:bg-gold px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>ទស្សនា Album ពេញលេញ</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Two-Panel Gallery Container */}
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="focus:outline-none select-none"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* ========================================================================= */}
          {/* PANEL 1: LANDSCAPE (រូបភាពផ្ដេក) - 8 cols on Desktop (Full Width & Minimal Padding) */}
          {/* ========================================================================= */}
          {currentLandscape ? (
            <div
              onTouchStart={(e) => {
                if (e.touches[0]) touchStartXLandscape.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartXLandscape.current === null || !e.changedTouches[0]) return;
                const diff = touchStartXLandscape.current - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 40) {
                  if (diff > 0) handleNextLandscape();
                  else handlePrevLandscape();
                }
                touchStartXLandscape.current = null;
              }}
              className="lg:col-span-8 flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-neutral-950 shadow-xl transition-all"
            >
              {/* Panel Top Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-3.5 py-2 text-white">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-gold/20 text-gold">
                    <Monitor className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-semibold text-xs sm:text-sm text-gold tracking-wide">
                    រូបភាពផ្ដេក (Landscape)
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                    {toKhmerNumber(safeLandscapeIndex + 1)}/{toKhmerNumber(landscapeImages.length)}
                  </span>
                </div>

                {/* Panel Navigation Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevLandscape();
                    }}
                    aria-label="Previous Landscape Slide"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-gold hover:text-primary-foreground transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextLandscape();
                    }}
                    aria-label="Next Landscape Slide"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-gold hover:text-primary-foreground transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Photo Display Stage (Minimal margins, uses almost 100% of panel width, no crop) */}
              <div className="relative flex items-center justify-center p-1 sm:p-2 bg-neutral-950 overflow-hidden">
                <img
                  key={currentLandscape.id}
                  src={resolveImageUrl(currentLandscape.url || currentLandscape.thumbnailUrl)}
                  alt={currentLandscape.title || currentAlbum.title || "រូបភាពផ្ដេក"}
                  loading="eager"
                  decoding="async"
                  onClick={() => openLightboxForImage(currentLandscape.id)}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el.naturalWidth && el.naturalHeight && currentLandscape) {
                      const r = el.naturalWidth / el.naturalHeight;
                      setAspectMap((prev) => (prev[currentLandscape.id] === r ? prev : { ...prev, [currentLandscape.id]: r }));
                    }
                  }}
                  className="w-full h-auto max-h-[460px] sm:max-h-[500px] lg:max-h-[540px] object-contain rounded-xl sm:rounded-2xl cursor-zoom-in transition-all duration-300 hover:scale-[1.01] shadow-md animate-in fade-in-50 duration-500 block mx-auto"
                  title="ចុចលើរូបដើម្បីមើលរូបធំ (Lightbox)"
                />

                {/* Top-right Badges (Year & Festival) */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
                  {currentLandscape.year && (
                    <span className="rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md border border-white/20 flex items-center gap-1 shadow-sm">
                      <Calendar className="h-3 w-3 text-gold" />
                      <span>ឆ្នាំ {toKhmerNumber(currentLandscape.year)}</span>
                    </span>
                  )}
                  {currentLandscape.festivalName && (
                    <span className="rounded-full bg-gold/90 px-2.5 py-1 text-[11px] font-bold text-primary-foreground backdrop-blur-md shadow-sm truncate max-w-[130px] sm:max-w-none">
                      {currentLandscape.festivalName}
                    </span>
                  )}
                </div>

                {/* Top-left Lightbox Zoom Hint */}
                <div className="absolute top-3 left-3 z-10 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => openLightboxForImage(currentLandscape.id)}
                    className="rounded-full bg-black/65 hover:bg-gold hover:text-primary-foreground px-2.5 py-1 text-[11px] font-medium text-white/95 backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="ពង្រីករូបភាពធំពេញអេក្រង់"
                  >
                    <Maximize2 className="h-3 w-3 text-gold" />
                    <span className="hidden sm:inline">មើលរូបធំ</span>
                    <span className="sm:hidden">Zoom</span>
                  </button>
                </div>
              </div>

              {/* Bottom Caption & Action Bar */}
              <div className="border-t border-white/10 bg-neutral-900/95 px-3.5 py-2.5 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5 text-left">
                    <p className="text-xs font-medium text-gold flex items-center gap-1.5">
                      <Tag className="h-3 w-3 shrink-0" />
                      <span className="truncate">Album: {currentAlbum.title}</span>
                    </p>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white truncate">
                      {currentLandscape.title || currentAlbum.title || "រូបភាពបណ្ណសារវត្តពារាំង"}
                    </h4>
                  </div>

                  <Link
                    to="/album/$albumId"
                    params={{ albumId: currentAlbum.id }}
                    className="shrink-0 rounded-full bg-white/15 hover:bg-gold hover:text-primary-foreground px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/20 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <Images className="h-3.5 w-3.5" />
                    <span>មើល Album</span>
                  </Link>
                </div>

                {/* Dot Indicators for Landscape */}
                {landscapeImages.length > 1 && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {landscapeImages.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={() => setLandscapeIndex(dotIdx)}
                        aria-label={`Landscape slide ${dotIdx + 1}`}
                        className={cn(
                          "h-1 rounded-full transition-all duration-300 cursor-pointer",
                          dotIdx === safeLandscapeIndex
                            ? "w-5 bg-gold"
                            : "w-1 bg-white/30 hover:bg-white/70",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-8 flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-neutral-950 shadow-xl transition-all">
              {/* Panel Top Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-3.5 py-2 text-white">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-gold/20 text-gold">
                    <Monitor className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-semibold text-xs sm:text-sm text-gold tracking-wide">
                    រូបភាពផ្ដេក (Landscape)
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                    {toKhmerNumber(0)}/{toKhmerNumber(0)}
                  </span>
                </div>
              </div>

              {/* Clean Professional Empty State Stage */}
              <div className="relative flex min-h-[460px] sm:min-h-[500px] lg:min-h-[540px] flex-col items-center justify-center p-6 text-center bg-neutral-950">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 border border-white/10 text-gold/80 mb-3 shadow-inner">
                  <Monitor className="h-8 w-8" />
                </div>
                <h4 className="font-display text-base sm:text-lg font-bold text-white">
                  មិនមានរូបភាពផ្ដេក
                </h4>
                <p className="mt-1 max-w-sm text-xs text-white/60">
                  Album &ldquo;{currentAlbum.title}&rdquo; មិនមានរូបភាពទម្រង់ផ្ដេក (Landscape) ទេ។ សូមទស្សនារូបភាពបញ្ឈរនៅផ្ទាំងក្បែរនេះ។
                </p>
              </div>

              {/* Bottom Info Bar */}
              <div className="border-t border-white/10 bg-neutral-900/95 px-3.5 py-2.5 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5 text-left">
                    <p className="text-xs font-medium text-gold flex items-center gap-1.5">
                      <Tag className="h-3 w-3 shrink-0" />
                      <span className="truncate">Album: {currentAlbum.title}</span>
                    </p>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white/80 truncate">
                      {currentAlbum.title}
                    </h4>
                  </div>

                  <Link
                    to="/album/$albumId"
                    params={{ albumId: currentAlbum.id }}
                    className="shrink-0 rounded-full bg-white/15 hover:bg-gold hover:text-primary-foreground px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/20 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <Images className="h-3.5 w-3.5" />
                    <span>មើល Album</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PANEL 2: PORTRAIT (រូបភាពបញ្ឈរ) - 4 cols on Desktop (Tightly Framed, No Big Empty Spaces) */}
          {/* ========================================================================= */}
          {currentPortrait ? (
            <div
              onTouchStart={(e) => {
                if (e.touches[0]) touchStartXPortrait.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartXPortrait.current === null || !e.changedTouches[0]) return;
                const diff = touchStartXPortrait.current - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 40) {
                  if (diff > 0) handleNextPortrait();
                  else handlePrevPortrait();
                }
                touchStartXPortrait.current = null;
              }}
              className="lg:col-span-4 w-full max-w-md mx-auto lg:max-w-none flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-neutral-950 shadow-xl transition-all"
            >
              {/* Panel Top Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-3.5 py-2 text-white">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-gold/20 text-gold">
                    <Smartphone className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-semibold text-xs sm:text-sm text-gold tracking-wide">
                    រូបភាពបញ្ឈរ (Portrait)
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                    {toKhmerNumber(safePortraitIndex + 1)}/{toKhmerNumber(portraitImages.length)}
                  </span>
                </div>

                {/* Panel Navigation Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevPortrait();
                    }}
                    aria-label="Previous Portrait Slide"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-gold hover:text-primary-foreground transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextPortrait();
                    }}
                    aria-label="Next Portrait Slide"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-gold hover:text-primary-foreground transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Photo Display Stage (Tightly framed portrait height, no crop, minimal side space) */}
              <div className="relative flex items-center justify-center p-1 sm:p-2 bg-neutral-950 overflow-hidden">
                <img
                  key={currentPortrait.id}
                  src={resolveImageUrl(currentPortrait.url || currentPortrait.thumbnailUrl)}
                  alt={currentPortrait.title || currentAlbum.title || "រូបភាពបញ្ឈរ"}
                  loading="eager"
                  decoding="async"
                  onClick={() => openLightboxForImage(currentPortrait.id)}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el.naturalWidth && el.naturalHeight && currentPortrait) {
                      const r = el.naturalWidth / el.naturalHeight;
                      setAspectMap((prev) => (prev[currentPortrait.id] === r ? prev : { ...prev, [currentPortrait.id]: r }));
                    }
                  }}
                  className="w-auto h-auto max-h-[480px] sm:max-h-[520px] lg:max-h-[560px] max-w-full object-contain rounded-xl sm:rounded-2xl cursor-zoom-in transition-all duration-300 hover:scale-[1.01] shadow-md animate-in fade-in-50 duration-500 block mx-auto"
                  title="ចុចលើរូបដើម្បីមើលរូបធំ (Lightbox)"
                />

                {/* Top-right Badges (Year & Festival) */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
                  {currentPortrait.year && (
                    <span className="rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md border border-white/20 flex items-center gap-1 shadow-sm">
                      <Calendar className="h-3 w-3 text-gold" />
                      <span>ឆ្នាំ {toKhmerNumber(currentPortrait.year)}</span>
                    </span>
                  )}
                  {currentPortrait.festivalName && (
                    <span className="rounded-full bg-gold/90 px-2.5 py-1 text-[11px] font-bold text-primary-foreground backdrop-blur-md shadow-sm truncate max-w-[110px] sm:max-w-none">
                      {currentPortrait.festivalName}
                    </span>
                  )}
                </div>

                {/* Top-left Lightbox Zoom Hint */}
                <div className="absolute top-3 left-3 z-10 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => openLightboxForImage(currentPortrait.id)}
                    className="rounded-full bg-black/65 hover:bg-gold hover:text-primary-foreground px-2.5 py-1 text-[11px] font-medium text-white/95 backdrop-blur-md border border-white/20 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="ពង្រីករូបភាពធំពេញអេក្រង់"
                  >
                    <Maximize2 className="h-3 w-3 text-gold" />
                    <span className="hidden sm:inline">មើលរូបធំ</span>
                    <span className="sm:hidden">Zoom</span>
                  </button>
                </div>
              </div>

              {/* Bottom Caption & Action Bar */}
              <div className="border-t border-white/10 bg-neutral-900/95 px-3.5 py-2.5 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5 text-left">
                    <p className="text-xs font-medium text-gold flex items-center gap-1.5">
                      <Tag className="h-3 w-3 shrink-0" />
                      <span className="truncate">Album: {currentAlbum.title}</span>
                    </p>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white truncate">
                      {currentPortrait.title || currentAlbum.title || "រូបភាពបណ្ណសារវត្តពារាំង"}
                    </h4>
                  </div>

                  <Link
                    to="/album/$albumId"
                    params={{ albumId: currentAlbum.id }}
                    className="shrink-0 rounded-full bg-white/15 hover:bg-gold hover:text-primary-foreground px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/20 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <Images className="h-3.5 w-3.5" />
                    <span>មើល Album</span>
                  </Link>
                </div>

                {/* Dot Indicators for Portrait */}
                {portraitImages.length > 1 && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {portraitImages.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={() => setPortraitIndex(dotIdx)}
                        aria-label={`Portrait slide ${dotIdx + 1}`}
                        className={cn(
                          "h-1 rounded-full transition-all duration-300 cursor-pointer",
                          dotIdx === safePortraitIndex
                            ? "w-5 bg-gold"
                            : "w-1 bg-white/30 hover:bg-white/70",
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:col-span-4 w-full max-w-md mx-auto lg:max-w-none flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-neutral-950 shadow-xl transition-all">
              {/* Panel Top Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-neutral-900/90 px-3.5 py-2 text-white">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-gold/20 text-gold">
                    <Smartphone className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-semibold text-xs sm:text-sm text-gold tracking-wide">
                    រូបភាពបញ្ឈរ (Portrait)
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                    {toKhmerNumber(0)}/{toKhmerNumber(0)}
                  </span>
                </div>
              </div>

              {/* Clean Professional Empty State Stage */}
              <div className="relative flex min-h-[480px] sm:min-h-[520px] lg:min-h-[560px] flex-col items-center justify-center p-6 text-center bg-neutral-950">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 border border-white/10 text-emerald-400/80 mb-3 shadow-inner">
                  <Smartphone className="h-8 w-8" />
                </div>
                <h4 className="font-display text-base sm:text-lg font-bold text-white">
                  មិនមានរូបភាពបញ្ឈរ
                </h4>
                <p className="mt-1 max-w-xs text-xs text-white/60">
                  Album &ldquo;{currentAlbum.title}&rdquo; មិនមានរូបភាពទម្រង់បញ្ឈរ (Portrait) ទេ។ សូមទស្សនារូបភាពផ្ដេកនៅផ្ទាំងក្បែរនេះ។
                </p>
              </div>

              {/* Bottom Info Bar */}
              <div className="border-t border-white/10 bg-neutral-900/95 px-3.5 py-2.5 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-0.5 text-left">
                    <p className="text-xs font-medium text-gold flex items-center gap-1.5">
                      <Tag className="h-3 w-3 shrink-0" />
                      <span className="truncate">Album: {currentAlbum.title}</span>
                    </p>
                    <h4 className="font-display text-sm sm:text-base font-bold text-white/80 truncate">
                      {currentAlbum.title}
                    </h4>
                  </div>

                  <Link
                    to="/album/$albumId"
                    params={{ albumId: currentAlbum.id }}
                    className="shrink-0 rounded-full bg-white/15 hover:bg-gold hover:text-primary-foreground px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md border border-white/20 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <Images className="h-3.5 w-3.5" />
                    <span>មើល Album</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Responsive Multi-Thumbnail Filmstrip (Overview Ribbon) */}
        <div className="mt-6 w-full rounded-2xl border border-border/80 bg-card/70 p-3 sm:p-4 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Images className="h-3.5 w-3.5 text-gold" />
              <span>
                រូបភាពទាំងអស់ក្នុង Album &ldquo;{currentAlbum.title}&rdquo; (ចុចលើរូបដើម្បីប្តូរ Slide
                ឬពង្រីក Lightbox)
              </span>
            </span>
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gold" /> រូបភាពផ្ដេក (
                {toKhmerNumber(landscapeImages.length)})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> រូបភាពបញ្ឈរ (
                {toKhmerNumber(portraitImages.length)})
              </span>
            </div>
          </div>

          <div
            ref={thumbStripRef}
            className="no-scrollbar flex items-center gap-2 sm:gap-3 overflow-x-auto py-1"
          >
            {hasLeadingThumbs && (
              <button
                type="button"
                onClick={() => {
                  const targetIdx = Math.max(0, activeThumbIndex - THUMB_WINDOW_SIZE);
                  const target = albumImages[targetIdx];
                  if (target) {
                    const ratio = aspectMap[target.id];
                    const isPort =
                      ratio !== undefined
                        ? ratio < 0.95
                        : !!(target as any).tall;
                    if (isPort) {
                      const pIdx = portraitImages.findIndex((p) => p.id === target.id);
                      if (pIdx !== -1) setPortraitIndex(pIdx);
                    } else {
                      const lIdx = landscapeImages.findIndex((l) => l.id === target.id);
                      if (lIdx !== -1) setLandscapeIndex(lIdx);
                    }
                  }
                }}
                className="shrink-0 h-14 sm:h-18 px-3 rounded-xl border border-border/70 bg-card/90 hover:bg-gold/20 hover:border-gold/50 text-xs font-semibold text-muted-foreground flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={`មើលរូបភាពមុនៗ (${toKhmerNumber(leadCount)} រូបទៀត)`}
              >
                <ChevronLeft className="h-4 w-4 text-gold" />
                <span className="text-[10px] whitespace-nowrap">+{toKhmerNumber(leadCount)} មុន</span>
              </button>
            )}

            {visibleThumbnails.map(({ img: thumb }) => {
              const thumbUrl = resolveImageUrl(thumb.thumbnailUrl || thumb.url);
              const isLandscapeMatch = currentLandscape?.id === thumb.id;
              const isPortraitMatch = currentPortrait?.id === thumb.id;
              const isSelected = isLandscapeMatch || isPortraitMatch;

              const thumbRatio = aspectMap[thumb.id];
              const isPortraitItem =
                thumbRatio !== undefined ? thumbRatio < 0.95 : !!(thumb as any).tall;

              return (
                <button
                  key={thumb.id}
                  type="button"
                  data-thumb-id={thumb.id}
                  onClick={() => {
                    if (isPortraitItem) {
                      const pIdx = portraitImages.findIndex((p) => p.id === thumb.id);
                      if (pIdx !== -1) setPortraitIndex(pIdx);
                    } else {
                      const lIdx = landscapeImages.findIndex((l) => l.id === thumb.id);
                      if (lIdx !== -1) setLandscapeIndex(lIdx);
                    }
                  }}
                  className={cn(
                    "group/thumb relative h-14 sm:h-18 w-20 sm:w-24 shrink-0 overflow-hidden rounded-xl border bg-neutral-950 transition-all duration-200 cursor-pointer",
                    isSelected
                      ? "border-gold ring-2 ring-gold/70 scale-102 shadow-md"
                      : "border-border/60 opacity-65 hover:opacity-100 hover:border-gold/50",
                  )}
                  title={`${thumb.title || currentAlbum.title || "រូបភាព"} (${isPortraitItem ? "បញ្ឈរ" : "ផ្ដេក"})`}
                >
                  <img
                    src={thumbUrl}
                    alt={thumb.title || currentAlbum.title || "Thumbnail"}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain p-0.5"
                  />
                  {/* Category Pill on Thumbnail */}
                  <span
                    className={cn(
                      "absolute bottom-1 right-1 rounded px-1 text-[8px] font-bold",
                      isPortraitItem
                        ? "bg-emerald-500/80 text-white"
                        : "bg-gold/80 text-primary-foreground",
                    )}
                  >
                    {isPortraitItem ? "បញ្ឈរ" : "ផ្ដេក"}
                  </span>
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-gold rounded-xl pointer-events-none" />
                  )}
                </button>
              );
            })}

            {hasTrailingThumbs && (
              <button
                type="button"
                onClick={() => {
                  const targetIdx = Math.min(
                    albumImages.length - 1,
                    activeThumbIndex + THUMB_WINDOW_SIZE,
                  );
                  const target = albumImages[targetIdx];
                  if (target) {
                    const ratio = aspectMap[target.id];
                    const isPort =
                      ratio !== undefined
                        ? ratio < 0.95
                        : !!(target as any).tall;
                    if (isPort) {
                      const pIdx = portraitImages.findIndex((p) => p.id === target.id);
                      if (pIdx !== -1) setPortraitIndex(pIdx);
                    } else {
                      const lIdx = landscapeImages.findIndex((l) => l.id === target.id);
                      if (lIdx !== -1) setLandscapeIndex(lIdx);
                    }
                  }
                }}
                className="shrink-0 h-14 sm:h-18 px-3 rounded-xl border border-border/70 bg-card/90 hover:bg-gold/20 hover:border-gold/50 text-xs font-semibold text-muted-foreground flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                title={`មើលរូបភាពបន្ទាប់ (${toKhmerNumber(trailCount)} រូបទៀត)`}
              >
                <ChevronRight className="h-4 w-4 text-gold" />
                <span className="text-[10px] whitespace-nowrap">+{toKhmerNumber(trailCount)} ទៀត</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Reusable Viewer (Opened upon clicking image or zoom button) */}
      <Lightbox
        photos={lightboxPhotos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </section>
  );
}
