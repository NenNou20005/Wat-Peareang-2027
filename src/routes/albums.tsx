import { createFileRoute } from "@tanstack/react-router";
import type { AlbumDetailSearch } from "@/routes/album.$albumId";
import { YearPills, FestivalPills } from "@/components/site/FilterBar";
import { YearSection } from "@/components/site/YearSection";
import { useYears, useAlbums } from "@/hooks/useArchiveData";

export type AlbumsSearch = {
  year?: number | "all" | undefined;
  festival?: string | undefined;
};

export const Route = createFileRoute("/albums")({
  validateSearch: (search: Record<string, unknown>): AlbumsSearch => {
    const rawYear = search["year"];
    let year: number | "all" = "all";
    if (typeof rawYear === "number" && !isNaN(rawYear)) {
      year = rawYear;
    } else if (typeof rawYear === "string") {
      if (rawYear === "all") {
        year = "all";
      } else {
        const parsed = parseInt(rawYear, 10);
        year = !isNaN(parsed) ? parsed : "all";
      }
    }

    const rawFestival = search["festival"];
    const festival =
      typeof rawFestival === "string" && rawFestival.trim()
        ? rawFestival.trim()
        : undefined;

    return {
      year,
      festival,
    };
  },
  head: () => ({
    meta: [
      { title: "Albums បុណ្យខ្មែរ — បណ្ណសារវត្តពារាំង | Wat Peareang Archive" },
      {
        name: "description",
        content: "Albums រូបភាពបុណ្យខ្មែរទាំងអស់របស់វត្តពារាំង ចាត់ជាក្រុមតាមឆ្នាំ និងតាមប្រភេទបុណ្យ។",
      },
      { property: "og:title", content: "Albums បុណ្យខ្មែរ — វត្តពារាំង" },
      {
        property: "og:description",
        content: "រុករក Albums រូបភាពបុណ្យខ្មែរនៃវត្តពារាំងតាមឆ្នាំ និងតាមព្រឹត្តិការណ៍។",
      },
    ],
    links: [
      { rel: "canonical", href: "https://wat-peareang-2027.onrender.com/albums" },
    ],
  }),
  component: AlbumsPage,
});

function AlbumsPage() {
  const { data: years = [] } = useYears();
  const { data: allAlbums = [] } = useAlbums();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const year = search.year ?? "all";
  const festival = search.festival;
  const selected: string[] = festival ? [festival] : [];
  const shownYears = year === "all" ? years : [year];

  const albumLinkSearch: AlbumDetailSearch = {
    from: "albums",
    year,
    festival,
  };

  const handleYearChange = (newYear: number | "all") => {
    navigate({
      search: {
        year: newYear === "all" ? undefined : newYear,
        festival,
      },
      replace: true,
      resetScroll: false,
    });
  };

  const handleToggleFestival = (id: string) => {
    const nextFestival = festival === id ? undefined : id;

    navigate({
      search: {
        year: search.year === "all" ? undefined : search.year,
        festival: nextFestival,
      },
      replace: true,
      resetScroll: false,
    });
  };

  const handleClearFestival = () => {
    navigate({
      search: {
        year: search.year === "all" ? undefined : search.year,
        festival: undefined,
      },
      replace: true,
      resetScroll: false,
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <h1 className="text-3xl">🖼️ Albums</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ជ្រើសរើសឆ្នាំ និងបុណ្យ ដើម្បីរុករករូបភាពក្នុងបណ្ណសារ។
      </p>

      <div className="mt-8 space-y-4">
        <YearPills value={year} onChange={handleYearChange} />
        <FestivalPills
          selected={selected}
          activeYear={year}
          albumLinkSearch={albumLinkSearch}
          onToggle={handleToggleFestival}
          onClear={handleClearFestival}
        />
      </div>

      <div className="mt-12 space-y-16">
        {shownYears.map((y) => (
          <YearSection
            key={y}
            year={y}
            festivalFilter={selected}
            albums={allAlbums}
            albumLinkSearch={albumLinkSearch}
          />
        ))}
      </div>
    </div>
  );
}
