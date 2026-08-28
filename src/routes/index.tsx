import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Camera, Images, Upload } from "lucide-react";
import heroImg from "@/assets/hero-angkor.jpg";
import { Button } from "@/components/ui/button";
import { YearPills, FestivalPills } from "@/components/site/FilterBar";
import { YearSection } from "@/components/site/YearSection";
import { UploadTrigger } from "@/components/site/UploadModal";
import { toKhmerNumber } from "@/data/archive";
import {
  useFestivals,
  useYears,
  useAlbums,
  useAlbum,
  useAlbumPhotos,
  useArchiveStats,
} from "@/hooks/useArchiveData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "🏛️ បណ្ណសាររូបភាព — រក្សាទុកអនុស្សាវរីយ៍" },
      {
        name: "description",
        content:
          "បណ្ណសាររូបភាពបុណ្យខ្មែរ រៀបចំតាមឆ្នាំ និងតាមព្រឹត្តិការណ៍ — ចូលឆ្នាំ វិសាខបូជា ភ្ជុំបិណ្ឌ អុំទូក និងច្រើនទៀត។",
      },
      { property: "og:title", content: "🏛️ បណ្ណសាររូបភាព — Khmer Festival Photo Archive" },
      {
        property: "og:description",
        content: "រក្សាទុកអនុស្សាវរីយ៍ និងរូបភាពបុណ្យខ្មែរ តាមឆ្នាំ និងតាមព្រឹត្តិការណ៍។",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: years = [] } = useYears();
  const { data: festivals = [] } = useFestivals();
  const { data: allAlbums = [] } = useAlbums();
  const { data: archiveStats } = useArchiveStats();

  const [year, setYear] = useState<number | "all">(2020);
  const [selected, setSelected] = useState<string[]>([]);
  const shownYears = year === "all" ? years : [year];

  const defaultMemoryId = "chaul-chnam-2020";
  const { data: memoryAlbum } = useAlbum(defaultMemoryId);
  const memory = memoryAlbum ?? allAlbums[0];

  const { data: rawPhotos = [] } = useAlbumPhotos(memory?.id ?? defaultMemoryId);
  const memoryPhotos = rawPhotos.slice(0, 4);

  const timelineYear = year === "all" ? 2020 : year;
  const tStats = archiveStats?.yearStatsMap[timelineYear] ?? {
    albums: allAlbums.filter((a) => a.year === timelineYear).length,
    photos: allAlbums
      .filter((a) => a.year === timelineYear)
      .reduce((sum, a) => sum + (a.photoCount || 0), 0),
    locations: 1,
  };

  const totalPhotosCount = archiveStats?.totalImages ?? 10000;
  const totalAlbumsCount = archiveStats?.totalAlbums ?? 100;
  const totalYearsCount = archiveStats?.totalYears ?? years.length;
  const totalFestivalsCount = archiveStats?.totalFestivals ?? festivals.length;

  const stats = [
    { icon: "📸", value: `${toKhmerNumber(totalPhotosCount)}+`, label: "រូបភាព" },
    { icon: "🎉", value: `${toKhmerNumber(totalAlbumsCount)}+`, label: "Albums" },
    { icon: "📅", value: `${toKhmerNumber(totalYearsCount)}+`, label: "ឆ្នាំ" },
    { icon: "🏛️", value: `${toKhmerNumber(totalFestivalsCount)}+`, label: "ព្រឹត្តិការណ៍" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative">
        <div className="relative h-[440px] w-full overflow-hidden md:h-[520px]">
          <img
            src={heroImg}
            alt="អង្គរវត្តពេលថ្ងៃលិច ជាមួយទង់បុណ្យខ្មែរ"
            width={1920}
            height={912}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 hero-scrim" />
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-[1400px] flex-col justify-center px-4 lg:px-8">
              <div className="max-w-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-gold">
                  Khmer Festival Photo Archive
                </p>
                <h1 className="mt-4 text-3xl leading-relaxed text-primary-foreground md:text-5xl md:leading-relaxed">
                  🏛️ បណ្ណសាររូបភាព
                </h1>
                <p className="mt-4 text-sm text-primary-foreground/85 md:text-base">
                  រក្សាទុកអនុស្សាវរីយ៍
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/albums">
                      <Images className="mr-1 h-4 w-4" /> មើល Albums
                    </Link>
                  </Button>
                  <UploadTrigger className="bg-gold text-gold-foreground hover:bg-gold/90">
                    <Upload className="mr-1 h-4 w-4" /> បង្ហោះរូបភាព
                  </UploadTrigger>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics row */}
        <div className="relative z-10 mx-auto -mt-12 max-w-[1400px] px-4 lg:px-8">
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-border bg-card p-5 shadow-card md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-xl">
                  {s.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold">{s.value}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto mt-10 max-w-[1400px] space-y-4 px-4 lg:px-8">
        <YearPills value={year} onChange={setYear} />
        <FestivalPills
          selected={selected}
          onToggle={(id) =>
            setSelected((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onClear={() => setSelected([])}
        />
      </section>

      {/* Albums grouped by year */}
      <div className="mx-auto mt-12 max-w-[1400px] space-y-16 px-4 lg:px-8">
        {shownYears.map((y) => (
          <YearSection key={y} year={y} festivalFilter={selected} />
        ))}
      </div>

      {/* Memories */}
      {memory && (
        <section className="mx-auto mt-20 max-w-[1400px] px-4 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card md:grid md:grid-cols-2">
            <img
              src={memory.festival.cover}
              alt={memory.festival.name}
              loading="lazy"
              width={1024}
              height={768}
              className="h-64 w-full object-cover md:h-full"
            />
            <div className="p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-gold">
                📸 អនុស្សាវរីយ៍ថ្ងៃនេះ
              </p>
              <p className="mt-3 text-sm text-muted-foreground">៦ ឆ្នាំមុន</p>
              <h2 className="mt-2 text-2xl">
                {memory.festival.emoji} {memory.festival.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                ឆ្នាំ {toKhmerNumber(memory.year)} · {toKhmerNumber(memory.photoCount)} រូបភាព
              </p>
              <div className="mt-5 flex gap-2">
                {memoryPhotos.map((p) => (
                  <img
                    key={p.id}
                    src={p.src}
                    alt={p.caption}
                    loading="lazy"
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                ))}
              </div>
              <Button asChild className="mt-6 rounded-full">
                <Link to="/album/$albumId" params={{ albumId: memory.id }}>
                  មើលអនុស្សាវរីយ៍ <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* On this year timeline */}
      <section className="mx-auto mt-20 max-w-[1400px] px-4 lg:px-8">
        <h2 className="text-2xl">📅 ក្នុងឆ្នាំ {toKhmerNumber(timelineYear)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {toKhmerNumber(tStats.albums)} បុណ្យ · {toKhmerNumber(tStats.photos)} រូបភាព
        </p>
        <div className="no-scrollbar mt-6 flex gap-3 overflow-x-auto pb-2">
          {festivals.map((f) => (
            <Link
              key={f.id}
              to="/album/$albumId"
              params={{ albumId: `${f.id}-${timelineYear}` }}
              className="w-44 shrink-0 rounded-3xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-card"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-2xl"
                style={{ backgroundColor: f.accent }}
              >
                {f.emoji}
              </span>
              <p className="mt-3 truncate text-sm font-medium">{f.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.month}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Upload CTA */}
      <section className="mx-auto mt-20 max-w-[1400px] px-4 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-temple px-6 py-12 text-center text-temple-foreground shadow-card">
          <span className="absolute left-4 top-4 text-3xl text-gold/40" aria-hidden>
            ❈
          </span>
          <span className="absolute bottom-4 right-4 text-3xl text-gold/40" aria-hidden>
            ❈
          </span>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gold text-2xl text-gold-foreground">
            <Camera className="h-7 w-7" />
          </span>
          <h2 className="mt-6 text-2xl">បន្ថែមអនុស្សាវរីយ៍របស់អ្នក</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-temple-foreground/80">
            បង្ហោះរូបភាពបុណ្យ និងកម្មវិធីខ្មែរ ដើម្បីរក្សាទុកជាបណ្ណសារសម្រាប់អនាគត។
            អាចជ្រើសរើសរូបភាពបានរហូតដល់ ៥០ រូបក្នុងមួយលើក។
          </p>
          <div className="mt-7 flex justify-center">
            <UploadTrigger className="bg-gold text-gold-foreground hover:bg-gold/90" />
          </div>
        </div>
      </section>
    </>
  );
}
