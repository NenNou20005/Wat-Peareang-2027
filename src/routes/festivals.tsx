import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { AlbumGrid } from "@/components/site/YearSection";
import { toKhmerNumber, type Festival } from "@/data/archive";
import { cn } from "@/lib/utils";
import { AddFestivalModal } from "@/components/site/AddFestivalModal";
import { useFestivals, useAlbums } from "@/hooks/useArchiveData";

export const Route = createFileRoute("/festivals")({
  head: () => ({
    meta: [
      { title: "តាមបុណ្យ — បណ្ណសារបុណ្យខ្មែរ" },
      {
        name: "description",
        content:
          "រុករករូបភាពតាមប្រភេទបុណ្យខ្មែរ៖ ចូលឆ្នាំ វិសាខបូជា មាឃបូជា ចូលវស្សា ចេញវស្សា ភ្ជុំបិណ្ឌ កឋិនទាន អុំទូក។",
      },
      { property: "og:title", content: "បុណ្យខ្មែរទាំងអស់" },
      {
        property: "og:description",
        content: "Albums រូបភាពតាមប្រភេទបុណ្យខ្មែរ ពីឆ្នាំ ២០១៨ ដល់ ២០២៦។",
      },
    ],
  }),
  component: FestivalsPage,
});

function FestivalsPage() {
  const { data: dbFestivals = [] } = useFestivals();
  const { data: allAlbums = [] } = useAlbums();

  const [active, setActive] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const festivalList = dbFestivals;
  const currentActive = active || festivalList[0]?.id || "";
  const festival = festivalList.find((f) => f.id === currentActive) ?? festivalList[0];

  const items = allAlbums
    .filter((a) => a.festivalId === (festival?.id || currentActive))
    .sort((a, b) => b.year - a.year);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl">🎉 តាមបុណ្យ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ជ្រើសរើសបុណ្យមួយ ដើម្បីមើល Albums គ្រប់ឆ្នាំ ឬបន្ថែមបុណ្យផ្សេងៗទៀត។
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-full border border-dashed border-gold bg-gold-soft/30 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold-soft"
        >
          <Plus className="h-4 w-4" /> បន្ថែមពិធីបុណ្យ
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {festivalList.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActive(f.id)}
            className={cn(
              "overflow-hidden rounded-3xl border bg-card text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card",
              f.id === (festival?.id || active) ? "border-gold ring-1 ring-gold" : "border-border",
            )}
          >
            <div className="relative h-28">
              <img
                src={f.cover}
                alt={f.name}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 card-scrim" />
              <span
                className="absolute bottom-2 left-2 grid h-9 w-9 place-items-center rounded-xl"
                style={{ backgroundColor: f.accent }}
              >
                {f.emoji}
              </span>
            </div>
            <div className="p-4">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.month}</p>
            </div>
          </button>
        ))}
      </div>

      {festival && (
        <>
          <div className="mt-14 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
            <h2 className="min-w-0 truncate text-2xl">
              {festival.emoji} {festival.name}
            </h2>
            <Link
              to="/years"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold px-4 py-2 text-sm hover:bg-gold-soft"
            >
              មើលតាមឆ្នាំ <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {toKhmerNumber(items.length)} Albums ·{" "}
            {toKhmerNumber(items.reduce((s, a) => s + (a.photoCount || 0), 0))} រូបភាព
          </p>
          <div className="mt-8">
            <AlbumGrid items={items} />
          </div>
        </>
      )}

      <AddFestivalModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        existingFestivalIds={festivalList.map((f) => f.id)}
        onFestivalAdded={(newFest) => {
          setActive(newFest.id);
        }}
      />
    </div>
  );
}
