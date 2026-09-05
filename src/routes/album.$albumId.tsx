import { createFileRoute, notFound, Link, useParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Share2, Download, Images, ArrowLeft, Film } from "lucide-react";
import { Lightbox } from "@/components/site/Lightbox";
import { toKhmerNumber, type Album } from "@/data/archive";
import { cn, downloadArchiveImage } from "@/lib/utils";
import { toast } from "sonner";
import { useAlbum, useAlbumPhotos, useAlbumVideos } from "@/hooks/useArchiveData";
import { trackAlbumView } from "@/lib/analytics";
import { LikeButton } from "@/components/site/LikeButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { getPostgresAlbumById } from "@/server/queries";
import { resolveImageUrl } from "@/lib/asset-resolver";

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

export const Route = createFileRoute("/album/$albumId")({
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
    const title = `${album.festival.name} ឆ្នាំ ${toKhmerNumber(album.year)} — បណ្ណសារបុណ្យខ្មែរ`;
    const description = `${toKhmerNumber(album.photoCount)} រូបភាពពី ${album.festival.name} ក្នុងឆ្នាំ ${toKhmerNumber(album.year)}។`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: AlbumDetail,
});

function AlbumDetail() {
  const { album: initialAlbum } = Route.useLoaderData();
  const { albumId } = useParams({ from: "/album/$albumId" });

  const { data: dbAlbum } = useAlbum(albumId);
  const album = dbAlbum ?? initialAlbum;

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
          src={album.festival.cover}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-lg scale-110 opacity-30 dark:opacity-20 pointer-events-none"
        />
        <img
          src={album.festival.cover}
          alt={album.festival.name}
          width={1024}
          height={768}
          className="relative z-[1] h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 z-[2] hero-scrim" />
        <div className="absolute inset-0 z-[3]">
          <div className="mx-auto flex h-full max-w-[1400px] flex-col justify-end px-4 pb-8 lg:px-8">
            <Link
              to="/albums"
              className="mb-4 inline-flex w-max items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs backdrop-blur-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Albums
            </Link>
            <h1 className="flex items-center gap-3 text-2xl text-primary-foreground md:text-4xl">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
                style={{ backgroundColor: album.festival.accent }}
              >
                {album.festival.emoji}
              </span>
              <span className="min-w-0 truncate">{album.festival.name}</span>
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-primary-foreground/85">
              <span>ឆ្នាំ {toKhmerNumber(album.year)}</span>
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
                  const targetSrc = album.festival?.cover || photos[0]?.src;
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
                        src={p.src}
                        alt={p.caption}
                        loading="lazy"
                        className="w-full h-auto block object-contain transition-transform duration-500 group-hover:scale-105"
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
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
                <Images className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p>មិនទាន់មានរូបភាពក្នុង Album នេះនៅឡើយទេ។</p>
              </div>
            )}
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
