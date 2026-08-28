import { useQuery } from "@tanstack/react-query";
import {
  fetchFestivals,
  fetchYears,
  fetchAlbums,
  fetchAlbumById,
  fetchAlbumPhotos,
  fetchArchiveStats,
  fetchSearchResults,
  type ApiPhoto,
  type ApiArchiveStats,
} from "@/lib/api-archive";
import type { Festival, Album } from "@/data/archive";

export function useFestivals() {
  return useQuery<Festival[]>({
    queryKey: ["archive", "festivals"],
    queryFn: fetchFestivals,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function useYears() {
  return useQuery<number[]>({
    queryKey: ["archive", "years"],
    queryFn: fetchYears,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAlbums(filters?: { year?: number; festivalId?: string; search?: string }) {
  return useQuery<Album[]>({
    queryKey: ["archive", "albums", filters?.year, filters?.festivalId, filters?.search],
    queryFn: () => fetchAlbums(filters),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAlbum(albumId: string) {
  return useQuery<Album | null>({
    queryKey: ["archive", "album", albumId],
    queryFn: () => fetchAlbumById(albumId),
    enabled: !!albumId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAlbumPhotos(albumId: string) {
  return useQuery<ApiPhoto[]>({
    queryKey: ["archive", "album", albumId, "photos"],
    queryFn: () => fetchAlbumPhotos(albumId),
    enabled: !!albumId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useArchiveStats(year?: number) {
  return useQuery<ApiArchiveStats>({
    queryKey: ["archive", "stats", year],
    queryFn: () => fetchArchiveStats(year),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSearchArchive(query: string) {
  return useQuery<Album[]>({
    queryKey: ["archive", "search", query],
    queryFn: () => fetchSearchResults(query),
    enabled: !!query && query.trim().length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
