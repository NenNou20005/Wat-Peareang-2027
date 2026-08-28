import type { Festival, Album } from "@/data/archive";
import { resolveImageUrl } from "./asset-resolver";

export interface ApiPhoto {
  id: string;
  albumId?: string;
  src: string;
  caption: string;
  tall: boolean;
  thumbnailUrl?: string | null;
  size?: number;
  mimeType?: string;
  photographer?: string | null;
  dateTaken?: string | null;
  copyright?: string | null;
  tags?: string | null;
  viewsCount?: number;
  likesCount?: number;
  downloadsCount?: number;
  sharesCount?: number;
}

export interface ApiArchiveStats {
  totalFestivals: number;
  totalYears: number;
  totalAlbums: number;
  totalImages: number;
  yearStatsMap: Record<number, { albums: number; photos: number; locations: number }>;
}

/**
 * Fetch all festivals from PostgreSQL via API
 */
export async function fetchFestivals(): Promise<Festival[]> {
  try {
    const res = await fetch("/api/archive/festivals");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((f: Festival) => ({
        ...f,
        cover: resolveImageUrl(f.cover, f.id),
      }));
    }
  } catch (e) {
    console.warn("[API Client] Failed to fetch festivals from API:", e);
  }

  return [];
}

/**
 * Fetch all available years from PostgreSQL via API
 */
export async function fetchYears(): Promise<number[]> {
  try {
    const res = await fetch("/api/archive/years");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
  } catch (e) {
    console.warn("[API Client] Failed to fetch years from API:", e);
  }

  return [];
}

/**
 * Fetch albums with optional filtering by year, festivalId, search
 */
export async function fetchAlbums(filters?: {
  year?: number;
  festivalId?: string;
  search?: string;
}): Promise<Album[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.year) params.set("year", String(filters.year));
    if (filters?.festivalId) params.set("festivalId", filters.festivalId);
    if (filters?.search) params.set("search", filters.search);

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/archive/albums${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((a: Album) => ({
        ...a,
        festival: {
          ...a.festival,
          cover: resolveImageUrl(a.festival?.cover, a.festivalId),
        },
      }));
    }
  } catch (e) {
    console.warn("[API Client] Failed to fetch albums from API:", e);
  }

  return [];
}

/**
 * Fetch single album by ID from PostgreSQL via API
 */
export async function fetchAlbumById(albumId: string): Promise<Album | null> {
  try {
    const res = await fetch(`/api/archive/albums/${encodeURIComponent(albumId)}`);
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      const a = json.data as Album;
      return {
        ...a,
        festival: {
          ...a.festival,
          cover: resolveImageUrl(a.festival?.cover, a.festivalId),
        },
      };
    }
    return null;
  } catch (e) {
    console.warn(`[API Client] Failed to fetch album "${albumId}":`, e);
    return null;
  }
}

/**
 * Fetch photos for a specific album from PostgreSQL via API
 */
export async function fetchAlbumPhotos(albumId: string): Promise<ApiPhoto[]> {
  try {
    const res = await fetch(`/api/archive/albums/${encodeURIComponent(albumId)}/photos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((p: ApiPhoto) => ({
        ...p,
        src: resolveImageUrl(p.src),
      }));
    }
  } catch (e) {
    console.warn(`[API Client] Failed to fetch photos for album "${albumId}":`, e);
  }

  return [];
}

/**
 * Fetch archive stats from PostgreSQL via API
 */
export async function fetchArchiveStats(year?: number): Promise<ApiArchiveStats> {
  try {
    const qs = year ? `?year=${year}` : "";
    const res = await fetch(`/api/archive/stats${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
  } catch (e) {
    console.warn("[API Client] Failed to fetch archive stats:", e);
  }

  return {
    totalFestivals: 0,
    totalYears: 0,
    totalAlbums: 0,
    totalImages: 0,
    yearStatsMap: {},
  };
}

/**
 * Search archive in PostgreSQL via API
 */
export async function fetchSearchResults(query: string): Promise<Album[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await fetch(`/api/archive/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((a: Album) => ({
        ...a,
        festival: {
          ...a.festival,
          cover: resolveImageUrl(a.festival?.cover, a.festivalId),
        },
      }));
    }
  } catch (e) {
    console.warn(`[API Client] Search failed for query "${query}":`, e);
  }

  return [];
}
