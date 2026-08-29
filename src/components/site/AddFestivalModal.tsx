import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PREDEFINED_EXTRA_FESTIVALS, saveCustomFestival, type Festival } from "@/data/archive";
import { Plus, Check, Sparkles, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCreateFestival } from "@/hooks/useAdminData";

const EMOJI_PRESETS = [
  "🛕",
  "🌸",
  "🌾",
  "🕯️",
  "🏮",
  "🐉",
  "🕊️",
  "🪷",
  "👑",
  "🎋",
  "🔔",
  "🎉",
  "🚣",
  "🐂",
  "✨",
  "🎊",
  "🎏",
  "🧘",
  "🥁",
  "🍲",
];

const MONTH_OPTIONS = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
  "ពេញមួយឆ្នាំ",
];

const ACCENT_COLORS = [
  { name: "មាស (Gold)", value: "oklch(0.74 0.132 76)" },
  { name: "បៃតងប្រាសាទ (Temple)", value: "oklch(0.52 0.12 158)" },
  { name: "ផ្កាឈូក (Lotus Pink)", value: "oklch(0.62 0.16 350)" },
  { name: "ទឹកក្រូច (Amber)", value: "oklch(0.65 0.15 50)" },
  { name: "ស្វាយ (Violet)", value: "oklch(0.55 0.15 300)" },
  { name: "ខៀវទឹក (Cyan)", value: "oklch(0.58 0.12 210)" },
  { name: "ក្រហម (Crimson)", value: "oklch(0.58 0.18 25)" },
  { name: "លឿងទុំ (Saffron)", value: "oklch(0.70 0.14 85)" },
];

export function AddFestivalModal({
  open,
  onOpenChange,
  existingFestivalIds,
  onFestivalAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFestivalIds: string[];
  onFestivalAdded?: (festival: Festival) => void;
}) {
  const [activeTab, setActiveTab] = useState<"preset" | "custom">("preset");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛕");
  const [month, setMonth] = useState("ពេញមួយឆ្នាំ");
  const [accent, setAccent] = useState(ACCENT_COLORS[0]!.value);

  const createFestivalMutation = useCreateFestival();

  const availablePresets = PREDEFINED_EXTRA_FESTIVALS.filter(
    (f) => !existingFestivalIds.includes(f.id),
  );

  async function handleAddPreset(f: Festival) {
    try {
      await createFestivalMutation.mutateAsync({
        id: f.id,
        name: f.name,
        emoji: f.emoji,
        accent: f.accent,
        month: f.month,
        coverUrl: f.cover,
      });
      saveCustomFestival(f);
      onFestivalAdded?.(f);
      toast.success(`បានបន្ថែម «${f.name}» ដោយជោគជ័យ!`, {
        description: `ពិធីបុណ្យត្រូវបានដាក់បញ្ចូលក្នុងតម្រងបណ្ណសារ។`,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបន្ថែមពិធីបុណ្យ។";
      toast.error(msg);
    }
  }

  async function handleCreateCustom(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("សូមបញ្ចូលឈ្មោះពិធីបុណ្យ");
      return;
    }

    const customId = `custom-${Date.now()}`;
    const newFestival: Festival = {
      id: customId,
      name: cleanName.startsWith("បុណ្យ") ? cleanName : `បុណ្យ${cleanName}`,
      emoji,
      cover: PREDEFINED_EXTRA_FESTIVALS[0]?.cover || "/assets/fest-custom.jpg",
      accent,
      month,
    };

    try {
      await createFestivalMutation.mutateAsync({
        id: newFestival.id,
        name: newFestival.name,
        emoji: newFestival.emoji,
        accent: newFestival.accent,
        month: newFestival.month,
        coverUrl: newFestival.cover,
      });
      saveCustomFestival(newFestival);
      onFestivalAdded?.(newFestival);
      toast.success(`បានបន្ថែម «${newFestival.name}» ដោយជោគជ័យ!`);
      setName("");
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបង្កើតពិធីបុណ្យ។";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 bg-card p-0 sm:max-w-xl">
        <div className="border-b border-border/70 bg-cream px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-gold">
              <PartyPopper className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gold">
                Festivals & Ceremonies
              </span>
            </div>
            <DialogTitle className="mt-1 text-2xl">បន្ថែមពិធីបុណ្យ ឬកម្មវិធី</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              ជ្រើសរើសពីពិធីបុណ្យប្រពៃណីខ្មែរ ឬបង្កើតពិធីបុណ្យថ្មីផ្ទាល់ខ្លួន
            </DialogDescription>
          </DialogHeader>

          {/* Tab buttons */}
          <div className="mt-4 flex rounded-2xl border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setActiveTab("preset")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all sm:text-sm",
                activeTab === "preset"
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" /> ពិធីបុណ្យពេញនិយម ({availablePresets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all sm:text-sm",
                activeTab === "custom"
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Plus className="h-3.5 w-3.5" /> បង្កើតបុណ្យផ្ទាល់ខ្លួន
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "preset" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                ចុចលើពិធីបុណ្យខាងក្រោមដើម្បីបន្ថែមចូលក្នុងបញ្ជីតម្រងភ្លាមៗ៖
              </p>

              {availablePresets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                  <span className="text-3xl">✨</span>
                  <p className="mt-2 text-sm font-medium">
                    ពិធីបុណ្យពេញនិយមទាំងអស់ត្រូវបានបន្ថែមរួចហើយ
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    អ្នកអាចបង្កើតពិធីបុណ្យផ្ទាល់ខ្លួនបន្ថែមទៀតបាន
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("custom")}
                    className="mt-4 rounded-full border-gold text-gold hover:bg-gold-soft"
                  >
                    បង្កើតបុណ្យផ្ទាល់ខ្លួន
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {availablePresets.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={createFestivalMutation.isPending}
                      onClick={() => handleAddPreset(f)}
                      className="group flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-left transition-all hover:border-gold hover:bg-gold-soft/30 hover:shadow-soft disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg shadow-xs transition-transform group-hover:scale-105"
                          style={{ backgroundColor: f.accent }}
                        >
                          {f.emoji}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{f.name}</p>
                          <p className="text-xs text-muted-foreground">ខែ {f.month}</p>
                        </div>
                      </div>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-gold/60 text-gold transition-colors group-hover:bg-gold group-hover:text-gold-foreground">
                        <Plus className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateCustom} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fest-name" className="text-sm font-medium">
                  ឈ្មោះពិធីបុណ្យ ឬព្រឹត្តិការណ៍ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fest-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ឧ. បុណ្យដារលាន, បុណ្យភូមិ, បុណ្យផ្កាប្រាក់..."
                  className="rounded-2xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">ជ្រើសរើសរូបសញ្ញា (Emoji)</Label>
                <div className="no-scrollbar flex flex-wrap gap-2 max-h-28 overflow-y-auto rounded-2xl border border-border bg-background p-2.5">
                  {EMOJI_PRESETS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl text-lg transition-all",
                        emoji === em
                          ? "bg-gold text-gold-foreground scale-110 shadow-xs ring-2 ring-gold"
                          : "hover:bg-muted",
                      )}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fest-month" className="text-sm font-medium">
                    ខែប្រារព្ធ
                  </Label>
                  <select
                    id="fest-month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">ពណ៌សម្គាល់</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ACCENT_COLORS.map((col) => (
                      <button
                        key={col.value}
                        type="button"
                        onClick={() => setAccent(col.value)}
                        title={col.name}
                        style={{ backgroundColor: col.value }}
                        className={cn(
                          "h-7 w-7 rounded-full transition-transform",
                          accent === col.value
                            ? "scale-125 ring-2 ring-gold ring-offset-2"
                            : "hover:scale-110",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-2xl border border-border bg-cream/60 p-3.5">
                <p className="text-xs text-muted-foreground">ទម្រង់បង្ហាញគំរូ (Preview)៖</p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-xs"
                    style={{ backgroundColor: accent, borderColor: accent }}
                  >
                    <span>{emoji}</span>
                    <span>
                      {name.trim()
                        ? name.startsWith("បុណ្យ")
                          ? name.replace("បុណ្យ", "")
                          : name
                        : "ឈ្មោះបុណ្យ"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">· ខែ {month}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={createFestivalMutation.isPending}
                  className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {createFestivalMutation.isPending ? "កំពុងបន្ថែម..." : "បន្ថែមពិធីបុណ្យនេះ"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
