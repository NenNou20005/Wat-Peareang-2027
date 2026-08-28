import { useQuery } from "@tanstack/react-query";
import type {
  AdminAnalyticsOverview,
  ViewsSeriesPoint,
  TopAlbumItem,
  TopImageItem,
} from "../server/queries";

export type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

export function useAnalyticsOverview(period: AnalyticsPeriod = "today") {
  return useQuery<AdminAnalyticsOverview>({
    queryKey: ["admin", "analytics", "overview", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/overview?period=${period}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load analytics overview");
      }
      return data.data;
    },
    staleTime: 30 * 1000, // 30s
    refetchInterval: 60 * 1000, // auto-refresh every 60s
  });
}

export function useAnalyticsViewsSeries(period: "today" | "7d" | "30d" = "7d") {
  return useQuery<ViewsSeriesPoint[]>({
    queryKey: ["admin", "analytics", "views", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/views?period=${period}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load views series");
      }
      return data.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useMostViewedAlbums(period: AnalyticsPeriod = "all", limit = 10) {
  return useQuery<TopAlbumItem[]>({
    queryKey: ["admin", "analytics", "top-albums", period, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/top-albums?period=${period}&limit=${limit}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load top albums");
      }
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useMostViewedImages(period: AnalyticsPeriod = "all", limit = 10) {
  return useQuery<TopImageItem[]>({
    queryKey: ["admin", "analytics", "top-images", period, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/top-images?period=${period}&limit=${limit}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load top images");
      }
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
