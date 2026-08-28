import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlbumGrid } from "@/components/site/YearSection";
import { toKhmerNumber } from "@/data/archive";
import { useUserFavorites } from "@/hooks/useInteractions";
import { useAlbums } from "@/hooks/useArchiveData";
import { useFavorites } from "@/hooks/useFavorites";
import { Lightbox, type LightboxPhoto } from "@/components/site/Lightbox";
import { LikeButton } from "@/components/site/LikeButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { Bookmark, Images, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "ចំណូលចិត្ត — បណ្ណសារបុណ្យខ្មែរ" },
      { name: "description", content: "Albums និងរូបភាពបុណ្យខ្មែរដែលអ្នកបានរក្សាទុកជាចំណូលចិត្ត។" },
      { property: "og:title", content: "ចំណូលចិត្ត — បណ្ណសារបុណ្យខ្មែរ" },
      { property: "og:description", content: "បញ្ជី Album និងរូបភាពបុណ្យខ្មែរដែលអ្នកចូលចិត្ត។" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<"all" | "albums" | "images">("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: userFavorites, isLoading } = useUserFavorites("all");
  const { ids: localFavIds } = useFavorites();
  const { data: allAlbums = [] } = useAlbums();

  // Combine server favorites with local stored favorites for maximum resilience
  const serverAlbums = userFavorites?.albums || [];
  const serverImages = userFavorites?.images || [];

  // Match local album IDs if server has not populated yet
  const localAlbums = allAlbums.filter((a) => localFavIds.includes(a.id));

  // Normalized album list
  const albumMap = new Map<string, (typeof allAlbums)[0]>();
  for (const a of localAlbums) {
    albumMap.set(a.id, a);
  }
  for (const sa of serverAlbums) {
    const existing = allAlbums.find((a) => a.id === sa.id);
    if (existing) {
      albumMap.set(sa.id, existing);
    } else {
      albumMap.set(sa.id, {
        id: sa.id,
        festivalId: sa.festivalId,
        festival: {
          id: sa.festivalId,
          name: sa.festivalName,
          emoji: sa.festivalEmoji,
          accent: sa.festivalAccent,
          cover: sa.coverImage || "",
          month: "",
        },
        year: sa.year,
        photoCount: sa.photoCount,
        title: sa.title,
        location: sa.location ?? "",
      });
    }
  }
  const displayAlbums = Array.from(albumMap.values());

  const displayImages = serverImages;
  const totalCount = displayAlbums.length + displayImages.length;

  const lightboxPhotos: LightboxPhoto[] = displayImages.map((img) => ({
    id: img.id,
    src: img.url,
    caption: `${img.title} (${img.albumTitle || img.festivalName || ""})`,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8 min-h-[70vh]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-display text-foreground">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
              <Bookmark className="h-6 w-6 fill-current" />
            </span>
            ចំណូលចិត្ត
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {toKhmerNumber(totalCount)} ឯកសារដែលអ្នកបានរក្សាទុក (Albums & រូបភាព)
          </p>
        </div>

        {/* Tab filters */}
        {totalCount > 0 && (
          <div className="flex items-center rounded-full bg-secondary p-1">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                activeTab === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ទាំងអស់ ({toKhmerNumber(totalCount)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("albums")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeTab === "albums"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Images className="h-3.5 w-3.5" />
              Albums ({toKhmerNumber(displayAlbums.length)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("images")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5",
                activeTab === "images"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              រូបភាព ({toKhmerNumber(displayImages.length)})
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="mt-16 text-center text-sm text-muted-foreground">
          កំពុងទាញយកបញ្ជីចំណូលចិត្ត...
        </div>
      ) : totalCount === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-amber-500/10 text-amber-500">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-medium">មិនទាន់មានចំណូលចិត្តនៅឡើយទេ</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ចុចរូប Bookmark ឬ Like លើ Album និងរូបភាពដើម្បីរក្សាទុកសម្រាប់មើលពេលក្រោយ។
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/albums"
              className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
            >
              រុករក Albums
            </Link>
            <Link
              to="/festivals"
              className="inline-flex rounded-full bg-secondary px-5 py-2.5 text-sm text-secondary-foreground transition-all hover:bg-secondary/80"
            >
              មើលតាមពិធីបុណ្យ
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {/* Albums Section */}
          {(activeTab === "all" || activeTab === "albums") && displayAlbums.length > 0 && (
            <section>
              {activeTab === "all" && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-medium flex items-center gap-2">
                    <Images className="h-5 w-5 text-gold" /> Albums ចំណូលចិត្ត
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {toKhmerNumber(displayAlbums.length)} Albums
                  </span>
                </div>
              )}
              <AlbumGrid items={displayAlbums} />
            </section>
          )}

          {/* Individual Images Section */}
          {(activeTab === "all" || activeTab === "images") && displayImages.length > 0 && (
            <section>
              {activeTab === "all" && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-medium flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-gold" /> រូបភាពចំណូលចិត្ត
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {toKhmerNumber(displayImages.length)} រូប
                  </span>
                </div>
              )}
              <div className="columns-2 gap-4 [column-fill:_balance] md:columns-3 xl:columns-4">
                {displayImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className="group relative mb-4 block w-full overflow-hidden rounded-2xl bg-card shadow-soft transition-all hover:shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="block w-full overflow-hidden text-left"
                    >
                      <img
                        src={img.url}
                        alt={img.title}
                        loading="lazy"
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </button>

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-between p-3">
                      <div className="flex justify-end gap-1.5 pointer-events-auto">
                        <FavoriteButton
                          resourceType="image"
                          resourceId={img.id}
                          titleText={img.title}
                          variant="floating"
                          size="sm"
                        />
                        <LikeButton
                          resourceType="image"
                          resourceId={img.id}
                          variant="floating"
                          size="sm"
                        />
                      </div>

                      <div className="text-white text-xs truncate drop-shadow-md">{img.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Lightbox for favorited images */}
      <Lightbox
        photos={lightboxPhotos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
