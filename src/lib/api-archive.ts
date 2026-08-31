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
  year?: number | undefined;
  festivalId?: string | undefined;
  search?: string | undefined;
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

export interface GalleryImage {
  id: string;
  albumId: string;
  albumTitle?: string;
  festivalName?: string;
  year?: number;
  title: string;
  description?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  size?: number;
  mimeType?: string;
  photographer?: string | null;
  dateTaken?: string | null;
  copyright?: string | null;
  tags?: string | string[] | null;
  viewsCount?: number;
  likesCount?: number;
  downloadsCount?: number;
  sharesCount?: number;
  status?: string;
  createdAt?: string;
}

export interface PaginatedImagesResponse {
  images: GalleryImage[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface ArchiveImageParams {
  year?: number | string | undefined;
  festivalId?: string | undefined;
  albumId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

/**
 * Fetch paginated archive images with direct Year, Festival, Album, and Search filters
 */
export async function fetchArchiveImages(
  params?: ArchiveImageParams,
): Promise<PaginatedImagesResponse> {
  try {
    const qs = new URLSearchParams();
    if (params?.year && params.year !== "all") qs.set("year", String(params.year));
    if (params?.festivalId && params.festivalId !== "all") qs.set("festivalId", params.festivalId);
    if (params?.albumId && params.albumId !== "all") qs.set("albumId", params.albumId);
    if (params?.search?.trim()) qs.set("search", params.search.trim());
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));

    const queryString = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`/api/archive/images${queryString}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      const mapped = json.data.map((img: GalleryImage) => ({
        ...img,
        url: resolveImageUrl(img.url),
        thumbnailUrl: img.thumbnailUrl
          ? resolveImageUrl(img.thumbnailUrl)
          : resolveImageUrl(img.url),
      }));

      return {
        images: mapped,
        total: json.total || 0,
        totalPages: json.totalPages || 1,
        page: json.page || 1,
        limit: json.limit || 24,
      };
    }
  } catch (e) {
    console.warn("[API Client] Failed to fetch archive images:", e);
  }

  return {
    images: [],
    total: 0,
    totalPages: 1,
    page: 1,
    limit: 24,
  };
}
