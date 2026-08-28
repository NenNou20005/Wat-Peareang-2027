import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { YearPills, FestivalPills } from "@/components/site/FilterBar";
import { YearSection } from "@/components/site/YearSection";
import { useYears } from "@/hooks/useArchiveData";

export const Route = createFileRoute("/albums")({
  head: () => ({
    meta: [
      { title: "Albums បុណ្យខ្មែរ — បណ្ណសារបុណ្យខ្មែរ" },
      {
        name: "description",
        content: "Albums រូបភាពបុណ្យខ្មែរទាំងអស់ ចាត់ជាក្រុមតាមឆ្នាំ និងតាមប្រភេទបុណ្យ។",
      },
      { property: "og:title", content: "Albums បុណ្យខ្មែរ" },
      {
        property: "og:description",
        content: "រុករក Albums រូបភាពបុណ្យខ្មែរតាមឆ្នាំ និងតាមព្រឹត្តិការណ៍។",
      },
    ],
  }),
  component: AlbumsPage,
});

function AlbumsPage() {
  const { data: years = [] } = useYears();
  const [year, setYear] = useState<number | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const shownYears = year === "all" ? years : [year];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <h1 className="text-3xl">🖼️ Albums</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ជ្រើសរើសឆ្នាំ និងបុណ្យ ដើម្បីរុករករូបភាពក្នុងបណ្ណសារ។
      </p>

      <div className="mt-8 space-y-4">
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
      </div>

      <div className="mt-12 space-y-16">
        {shownYears.map((y) => (
          <YearSection key={y} year={y} festivalFilter={selected} />
        ))}
      </div>
    </div>
  );
}
