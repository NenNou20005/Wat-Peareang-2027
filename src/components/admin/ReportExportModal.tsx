import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReportFile, type ReportPeriod } from "@/hooks/useReportsData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriod: ReportPeriod | string;
  startDate?: string | null;
  endDate?: string | null;
}

type ReportTypeOption =
  | "all"
  | "summary"
  | "content-performance"
  | "top-albums"
  | "top-images"
  | "search-queries"
  | "growth"
  | "activity";

const REPORT_OPTIONS: Array<{
  id: ReportTypeOption;
  title: string;
  titleKh: string;
  desc: string;
}> = [
  {
    id: "all",
    title: "Master Intelligence Report",
    titleKh: "របាយការណ៍សរុបគ្រប់ជ្រុងជ្រោយ",
    desc: "រួមបញ្ចូលទាំង KPIs, ការពេញនិយម, ការស្វែងរក, និងកំណើន",
  },
  {
    id: "summary",
    title: "Executive KPI Summary",
    titleKh: "សូចនាករប្រតិបត្តិការ & KPIs",
    desc: "ស្ថិតិអ្នកទស្សនា ការមើល អន្តរកម្ម និងអត្រា Engagement",
  },
  {
    id: "content-performance",
    title: "Content Performance",
    titleKh: "ប្រសិទ្ធភាពពិធីបុណ្យ & Albums",
    desc: "ពិន្ទុប្រជាប្រិយភាព ចំនួនរូបថត ការទស្សនា និងចំណាត់ថ្នាក់",
  },
  {
    id: "top-albums",
    title: "Top 50 Albums",
    titleKh: "Albums ដែលមានអ្នកទស្សនាច្រើនបំផុត ៥០",
    desc: "កម្រងរូបថតដែលពេញនិយម និងទទួលបានការចូលចិត្តច្រើន",
  },
  {
    id: "top-images",
    title: "Top 50 Photos",
    titleKh: "រូបថតដែលមានអ្នកទស្សនាច្រើនបំផុត ៥០",
    desc: "រូបថតដែលទទួលបានការមើល និងទាញយកច្រើនជាងគេ",
  },
  {
    id: "search-queries",
    title: "Search Intelligence & Trends",
    titleKh: "ពាក្យគន្លឹះស្វែងរក & និន្នាការ",
    desc: "ពាក្យដែលគេស្វែងរកញឹកញាប់ CTR និងពាក្យគ្មានលទ្ធផល",
  },
  {
    id: "growth",
    title: "Archive Growth Timeline",
    titleKh: "កំណើនបណ្ណសារដ្ឋានប្រចាំខែ/ឆ្នាំ",
    desc: "ស្ថិតិនៃការបន្ថែមរូបថត និងកម្រងរូបភាពតាមពេលវេលា",
  },
  {
    id: "activity",
    title: "Admin Security & Audit Trail",
    titleKh: "កំណត់ត្រាសវនកម្ម Admin",
    desc: "រាល់សកម្មភាពចូលគណនី បង្កើត កែប្រែ និងលុបទិន្នន័យ",
  },
];

export function ReportExportModal({
  isOpen,
  onClose,
  currentPeriod,
  startDate,
  endDate,
}: ReportExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "json">("csv");
  const [selectedReportType, setSelectedReportType] = useState<ReportTypeOption>("all");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await downloadReportFile(
        selectedFormat,
        selectedReportType,
        currentPeriod,
        startDate,
        endDate,
      );

      if (res.success) {
        toast.success("បានទាញយករបាយការណ៍ដោយជោគជ័យ!", {
          description: `ឯកសារ ${selectedFormat.toUpperCase()} ត្រូវបានទាញយករួចរាល់។`,
        });
        onClose();
      } else {
        toast.error("មិនអាចទាញយករបាយការណ៍បានទេ", {
          description: res.error,
        });
      }
    } catch (err: unknown) {
      toast.error("មានបញ្ហាក្នុងការទាញយក");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                នាំចេញរបាយការណ៍បណ្ណសារដ្ឋាន (Export Report)
              </h3>
              <p className="text-xs text-muted-foreground">
                ទាញយកទិន្នន័យសម្រាប់ Excel, Sheets, ឬប្រព័ន្ធវិភាគផ្សេងៗ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 py-4">
          {/* Format Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">
              ទម្រង់ឯកសារ (File Format)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat("csv")}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  selectedFormat === "csv"
                    ? "border-gold bg-gold/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs font-bold">CSV (.csv)</p>
                  <p className="text-[10px] text-muted-foreground">
                    ទ្រទ្រង់ UTF-8 BOM សម្រាប់ Microsoft Excel & Google Sheets
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat("json")}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  selectedFormat === "json"
                    ? "border-gold bg-gold/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <FileCode className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs font-bold">JSON (.json)</p>
                  <p className="text-[10px] text-muted-foreground">
                    ទិន្នន័យ Structured Data សម្រាប់ Developer & API Integration
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Report Category Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">
              ប្រភេទរបាយការណ៍ (Select Report Type)
            </label>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {REPORT_OPTIONS.map((opt) => {
                const isSelected = selectedReportType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedReportType(opt.id)}
                    className={cn(
                      "w-full flex items-start justify-between gap-3 rounded-2xl border p-3 text-left transition-all",
                      isSelected
                        ? "border-gold bg-gold/10"
                        : "border-border/60 bg-secondary/20 hover:bg-secondary/50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground">{opt.titleKh}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                      <span className="text-[10px] font-mono text-gold opacity-80">
                        {opt.title}
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Period Info */}
          <div className="rounded-2xl bg-secondary/40 p-3 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>ចន្លោះកាលបរិច្ឆេទសកម្ម:</span>
            <span className="font-semibold text-foreground font-mono">
              {currentPeriod} {startDate && endDate ? `(${startDate} ~ ${endDate})` : ""}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs">
            បោះបង់
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="rounded-xl bg-gold text-primary-foreground hover:bg-gold/90 text-xs font-semibold"
          >
            {isExporting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                <span>កំពុងទាញយក...</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                <span>ទាញយករបាយការណ៍ ({selectedFormat.toUpperCase()})</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
