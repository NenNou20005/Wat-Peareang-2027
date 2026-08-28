import { useState } from "react";
import { Calendar, ChevronDown, Clock, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportPeriod } from "@/hooks/useReportsData";

export interface GlobalDateFilterProps {
  period: ReportPeriod | string;
  startDate?: string | null;
  endDate?: string | null;
  onPeriodChange: (
    period: ReportPeriod | string,
    startDate?: string | null,
    endDate?: string | null,
  ) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const PRESETS: Array<{ id: ReportPeriod; label: string; labelKh: string }> = [
  { id: "today", label: "Today", labelKh: "ថ្ងៃនេះ" },
  { id: "yesterday", label: "Yesterday", labelKh: "ម្សិលមិញ" },
  { id: "7d", label: "Last 7 Days", labelKh: "៧ ថ្ងៃ" },
  { id: "30d", label: "Last 30 Days", labelKh: "៣០ ថ្ងៃ" },
  { id: "90d", label: "Last 90 Days", labelKh: "៩០ ថ្ងៃ" },
  { id: "this_year", label: "This Year", labelKh: "ឆ្នាំនេះ" },
  { id: "all", label: "All Time", labelKh: "គ្រប់ពេល" },
  { id: "custom", label: "Custom Range", labelKh: "កំណត់ផ្ទាល់ខ្លួន" },
];

export function GlobalDateFilter({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onRefresh,
  isRefreshing = false,
}: GlobalDateFilterProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(
    startDate || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [customEnd, setCustomEnd] = useState(endDate || new Date().toISOString().slice(0, 10));

  const activePreset = PRESETS.find((p) => p.id === period) || PRESETS[2];

  const handleApplyCustom = () => {
    onPeriodChange("custom", customStart, customEnd);
    setShowCustomModal(false);
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-2.5 sm:p-3 shadow-soft">
      {/* Preset Pills List */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {PRESETS.map((preset) => {
          const isActive = period === preset.id;
          return (
            <button
              key={preset.id}
              id={`date-filter-preset-${preset.id}`}
              onClick={() => {
                if (preset.id === "custom") {
                  setShowCustomModal(true);
                } else {
                  onPeriodChange(preset.id, null, null);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-gold text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
              )}
            >
              {isActive && <Check className="h-3 w-3" />}
              <span>{preset.labelKh}</span>
              <span className="hidden xl:inline text-[10px] opacity-75">({preset.label})</span>
            </button>
          );
        })}
      </div>

      {/* Timezone Badge & Quick Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-2 sm:border-t-0 sm:pt-0">
        <div className="flex items-center gap-1.5 rounded-xl bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3 w-3 text-gold" />
          <span>Asia/Phnom_Penh (UTC+7)</span>
        </div>

        {onRefresh && (
          <Button
            id="admin-analytics-refresh-btn"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 rounded-xl px-2.5 text-xs font-medium"
            title="ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ (Refresh)"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-gold")} />
            <span className="hidden sm:inline ml-1.5">ផ្ទុកឡើងវិញ</span>
          </Button>
        )}
      </div>

      {/* Custom Date Range Popover/Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gold" />
                <h3 className="text-base font-bold text-foreground">
                  ជ្រើសរើសចន្លោះកាលបរិច្ឆេទ (Custom Date Range)
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  ចាប់ពីថ្ងៃ (Start Date)
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  រហូតដល់ថ្ងៃ (End Date)
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomModal(false)}
                  className="rounded-xl text-xs"
                >
                  បោះបង់
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyCustom}
                  className="rounded-xl bg-gold text-primary-foreground hover:bg-gold/90 text-xs font-semibold"
                >
                  អនុវត្ត (Apply Filter)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
