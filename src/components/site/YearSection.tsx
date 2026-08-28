import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { toKhmerNumber, type Album } from "@/data/archive";
import { AlbumCard } from "@/components/site/AlbumCard";
import { useAlbums, useArchiveStats } from "@/hooks/useArchiveData";

export function YearSectionHeader({
  year,
  dynamicStats,
}: {
  year: number;
  dynamicStats?: { albums: number; photos: number; locations: number };
}) {
  const { data: archiveStats } = useArchiveStats(year);
  const stats = dynamicStats ??
    archiveStats?.yearStatsMap[year] ?? { albums: 0, photos: 0, locations: 1 };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3 text-gold">
          <span aria-hidden>❈</span>
          <div className="khmer-divider w-10" />
        </div>
        <h2 className="mt-2 truncate text-2xl">📅 ឆ្នាំ {toKhmerNumber(year)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {toKhmerNumber(stats.albums)} Albums · {toKhmerNumber(stats.photos)} រូបភាព
        </p>
      </div>
      <Link
        to="/years"
        hash={`year-${year}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold px-4 py-2 text-sm transition-colors hover:bg-gold-soft"
      >
        មើលឆ្នាំ {toKhmerNumber(year)} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export function AlbumGrid({
  items,
  onSelectAlbum,
}: {
  items: Album[];
  onSelectAlbum?: (album: Album) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((album, i) => (
        <AlbumCard
          key={album.id}
          album={album}
          index={i + 1}
          {...(onSelectAlbum ? { onSelect: onSelectAlbum } : {})}
        />
      ))}
    </div>
  );
}

export function YearSection({ year, festivalFilter }: { year: number; festivalFilter?: string[] }) {
  const { data: yearAlbums = [] } = useAlbums({ year });
  const items = yearAlbums.filter(
    (a) => !festivalFilter?.length || festivalFilter.includes(a.festivalId),
  );

  if (items.length === 0) return null;

  const dynamicStats = {
    albums: items.length,
    photos: items.reduce((sum, a) => sum + (a.photoCount || 0), 0),
    locations: 1,
  };

  return (
    <section id={`year-${year}`} className="scroll-mt-28 space-y-6">
      <YearSectionHeader year={year} dynamicStats={dynamicStats} />
      <AlbumGrid items={items} />
    </section>
  );
}
