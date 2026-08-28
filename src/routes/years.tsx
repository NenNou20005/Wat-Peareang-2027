import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { YearSection } from "@/components/site/YearSection";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";
import { useYears, useArchiveStats } from "@/hooks/useArchiveData";

export const Route = createFileRoute("/years")({
  head: () => ({
    meta: [
      { title: "តាមឆ្នាំ — បណ្ណសារបុណ្យខ្មែរ" },
      {
        name: "description",
        content: "រុករកបុណ្យខ្មែរតាមឆ្នាំ ២០១៨ ដល់ ២០២៦ ជាមួយចំនួនរូបភាព និងទីកន្លែង។",
      },
      { property: "og:title", content: "បណ្ណសារបុណ្យខ្មែរ តាមឆ្នាំ" },
      {
        property: "og:description",
        content: "Timeline បុណ្យខ្មែរតាមឆ្នាំ ជាមួយ Albums និងរូបភាព។",
      },
    ],
  }),
  component: YearsPage,
});

function YearsPage() {
  const { data: years = [] } = useYears();
  const { data: archiveStats } = useArchiveStats();
  const [active, setActive] = useState<number | null>(null);
  const currentActive = active ?? years[0];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <h1 className="text-3xl">📅 តាមឆ្នាំ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ក្នុងឆ្នាំនីមួយៗមានបុណ្យអ្វីខ្លះ — ជ្រើសរើសឆ្នាំនៅខាងឆ្វេង។
      </p>

      <div className="mt-8 gap-10 lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="no-scrollbar sticky top-24 mb-8 h-max lg:mb-0">
          <p className="mb-3 hidden text-xs uppercase tracking-[0.25em] text-muted-foreground lg:block">
            ឆ្នាំ
          </p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {years.map((y) => {
              const s = archiveStats?.yearStatsMap[y] ?? { albums: 0, photos: 0, locations: 1 };
              return (
                <a
                  key={y}
                  href={`#year-${y}`}
                  onClick={() => setActive(y)}
                  className={cn(
                    "shrink-0 rounded-2xl border px-4 py-2.5 text-sm transition-colors lg:flex lg:items-center lg:justify-between",
                    currentActive === y
                      ? "border-transparent bg-gold text-gold-foreground"
                      : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  <span>{toKhmerNumber(y)}</span>
                  <span className="ml-2 hidden text-xs opacity-70 lg:inline">
                    {toKhmerNumber(s.albums)}
                  </span>
                </a>
              );
            })}
          </div>
        </aside>

        <div className="space-y-16">
          {years.map((y) => (
            <YearSection key={y} year={y} />
          ))}
        </div>
      </div>
    </div>
  );
}
