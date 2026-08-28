import { Link } from "@tanstack/react-router";
import { ArrowRight, Images } from "lucide-react";
import type { Album } from "@/data/archive";
import { toKhmerNumber } from "@/data/archive";
import { LikeButton } from "./LikeButton";
import { FavoriteButton } from "./FavoriteButton";

export function AlbumCard({
  album,
  index,
  onSelect,
}: {
  album: Album;
  index?: number;
  onSelect?: (album: Album) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={album.festival.cover}
          alt={`${album.festival.name} ឆ្នាំ ${album.year}`}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 card-scrim" />

        {typeof index === "number" && (
          <span className="absolute right-3 top-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            {toKhmerNumber(index)}
          </span>
        )}

        {/* Action buttons on card */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 z-10">
          <FavoriteButton
            resourceType="album"
            resourceId={album.id}
            titleText={album.festival.name}
            variant="floating"
            size="sm"
          />
          <LikeButton resourceType="album" resourceId={album.id} variant="floating" size="sm" />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="flex items-center gap-2 text-base text-primary-foreground drop-shadow">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm"
              style={{ backgroundColor: album.festival.accent }}
            >
              {album.festival.emoji}
            </span>
            <span className="truncate">{album.festival.name}</span>
          </h3>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {[album.festival.month, `ឆ្នាំ ${toKhmerNumber(album.year)}`].map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
          <LikeButton resourceType="album" resourceId={album.id} variant="subtle" size="sm" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Images className="h-3.5 w-3.5" /> {toKhmerNumber(album.photoCount)} រូប
          </span>
          <Link
            to="/album/$albumId"
            params={{ albumId: album.id }}
            onClick={() => onSelect?.(album)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            មើល <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
