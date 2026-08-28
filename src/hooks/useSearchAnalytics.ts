import { useQuery } from "@tanstack/react-query";
import type { AnalyticsPeriod } from "./useAnalyticsData";

export interface SearchAnalyticsSummary {
  totalSearches: number;
  uniqueQueries: number;
  zeroResultSearches: number;
  zeroResultRate: number;
  totalClicks: number;
  clickThroughRate: number;
  avgResultsCount: number;
}

export interface SearchDailyTrendPoint {
  date: string;
  label: string;
  searches: number;
  zeroResults: number;
  clicks: number;
}

export interface TopSearchQueryItem {
  query: string;
  normalizedQuery: string;
  searchCount: number;
  avgResults: number;
  clickCount: number;
  ctrPercent: number;
  lastSearchedAt: string;
}

export interface ZeroResultQueryItem {
  query: string;
  normalizedQuery: string;
  searchCount: number;
  lastSearchedAt: string;
  suggestedAction: string;
}

export interface RecentSearchItem {
  id: number;
  query: string;
  resultsCount: number;
  visitorId?: string | null;
  selectedResultId?: string | null;
  selectedResultType?: string | null;
  createdAt: string;
}

export interface SearchAnalyticsData {
  summary: SearchAnalyticsSummary;
  dailyTrend: SearchDailyTrendPoint[];
  topQueries: TopSearchQueryItem[];
  zeroResultQueries: ZeroResultQueryItem[];
  recentSearches: RecentSearchItem[];
}

export interface PopularAlbumItem {
  rank: number;
  albumId: string;
  title: string;
  festivalName: string;
  festivalEmoji: string;
  year: number;
  coverImage?: string;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface PopularImageItem {
  rank: number;
  imageId: string;
  title: string;
  albumTitle: string;
  festivalName?: string;
  year?: number;
  url: string;
  thumbnailUrl?: string;
  viewsCount: number;
  likesCount: number;
  favoritesCount: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface PopularFestivalItem {
  rank: number;
  festivalId: string;
  name: string;
  emoji: string;
  accent: string;
  month: string;
  albumsCount: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  searchClicksCount: number;
  popularityScore: number;
}

export interface PopularityIntelligenceData {
  weights: {
    views: number;
    likes: number;
    favorites: number;
    searchClicks: number;
  };
  topAlbums: PopularAlbumItem[];
  topImages: PopularImageItem[];
  topFestivals: PopularFestivalItem[];
}

export interface TrendingSearchItem {
  query: string;
  count: number;
}

/**
 * Fetch Search Analytics for Admin
 */
export function useSearchAnalytics(period: AnalyticsPeriod = "7d") {
  return useQuery<SearchAnalyticsData>({
    queryKey: ["admin", "analytics", "search", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/search?period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch search analytics");
      return json.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute background polling
  });
}

/**
 * Fetch Popularity Intelligence for Admin
 */
export function usePopularityIntelligence(period: AnalyticsPeriod = "all") {
  return useQuery<PopularityIntelligenceData>({
    queryKey: ["admin", "analytics", "popularity", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/popularity?period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch popularity intelligence");
      return json.data;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

/**
 * Fetch public trending search suggestions
 */
export function useTrendingSearches(limit: number = 8) {
  return useQuery<TrendingSearchItem[]>({
    queryKey: ["archive", "search", "trending", limit],
    queryFn: async () => {
      const res = await fetch(`/api/archive/search-trending?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch trending searches");
      return json.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
