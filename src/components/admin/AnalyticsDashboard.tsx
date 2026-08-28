import { useState } from "react";
import {
  TrendingUp,
  BarChart3,
  Search,
  Flame,
  Download,
  PartyPopper,
  Sparkles,
  FolderKanban,
  ShieldCheck,
  Heart,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalDateFilter } from "./GlobalDateFilter";
import { OverviewKPISection } from "./OverviewKPISection";
import { TrafficReportView } from "./TrafficReportView";
import { EngagementReportView } from "./EngagementReportView";
import { ContentPerformanceView } from "./ContentPerformanceView";
import { ContentGrowthView } from "./ContentGrowthView";
import { AdminActivityReportView } from "./AdminActivityReportView";
import { SearchAnalyticsView } from "./SearchAnalyticsView";
import { PopularityIntelligenceView } from "./PopularityIntelligenceView";
import { ReportExportModal } from "./ReportExportModal";
import { useReportsSummary, type ReportPeriod } from "@/hooks/useReportsData";
import { cn } from "@/lib/utils";

type DashboardTabId =
  | "overview"
  | "traffic"
  | "engagement"
  | "search"
  | "popularity"
  | "performance"
  | "growth"
  | "activity";

const DASHBOARD_TABS: Array<{
  id: DashboardTabId;
  label: string;
  labelKh: string;
  icon: typeof BarChart3;
}> = [
  {
    id: "overview",
    label: "Overview & KPIs",
    labelKh: "ទិដ្ឋភាពទូទៅ & KPI",
    icon: Sparkles,
  },
  {
    id: "traffic",
    label: "Traffic & Views",
    labelKh: "ចរាចរណ៍ & អ្នកទស្សនា",
    icon: Eye,
  },
  {
    id: "engagement",
    label: "Engagement",
    labelKh: "ការចូលចិត្ត & រក្សាទុក",
    icon: Heart,
  },
  {
    id: "search",
    label: "Search Analytics",
    labelKh: "ការស្វែងរក & និន្នាការ",
    icon: Search,
  },
  {
    id: "popularity",
    label: "Popularity Intelligence",
    labelKh: "ចំណាត់ថ្នាក់ & ភាពពេញនិយម",
    icon: Flame,
  },
  {
    id: "performance",
    label: "Content Performance",
    labelKh: "ប្រសិទ្ធភាពខ្លឹមសារ",
    icon: PartyPopper,
  },
  {
    id: "growth",
    label: "Archive Growth",
    labelKh: "កំណើនបណ្ណសារដ្ឋាន",
    icon: TrendingUp,
  },
  {
    id: "activity",
    label: "Admin Audit Trail",
    labelKh: "សវនកម្មសកម្មភាព Admin",
    icon: ShieldCheck,
  },
];

export function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [period, setPeriod] = useState<ReportPeriod | string>("7d");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useReportsSummary(period, startDate, endDate);

  const handlePeriodChange = (
    newPeriod: ReportPeriod | string,
    newStart?: string | null,
    newEnd?: string | null,
  ) => {
    setPeriod(newPeriod);
    setStartDate(newStart || null);
    setEndDate(newEnd || null);
  };

  const handleRefresh = () => {
    refetchSummary();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-3xl border border-border/70 bg-card p-5.5 shadow-soft">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                ផ្ទាំងគ្រប់គ្រង & វិភាគទិន្នន័យបណ្ណសារដ្ឋាន (Digital Archive Intelligence & Reports)
              </h2>
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              សូចនាករប្រតិបត្តិការទូទៅ ស្ថិតិអ្នកទស្សនា ការស្វែងរក ភាពពេញនិយម កំណើន និងសវនកម្ម
              (PostgreSQL 17)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            id="admin-export-report-btn"
            onClick={() => setShowExportModal(true)}
            className="rounded-2xl bg-gold text-primary-foreground hover:bg-gold/90 text-xs font-semibold px-4 shadow-sm"
          >
            <Download className="h-4 w-4 mr-1.5" />
            <span>នាំចេញរបាយការណ៍ (Export Report)</span>
          </Button>
        </div>
      </div>

      {/* Global Date Filter Bar */}
      <GlobalDateFilter
        period={period}
        startDate={startDate}
        endDate={endDate}
        onPeriodChange={handlePeriodChange}
        onRefresh={handleRefresh}
        isRefreshing={isSummaryFetching}
      />

      {/* 8-Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-3 overflow-x-auto scrollbar-none">
        {DASHBOARD_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`analytics-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold transition-all shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive
                    ? "text-primary-foreground"
                    : tab.id === "popularity"
                      ? "text-amber-500"
                      : tab.id === "engagement"
                        ? "text-rose-500"
                        : "text-muted-foreground",
                )}
              />
              <span>{tab.labelKh}</span>
              <span className="hidden xl:inline text-[10px] opacity-75 font-normal">
                ({tab.label})
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Executive KPIs */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {isSummaryLoading ? (
            <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
              <p className="text-sm">កំពុងផ្ទុកសូចនាករ KPI & ទិដ្ឋភាពទូទៅ...</p>
            </div>
          ) : summaryData ? (
            <>
              <OverviewKPISection data={summaryData} />
              <TrafficReportView period={period} startDate={startDate} endDate={endDate} />
            </>
          ) : (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive shadow-soft">
              <p className="text-sm font-semibold">មិនអាចទាញយកទិន្នន័យទិដ្ឋភាពទូទៅបានទេ។</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Traffic & Views */}
      {activeTab === "traffic" && (
        <TrafficReportView period={period} startDate={startDate} endDate={endDate} />
      )}

      {/* Tab 3: Engagement & Interactions */}
      {activeTab === "engagement" && (
        <EngagementReportView period={period} startDate={startDate} endDate={endDate} />
      )}

      {/* Tab 4: Search Analytics */}
      {activeTab === "search" && (
        <SearchAnalyticsView
          period={
            (["today", "7d", "30d", "all"].includes(period) ? period : "7d") as
              "today" | "7d" | "30d" | "all"
          }
        />
      )}

      {/* Tab 5: Popularity Intelligence */}
      {activeTab === "popularity" && (
        <PopularityIntelligenceView
          period={
            (["today", "7d", "30d", "all"].includes(period) ? period : "all") as
              "today" | "7d" | "30d" | "all"
          }
        />
      )}

      {/* Tab 6: Content Performance */}
      {activeTab === "performance" && (
        <ContentPerformanceView period={period} startDate={startDate} endDate={endDate} />
      )}

      {/* Tab 7: Archive Growth */}
      {activeTab === "growth" && <ContentGrowthView />}

      {/* Tab 8: Admin Audit Trail */}
      {activeTab === "activity" && (
        <AdminActivityReportView period={period} startDate={startDate} endDate={endDate} />
      )}

      {/* Export Report Modal */}
      <ReportExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentPeriod={period}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
