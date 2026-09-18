import { createFileRoute, notFound, Link, useParams, useRouter, useNavigate, useCanGoBack } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { Share2, Download, Images, ArrowLeft, Film, Folder } from "lucide-react";
import { Lightbox } from "@/components/site/Lightbox";
import { toKhmerNumber, type Album } from "@/data/archive";
import { cn, downloadArchiveImage } from "@/lib/utils";
import { toast } from "sonner";
import { useAlbum, useAlbums, useAlbumPhotos, useAlbumVideos } from "@/hooks/useArchiveData";
import { trackAlbumView } from "@/lib/analytics";
import { LikeButton } from "@/components/site/LikeButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { getPostgresAlbumById } from "@/server/queries";
import { resolveImageUrl, BROKEN_IMAGE_FALLBACK } from "@/lib/asset-resolver";
import { AlbumCard } from "@/components/site/AlbumCard";

const getAlbumServerFn = createServerFn({ method: "GET" })
  .validator((albumId: string) => albumId)
  .handler(async ({ data: albumId }): Promise<Album | null> => {
    const rawAlbum = await getPostgresAlbumById(albumId);
    if (!rawAlbum) return null;
    return {
      ...rawAlbum,
      festival: {
        ...rawAlbum.festival,
        cover: resolveImageUrl(rawAlbum.festival?.cover, rawAlbum.festivalId),
      },
    };
  });

export type AlbumDetailSearch = {
  from?: string | undefined;
  year?: number | "all" | undefined;
  festival?: string | undefined;
};

export const Route = createFileRoute("/album/$albumId")({
  validateSearch: (search: Record<string, unknown>): AlbumDetailSearch => {
    const rawFrom = search["from"];
    const from =
      typeof rawFrom === "string" && rawFrom.trim() ? rawFrom.trim() : undefined;

    const rawYear = search["year"];
    let year: number | "all" | undefined = undefined;
    if (typeof rawYear === "number" && !isNaN(rawYear)) {
      year = rawYear;
    } else if (typeof rawYear === "string") {
      if (rawYear === "all") {
        year = "all";
      } else {
        const parsed = parseInt(rawYear, 10);
        if (!isNaN(parsed)) year = parsed;
      }
    }

    const rawFestival = search["festival"];
    const festival =
      typeof rawFestival === "string" && rawFestival.trim()
        ? rawFestival.trim()
        : undefined;

    return {
      from,
      year,
      festival,
    };
  },
  loader: async ({ params }) => {
    const album = await getAlbumServerFn({ data: params.albumId });
    if (!album) throw notFound();
    return { album };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "រកមិនឃើញ Album" }, { name: "robots", content: "noindex" }],
      };
    }
    const { album } = loaderData;
    const displayTitle = album.title && album.title !== album.festival.name
      ? `${album.title} (${album.festival.name})`
      : album.festival.name;
    const title = `${displayTitle} ឆ្នាំ ${toKhmerNumber(album.year)} — វត្តពារាំង | Wat Peareang Archive`;
    const description = `${toKhmerNumber(album.photoCount)} រូបភាពពី ${displayTitle} ក្នុងឆ្នាំ ${toKhmerNumber(album.year)} នៅវត្តពារាំង។`;
    const canonicalUrl = `https://wat-peareang-2027.onrender.com/album/${album.id}`;
    const coverUrl = album.coverImage || album.festival.cover;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
        ...(coverUrl ? [{ property: "og:image", content: coverUrl }] : []),
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
      ],
    };
  },
  component: AlbumDetail,
});

function AlbumDetail() {
  const { album: initialAlbum } = Route.useLoaderData();
  const { albumId } = useParams({ from: "/album/$albumId" });
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  const { data: dbAlbum } = useAlbum(albumId);
  const album = dbAlbum ?? initialAlbum;

  const { data: allAlbums = [] } = useAlbums();

  // Direct children (Sub-albums) belonging to this album, sorted by sortOrder
  const subAlbums = useMemo(() => {
    if (!album?.id) return [];
    return allAlbums
      .filter((a) => a.parentAlbumId === album.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [allAlbums, album?.id]);

  // Full ancestor breadcrumb chain (Root -> Parent -> Grandparent -> ... -> direct Parent)
  const breadcrumbChain = useMemo(() => {
    if (!album?.parentAlbumId) return [];
    const chain: Album[] = [];
    const albumMap = new Map(allAlbums.map((a) => [a.id, a]));
    albumMap.set(album.id, album);

    let currentParentId: string | null | undefined = album.parentAlbumId;
    const visited = new Set<string>([album.id]);

    while (currentParentId) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);

      const parent = albumMap.get(currentParentId);
      if (parent) {
        chain.unshift(parent);
        currentParentId = parent.parentAlbumId;
      } else {
        break;
      }
    }

    return chain;
  }, [allAlbums, album]);

  const handleBack = () => {
    if (search.from === "home") {
      navigate({
        to: "/",
        search: {
          year: search.year,
          festival: search.festival,
        },
      });
      return;
    }

    if (search.from === "albums") {
      navigate({
        to: "/albums",
        search: {
          year: search.year === "all" ? undefined : search.year,
          festival: search.festival,
        },
      });
      return;
    }

    if (canGoBack && typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({
        to: "/albums",
        search: {
          year: album.year,
          festival: album.festivalId,
        },
      });
    }
  };

  const backHref = (() => {
    if (search.from === "home") {
      const params = new URLSearchParams();
      if (search.year) {
        params.set("year", String(search.year));
      }
      if (search.festival) {
        params.set("festival", search.festival);
      }
      const qs = params.toString();
      return qs ? `/?${qs}` : "/";
    }
    if (search.from === "albums") {
      const params = new URLSearchParams();
      if (search.year && search.year !== "all") {
        params.set("year", String(search.year));
      }
      if (search.festival) {
        params.set("festival", search.festival);
      }
      const qs = params.toString();
      return qs ? `/albums?${qs}` : "/albums";
    }
    return `/albums?year=${album.year}&festival=${encodeURIComponent(album.festivalId)}`;
  })();

  const { data: photos = [] } = useAlbumPhotos(albumId);
  const { data: videos = [] } = useAlbumVideos(albumId);
  const [mediaTab, setMediaTab] = useState<"photos" | "videos">("photos");
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (photos.length === 0 && videos.length > 0) {
      setMediaTab("videos");
    }
  }, [photos.length, videos.length]);

  useEffect(() => {
    if (albumId) {
      trackAlbumView(albumId);
    }
  }, [albumId]);

  const displayPhotoCount = photos.length > 0 ? photos.length : album.photoCount;
  const displayVideoCount = videos.length > 0 ? videos.length : (album.videoCount || 0);

  return (
    <>
      <section className="relative h-[340px] w-full overflow-hidden bg-secondary md:h-[420px]">
        {/* Ambient backdrop for portrait/irregular covers */}
        <img
          src={resolveImageUrl(album.coverImage || album.festival.cover, album.festivalId)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-lg scale-110 opacity-30 dark:opacity-20 pointer-events-none"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== BROKEN_IMAGE_FALLBACK) {
              target.src = BROKEN_IMAGE_FALLBACK;
            }
          }}
        />
        <img
          src={resolveImageUrl(album.coverImage || album.festival.cover, album.festivalId)}
          alt={album.festival.name}
          width={1024}
          height={768}
          className="relative z-[1] h-full w-full object-cover object-center"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== BROKEN_IMAGE_FALLBACK) {
              target.src = BROKEN_IMAGE_FALLBACK;
            }
          }}
        />
        <div className="absolute inset-0 z-[2] hero-scrim" />
        <div className="absolute inset-0 z-[3]">
          <div className="mx-auto flex h-full max-w-[1400px] flex-col justify-end px-4 pb-8 lg:px-8">
            <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
              <a
                href={backHref}
                onClick={(e) => {
                  e.preventDefault();
                  handleBack();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/85 hover:bg-background px-3 py-1.5 backdrop-blur-sm text-foreground hover:text-gold transition-colors font-medium shadow-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Albums
              </a>
              {breadcrumbChain.map((ancestor) => (
                <div key={ancestor.id} className="flex items-center gap-1.5">
                  <span className="text-white/60 font-bold select-none">/</span>
                  <Link
                    to="/album/$albumId"
                    params={{ albumId: ancestor.id }}
                    {...(search ? { search } : {})}
                    className="inline-flex items-center gap-1 rounded-full bg-background/75 hover:bg-background px-3 py-1.5 backdrop-blur-sm text-foreground hover:text-gold transition-colors font-medium truncate max-w-[180px] sm:max-w-[240px] shadow-xs"
                    title={ancestor.title || ancestor.festival.name}
                  >
                    <Folder className="h-3 w-3 text-gold shrink-0" />
                    <span className="truncate">{ancestor.title || ancestor.festival.name}</span>
                  </Link>
                </div>
              ))}
              {breadcrumbChain.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-white/60 font-bold select-none">/</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-gold/25 border border-gold/40 px-3 py-1.5 backdrop-blur-sm text-white font-semibold truncate max-w-[180px] sm:max-w-[240px] shadow-xs"
                    title={album.title || album.festival.name}
                  >
                    <span className="truncate">{album.title || album.festival.name}</span>
                  </span>
                </div>
              )}
            </nav>
            <h1 className="flex items-center gap-3 text-2xl text-primary-foreground md:text-4xl">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
                style={{ backgroundColor: album.festival.accent }}
              >
                {album.festival.emoji}
              </span>
              <span className="min-w-0 truncate">{album.title || album.festival.name}</span>
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-primary-foreground/85">
              <span>ឆ្នាំ {toKhmerNumber(album.year)}</span>
              {subAlbums.length > 0 && (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Folder className="h-4 w-4" /> {toKhmerNumber(subAlbums.length)} អាល់ប៊ុមរង
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Images className="h-4 w-4" /> {toKhmerNumber(displayPhotoCount)} រូបភាព
              </span>
              {displayVideoCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Film className="h-4 w-4" /> {toKhmerNumber(displayVideoCount)} វីដេអូ
                </span>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <LikeButton resourceType="album" resourceId={album.id} variant="pill" size="md" />
              <FavoriteButton
                resourceType="album"
                resourceId={album.id}
                titleText={album.festival.name}
                variant="pill"
                size="md"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(window.location.href);
                  toast.success("បានចម្លង Link");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-4 py-2 text-sm hover:bg-background transition-colors"
              >
                <Share2 className="h-4 w-4" /> ចែករំលែក
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetSrc = resolveImageUrl(album.coverImage || album.festival?.cover || photos[0]?.src, album.festivalId);
                  if (!targetSrc) return;
                  toast("កំពុងទាញយករូបភាព...");
                  const filename = `${album.id || "album"}-cover.jpg`;
                  const success = await downloadArchiveImage(targetSrc, filename);
                  if (success) {
                    toast.success("បានទាញយករូបភាពដោយជោគជ័យ");
                  } else {
                    toast.error("មិនអាចទាញយករូបភាពបានឡើយ");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-4 py-2 text-sm hover:bg-background transition-colors"
              >
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
        {/* Sub-albums Section */}
        {subAlbums.length > 0 && (
          <div className="mb-12 space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold/15 text-gold text-base">
                  📁
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  អាល់ប៊ុមរង ({toKhmerNumber(subAlbums.length)})
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                ចុចលើ Album ដើម្បីមើលរូបថត ឬថតរងបន្ត
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {subAlbums.map((child, i) => (
                <AlbumCard
                  key={child.id}
                  album={child}
                  index={i + 1}
                  albumLinkSearch={search}
                />
              ))}
            </div>
          </div>
        )}

        {/* Media Switcher Tabs (if videos exist) */}
        {videos.length > 0 && (
          <div className="mb-8 flex items-center gap-3 border-b border-border/60 pb-4">
            <button
              type="button"
              onClick={() => setMediaTab("photos")}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all cursor-pointer",
                mediaTab === "photos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/70 text-secondary-foreground hover:bg-secondary",
              )}
            >
              <Images className="h-4 w-4" /> រូបភាព ({toKhmerNumber(photos.length)})
            </button>
            <button
              type="button"
              onClick={() => setMediaTab("videos")}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all cursor-pointer",
                mediaTab === "videos"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/70 text-secondary-foreground hover:bg-secondary",
              )}
            >
              <Film className="h-4 w-4" /> វីដេអូ ({toKhmerNumber(videos.length)})
            </button>
          </div>
        )}

        {/* Photos Grid */}
        {mediaTab === "photos" && (
          <>
            {photos.length > 0 ? (
              <div className="columns-2 gap-4 [column-fill:_balance] md:columns-3 xl:columns-4">
                {photos.map((p, i) => (
                  <div
                    key={p.id}
                    className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-card shadow-soft transition-all hover:shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      className="block w-full overflow-hidden text-left cursor-pointer"
                    >
                      <img
                        src={resolveImageUrl(p.thumbnailUrl || p.src, album.festivalId)}
                        alt={p.caption}
                        loading="lazy"
                        className="w-full h-auto block object-contain transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== BROKEN_IMAGE_FALLBACK) {
                            target.src = BROKEN_IMAGE_FALLBACK;
                          }
                        }}
                      />
                    </button>

                    {/* Quick actions overlay on image */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-between p-3">
                      <div className="flex justify-end gap-1.5 pointer-events-auto">
                        <FavoriteButton
                          resourceType="image"
                          resourceId={p.id}
                          titleText={p.caption || "រូបភាព"}
                          variant="floating"
                          size="sm"
                        />
                        <LikeButton resourceType="image" resourceId={p.id} variant="floating" size="sm" />
                      </div>

                      <div className="text-white text-xs truncate drop-shadow-md">{p.caption}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : videos.length > 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
                <Images className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p>មិនទាន់មានរូបភាពក្នុង Album នេះនៅឡើយទេ។</p>
              </div>
            ) : subAlbums.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
                <Images className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p>មិនទាន់មានរូបភាព ឬអាល់ប៊ុមរងក្នុង Album នេះនៅឡើយទេ។</p>
              </div>
            ) : null}
          </>
        )}

        {/* Videos Grid */}
        {mediaTab === "videos" && (
          <>
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card p-3 shadow-soft transition-all hover:shadow-card"
                  >
                    {/* Native HTML5 video player preserving natural aspect ratio */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                      <video
                        controls
                        preload="metadata"
                        playsInline
                        poster={v.thumbnailUrl || undefined}
                        src={v.url}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="mt-3 flex flex-1 flex-col justify-between space-y-2 px-1">
                      <div>
                        <h4 className="font-medium text-foreground text-sm line-clamp-2" title={v.title}>
                          {v.title}
                        </h4>
                        {v.filename && (
                          <p className="text-xs text-muted-foreground truncate font-mono mt-0.5" title={v.filename}>
                            {v.filename}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                        {v.duration && v.duration > 0 ? (
                          <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                            ⏱️ {Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, "0")}
                          </span>
                        ) : null}
                        {v.width && v.height ? (
                          <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                            📐 {v.width}×{v.height}
                          </span>
                        ) : null}
                        {v.size && v.size > 0 ? (
                          <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">
                            📦 {(v.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
                <Film className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p>មិនទាន់មានវីដេអូក្នុង Album នេះនៅឡើយទេ។</p>
              </div>
            )}
          </>
        )}
      </section>

      <Lightbox
        photos={photos}
        index={index}
        onClose={() => setIndex(null)}
        onIndexChange={setIndex}
      />
    </>
  );
}
