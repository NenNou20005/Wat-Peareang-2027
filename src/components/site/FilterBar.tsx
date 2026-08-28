import { CalendarDays, PartyPopper, Plus } from "lucide-react";
import { toKhmerNumber, type Festival } from "@/data/archive";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { AddFestivalModal } from "@/components/site/AddFestivalModal";
import { useYears, useFestivals } from "@/hooks/useArchiveData";

export function YearPills({
  value,
  onChange,
}: {
  value: number | "all";
  onChange: (v: number | "all") => void;
}) {
  const { data: dbYears = [] } = useYears();
  const [extraYears, setExtraYears] = useState<number[]>([]);
  const allYears = useMemo(() => {
    const base = [...dbYears, ...extraYears];
    return Array.from(new Set(base)).sort((a, b) => a - b);
  }, [dbYears, extraYears]);

  const nextYear = useMemo(() => Math.max(...allYears, 2026) + 1, [allYears]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft md:flex-row md:items-center">
      <span className="flex shrink-0 items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-gold" /> ឆ្នាំ
      </span>
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
        {allYears.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onChange(y)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
              value === y
                ? "border-transparent bg-gold text-gold-foreground"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            {toKhmerNumber(y)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setExtraYears((prev) => [...prev, nextYear])}
          aria-label="បន្ថែមឆ្នាំ"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-gold text-gold transition-colors hover:bg-gold-soft cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
          value === "all"
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-border hover:bg-secondary",
        )}
      >
        មើលឆ្នាំទាំងអស់ ↓
      </button>
    </div>
  );
}

export function FestivalPills({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const { data: dbFestivals = [] } = useFestivals();
  const [extraFestivals, setExtraFestivals] = useState<Festival[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const allFestivals = useMemo(() => {
    const list = dbFestivals;
    const existingIds = new Set(list.map((f) => f.id));
    return [...list, ...extraFestivals.filter((f) => !existingIds.has(f.id))];
  }, [dbFestivals, extraFestivals]);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-soft md:flex-row md:items-center">
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <PartyPopper className="h-4 w-4 text-gold" /> បុណ្យ
        </span>
        <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
              selected.length === 0
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border hover:bg-secondary",
            )}
          >
            ទាំងអស់
          </button>
          {allFestivals.map((f) => {
            const active = selected.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onToggle(f.id)}
                style={active ? { backgroundColor: f.accent, borderColor: f.accent } : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
                  active ? "text-primary-foreground" : "border-border bg-card hover:bg-secondary",
                )}
              >
                {f.emoji} {f.name.replace("បុណ្យ", "")}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="បន្ថែមបុណ្យផ្សេងៗទៀត"
            title="បន្ថែមបុណ្យផ្សេងៗទៀត"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-gold text-gold transition-colors hover:bg-gold-soft cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AddFestivalModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        existingFestivalIds={allFestivals.map((f) => f.id)}
        onFestivalAdded={(newFest) => {
          onToggle(newFest.id);
        }}
      />
    </>
  );
}
