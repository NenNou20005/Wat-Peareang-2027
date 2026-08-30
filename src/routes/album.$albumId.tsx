import { createFileRoute, notFound, Link, useParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Share2, Download, Images, ArrowLeft } from "lucide-react";
import { Lightbox } from "@/components/site/Lightbox";
import { toKhmerNumber, type Album } from "@/data/archive";
import { cn, downloadArchiveImage } from "@/lib/utils";
import { toast } from "sonner";
import { useAlbum, useAlbumPhotos } from "@/hooks/useArchiveData";
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
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (albumId) {
      trackAlbumView(albumId);
    }
  }, [albumId]);

  const displayPhotoCount = photos.length > 0 ? photos.length : album.photoCount;

  return (
    <>
      <section className="relative h-[340px] w-full overflow-hidden md:h-[420px]">
        <img
          src={album.festival.cover}
          alt={album.festival.name}
          width={1024}
          height={768}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 hero-scrim" />
        <div className="absolute inset-0">
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
        <div className="columns-2 gap-4 [column-fill:_balance] md:columns-3 xl:columns-4">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="group relative mb-4 block w-full overflow-hidden rounded-2xl bg-card shadow-soft transition-all hover:shadow-card"
            >
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="block w-full overflow-hidden text-left"
              >
                <img
                  src={p.src}
                  alt={p.caption}
                  loading="lazy"
                  className={cn(
                    "w-full object-cover transition-transform duration-500 group-hover:scale-105",
                    p.tall ? "aspect-[3/4]" : "aspect-[4/3]",
                  )}
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
