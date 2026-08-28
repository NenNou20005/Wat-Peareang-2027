import { useQuery } from "@tanstack/react-query";
import type {
  MetricComparison,
  ReportsSummaryData,
  ContentPerformanceReportData,
  ArchiveGrowthReportData,
  AdminActivitySummaryData,
  ReportPeriod,
} from "@/server/queries";

export type {
  MetricComparison,
  ReportsSummaryData,
  ContentPerformanceReportData,
  ArchiveGrowthReportData,
  AdminActivitySummaryData,
  ReportPeriod,
};

export function useReportsSummary(
  period: ReportPeriod | string = "7d",
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery<ReportsSummaryData>({
    queryKey: ["admin", "reports", "summary", period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("period", period);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/admin/reports/summary?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch reports summary");
      return json.data;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

export function useContentPerformance(
  period: ReportPeriod | string = "all",
  startDate?: string | null,
  endDate?: string | null,
  festivalId?: string | null,
  year?: number | null,
) {
  return useQuery<ContentPerformanceReportData>({
    queryKey: [
      "admin",
      "reports",
      "content-performance",
      period,
      startDate,
      endDate,
      festivalId,
      year,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("period", period);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (festivalId) params.set("festivalId", festivalId);
      if (year) params.set("year", String(year));

      const res = await fetch(`/api/admin/reports/content-performance?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch content performance");
      return json.data;
    },
    staleTime: 1000 * 45,
  });
}

export function useArchiveGrowth(groupBy: "month" | "year" = "month") {
  return useQuery<ArchiveGrowthReportData>({
    queryKey: ["admin", "reports", "growth", groupBy],
    queryFn: async () => {
      const res = await fetch(`/api/admin/reports/growth?groupBy=${groupBy}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch archive growth");
      return json.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminActivitySummary(
  period: ReportPeriod | string = "30d",
  startDate?: string | null,
  endDate?: string | null,
) {
  return useQuery<AdminActivitySummaryData>({
    queryKey: ["admin", "reports", "activity", period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("period", period);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/admin/reports/activity?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch admin activity summary");
      return json.data;
    },
    staleTime: 1000 * 30,
  });
}

/**
 * Triggers native browser file download for CSV/JSON reports
 */
export async function downloadReportFile(
  format: "csv" | "json",
  reportType:
    | "all"
    | "summary"
    | "content-performance"
    | "top-albums"
    | "top-images"
    | "search-queries"
    | "growth"
    | "activity",
  period: ReportPeriod | string = "7d",
  startDate?: string | null,
  endDate?: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.set("format", format);
    params.set("reportType", reportType);
    params.set("period", period);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const res = await fetch(`/api/admin/reports/export?${params.toString()}`, {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`Export failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const contentDisposition = res.headers.get("Content-Disposition");
    let filename = `wat_peareang_report_${reportType}_${period}.${format}`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to download report";
    return { success: false, error: msg };
  }
}
