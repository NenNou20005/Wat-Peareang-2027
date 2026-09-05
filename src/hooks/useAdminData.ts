import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Permission } from "@/types/auth";

// --- QUERY KEYS DEFINITION ---
export const archiveKeys = {
  all: ["archive"] as const,
  festivals: () => ["archive", "festivals"] as const,
  years: () => ["archive", "years"] as const,
  albums: (filters?: {
    year?: number | undefined;
    festivalId?: string | undefined;
    search?: string | undefined;
  }) => ["archive", "albums", filters?.year, filters?.festivalId, filters?.search] as const,
  album: (albumId: string) => ["archive", "album", albumId] as const,
  albumPhotos: (albumId: string) => ["archive", "album", albumId, "photos"] as const,
  stats: (year?: number | undefined) => ["archive", "stats", year] as const,
  search: (query?: string | undefined) => ["archive", "search", query] as const,
};

export const adminKeys = {
  all: ["admin"] as const,
  dashboard: () => ["admin", "dashboard"] as const,
  festivals: () => ["admin", "festivals"] as const,
  years: () => ["admin", "years"] as const,
  albums: (params?: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    festivalId?: string | undefined;
    year?: string | number | undefined;
    status?: string | undefined;
  }) => ["admin", "albums", params] as const,
  images: (params?: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    festivalId?: string | undefined;
    albumId?: string | undefined;
    year?: string | number | undefined;
    status?: string | undefined;
  }) => ["admin", "images", params] as const,
  videos: (params?: { albumId?: string | undefined; status?: string | undefined }) =>
    ["admin", "videos", params] as const,
  editors: () => ["admin", "editors"] as const,
  trash: () => ["admin", "trash"] as const,
  activityLogs: () => ["admin", "activity-logs"] as const,
  events: (params?: { festivalId?: string | undefined; year?: number | undefined }) =>
    ["admin", "events", params] as const,
};

import { resolveImageUrl } from "@/lib/asset-resolver";

// --- DATA TYPES ---
export interface AdminFestival {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  month: string;
  description?: string | undefined;
  coverUrl?: string | undefined;
  isCustom?: boolean | undefined;
  status?: string | undefined;
}

export interface AdminAlbum {
  id: string;
  festivalId: string;
  year: number;
  location: string;
  title: string;
  description?: string | undefined;
  photoCount: number;
  coverImage?: string | undefined;
  createdAt?: string | undefined;
  status?: string | undefined;
  festival?:
    | {
        id: string;
        name: string;
        emoji: string;
      }
    | undefined;
}

export interface AdminImage {
  id: string;
  albumId: string;
  albumTitle?: string | undefined;
  festivalName?: string | undefined;
  year?: number | undefined;
  title: string;
  description?: string | undefined;
  url: string;
  thumbnailUrl?: string | undefined;
  size?: number | undefined;
  mimeType?: string | undefined;
  photographer?: string | undefined;
  tags?: string | string[] | undefined;
  uploadedBy?: string | undefined;
  createdAt: string;
  status?: string | undefined;
}

export interface AdminVideo {
  id: string;
  albumId: string;
  albumTitle?: string | undefined;
  festivalName?: string | undefined;
  year?: number | undefined;
  title: string;
  description?: string | undefined;
  filename: string;
  mimeType: string;
  r2Key?: string | null | undefined;
  url: string;
  thumbnailUrl?: string | null | undefined;
  size: number;
  duration?: number | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  status: string;
  viewsCount?: number | undefined;
  likesCount?: number | undefined;
  uploadedBy?: string | null | undefined;
  deletedAt?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTrashData {
  festivals: Array<{
    id: string;
    name: string;
    emoji: string;
    month?: string | undefined;
    trashedAt?: string | undefined;
  }>;
  albums: Array<{
    id: string;
    title: string;
    festivalId: string;
    year: number;
    location?: string | undefined;
    photoCount: number;
    trashedAt?: string | undefined;
  }>;
  images: Array<{
    id: string;
    title: string;
    url: string;
    albumId: string;
    uploadedBy?: string | undefined;
    trashedAt?: string | undefined;
  }>;
  videos?: Array<{
    id: string;
    title: string;
    url: string;
    albumId: string;
    albumTitle?: string | undefined;
    size?: number | undefined;
    mimeType?: string | undefined;
    trashedAt?: string | undefined;
  }> | undefined;
}

export interface AdminDashboardData {
  totalFestivals: number;
  totalYears: number;
  totalAlbums: number;
  totalImages: number;
  totalEditors: number;
  activeEditors: number;
  recentActivities: Array<{
    id: string;
    userName: string;
    userRole: string;
    action: string;
    resource: string;
    details?: string | undefined;
    timestamp: string;
  }>;
  recentImages: Array<{
    id: string;
    title: string;
    url: string;
    createdAt: string;
    uploadedBy: string;
  }>;
}

export interface AdminActivityLogItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  details?: string | undefined;
  ip?: string | undefined;
  timestamp: string;
}

// --- QUERY HOOKS ---

export function useAdminDashboard() {
  return useQuery<AdminDashboardData>({
    queryKey: adminKeys.dashboard(),
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch dashboard data");
      return json.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminFestivals() {
  return useQuery<AdminFestival[]>({
    queryKey: adminKeys.festivals(),
    queryFn: async () => {
      const res = await fetch("/api/admin/festivals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch admin festivals");
      return json.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdminYears() {
  return useQuery<number[]>({
    queryKey: adminKeys.years(),
    queryFn: async () => {
      const res = await fetch("/api/admin/years");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch admin years");
      return json.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdminAlbums(params?: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  festivalId?: string | undefined;
  year?: string | number | undefined;
  status?: string | undefined;
}) {
  return useQuery<{
    albums: AdminAlbum[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }>({
    queryKey: adminKeys.albums(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.search?.trim()) searchParams.set("search", params.search.trim());
      if (params?.festivalId && params.festivalId !== "all") {
        searchParams.set("festivalId", params.festivalId);
      }
      if (params?.year && params.year !== "all") {
        searchParams.set("year", String(params.year));
      }
      if (params?.status) searchParams.set("status", params.status);

      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const res = await fetch(`/api/admin/albums${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch admin albums");
      return {
        albums: json.albums || [],
        total: json.total || 0,
        totalPages: json.totalPages || 1,
        page: json.page || 1,
        limit: json.limit || 20,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminImages(params?: {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  festivalId?: string | undefined;
  albumId?: string | undefined;
  year?: string | number | undefined;
  status?: string | undefined;
}) {
  return useQuery<{
    images: AdminImage[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }>({
    queryKey: adminKeys.images(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.search?.trim()) searchParams.set("search", params.search.trim());
      if (params?.festivalId && params.festivalId !== "all") {
        searchParams.set("festivalId", params.festivalId);
      }
      if (params?.albumId && params.albumId !== "all") {
        searchParams.set("albumId", params.albumId);
      }
      if (params?.year && params.year !== "all") {
        searchParams.set("year", String(params.year));
      }
      if (params?.status) searchParams.set("status", params.status);

      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const res = await fetch(`/api/admin/images${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rawImages: AdminImage[] = json.images || [];
      const mappedImages = rawImages.map((img) => ({
        ...img,
        url: resolveImageUrl(img.url),
        thumbnailUrl: img.thumbnailUrl
          ? resolveImageUrl(img.thumbnailUrl)
          : resolveImageUrl(img.url),
      }));
      return {
        images: mappedImages,
        total: json.total || 0,
        totalPages: json.totalPages || 1,
        page: json.page || 1,
        limit: json.limit || 24,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminVideos(params?: {
  albumId?: string | undefined;
  status?: string | undefined;
}) {
  return useQuery<{
    videos: AdminVideo[];
  }>({
    queryKey: adminKeys.videos(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.albumId && params.albumId !== "all") {
        searchParams.set("albumId", params.albumId);
      }
      if (params?.status) searchParams.set("status", params.status);

      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const res = await fetch(`/api/admin/videos${qs}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        videos: json.data || [],
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdminEditors() {
  return useQuery<User[]>({
    queryKey: adminKeys.editors(),
    queryFn: async () => {
      const res = await fetch("/api/admin/editors");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch editors");
      return json.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdminTrash() {
  return useQuery<AdminTrashData>({
    queryKey: adminKeys.trash(),
    queryFn: async () => {
      const res = await fetch("/api/admin/trash");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch trash data");
      return json.data || { festivals: [], albums: [], images: [] };
    },
    staleTime: 1000 * 60 * 1,
  });
}

export function useAdminActivityLogs() {
  return useQuery<AdminActivityLogItem[]>({
    queryKey: adminKeys.activityLogs(),
    queryFn: async () => {
      const res = await fetch("/api/admin/activity-logs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch activity logs");
      return json.data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// --- MUTATION HOOKS WITH TARGETED INVALIDATION ---

/**
 * 1. FESTIVAL MUTATIONS
 */
export function useCreateFestival() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      id?: string | undefined;
      name: string;
      emoji: string;
      accent?: string | undefined;
      month?: string | undefined;
      description?: string | undefined;
      coverUrl?: string | undefined;
    }) => {
      const res = await fetch("/api/admin/festivals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create festival");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

export function useUpdateFestival() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name: string;
      emoji: string;
      month?: string | undefined;
      accent?: string | undefined;
      description?: string | undefined;
      coverUrl?: string | undefined;
    }) => {
      const res = await fetch(`/api/admin/festivals/${encodeURIComponent(id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update festival");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

export function useDeleteFestival() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/festivals/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete festival");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

/**
 * 2. YEAR MUTATIONS
 */
export function useCreateYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const res = await fetch("/api/admin/years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create year");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.years() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.years() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

export function useDeleteYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const res = await fetch(`/api/admin/years/${year}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete year");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.years() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.years() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

/**
 * 3. ALBUM MUTATIONS
 */
export function useCreateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      festivalId: string;
      year: number;
      title: string;
      location?: string | undefined;
      description?: string | undefined;
      coverImage?: string | undefined;
    }) => {
      const res = await fetch("/api/admin/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create album");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

export function useUpdateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      title: string;
      location?: string | undefined;
      description?: string | undefined;
      coverImage?: string | undefined;
    }) => {
      const res = await fetch(`/api/admin/albums/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update album");
      return json.data;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.album(variables.id) }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

export function useDeleteAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/albums/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete album");
      return json.data;
    },
    onSuccess: async (_, albumId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "images"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.album(albumId) }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.albumPhotos(albumId) }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ]);
    },
  });
}

/**
 * 4. IMAGE MUTATIONS
 */
export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/admin/images/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to upload image");
      return json.data;
    },
    onSuccess: async (_, formData) => {
      const albumId = formData.get("albumId") as string | null;
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["admin", "images"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ];
      if (albumId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: archiveKeys.albumPhotos(albumId) }),
          queryClient.invalidateQueries({ queryKey: archiveKeys.album(albumId) }),
        );
      }
      await Promise.all(invalidations);
    },
  });
}

export function useUpdateImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      albumId,
      ...body
    }: {
      id: string;
      albumId?: string | undefined;
      title: string;
      photographer?: string | undefined;
      tags?: string[] | undefined;
    }) => {
      const res = await fetch(`/api/admin/images/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update image");
      return json.data;
    },
    onSuccess: async (_, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["admin", "images"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
      ];
      if (variables.albumId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: archiveKeys.albumPhotos(variables.albumId) }),
        );
      }
      await Promise.all(invalidations);
    },
  });
}

export function useTrashImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, albumId }: { id: string; albumId?: string | undefined }) => {
      const res = await fetch(`/api/admin/images/${encodeURIComponent(id)}/trash`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to trash image");
      return json.data;
    },
    onSuccess: async (_, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["admin", "images"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: ["archive", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "search"] }),
      ];
      if (variables.albumId) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: archiveKeys.albumPhotos(variables.albumId) }),
          queryClient.invalidateQueries({ queryKey: archiveKeys.album(variables.albumId) }),
        );
      }
      await Promise.all(invalidations);
    },
  });
}

/**
 * 4.5. VIDEO MUTATIONS
 */
export function useUploadVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/admin/videos/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to upload video");
      }
      return json.data;
    },
    onSuccess: async (_, variables) => {
      const albumId = variables.get("albumId") as string;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        ...(albumId ? [queryClient.invalidateQueries({ queryKey: archiveKeys.album(albumId) })] : []),
      ]);
    },
  });
}

export function useTrashVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(id)}/trash`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to trash video");
      return json;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

export function useRestoreVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(id)}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to restore video");
      return json;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

export function usePermanentDeleteVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/videos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to permanently delete video");
      return json;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

/**
 * 5. EDITOR MUTATIONS
 */
export function useCreateEditor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      email: string;
      password?: string | undefined;
      permissions: Permission[];
    }) => {
      const res = await fetch("/api/admin/editors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create editor");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.editors() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

export function useUpdateEditor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      name: string;
      email: string;
      password?: string | undefined;
      permissions: Permission[];
      status: "active" | "disabled";
    }) => {
      const res = await fetch(`/api/admin/editors/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update editor");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.editors() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

export function useDeleteEditor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/editors/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete editor");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.editors() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

/**
 * 6. TRASH MUTATIONS
 */
export function useRestoreTrashItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      type,
      id,
    }: {
      type: "festival" | "album" | "image" | "video";
      id: string;
    }) => {
      let endpoint = "";
      if (type === "festival") endpoint = `/api/admin/festivals/${id}/restore`;
      else if (type === "album") endpoint = `/api/admin/albums/${id}/restore`;
      else if (type === "image") endpoint = `/api/admin/images/${id}/restore`;
      else if (type === "video") endpoint = `/api/admin/videos/${id}/restore`;

      const res = await fetch(endpoint, { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to restore item");
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.festivals() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.years() }),
        queryClient.invalidateQueries({ queryKey: ["admin", "albums"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "images"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: archiveKeys.all }),
      ]);
    },
  });
}

export function usePermanentDeleteTrashItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      type,
      id,
    }: {
      type: "festival" | "album" | "image" | "video";
      id: string;
    }) => {
      let endpoint = "";
      if (type === "festival") endpoint = `/api/admin/festivals/${id}/permanent`;
      else if (type === "album") endpoint = `/api/admin/albums/${id}/permanent`;
      else if (type === "image") endpoint = `/api/admin/images/${id}/permanent`;
      else if (type === "video") endpoint = `/api/admin/videos/${id}`;

      const res = await fetch(endpoint, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to permanently delete item");
      }
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.trash() }),
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] }),
        queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
      ]);
    },
  });
}

export interface AdminEvent {
  id: string;
  festivalId: string;
  year: number;
  nameKh: string;
  nameEn?: string | null | undefined;
  description?: string | null | undefined;
  eventDate?: string | null | undefined;
  location?: string | undefined;
  icon?: string | undefined;
  coverImage?: string | null | undefined;
  status: string;
  sortOrder: number;
  albumCount?: number;
  photoCount?: number;
  festival?: {
    id: string;
    name: string;
    emoji: string;
  };
}

export function useAdminEvents(params?: { festivalId?: string | undefined; year?: number | undefined }) {
  return useQuery({
    queryKey: adminKeys.events(params),
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params?.festivalId) sp.set("festivalId", params.festivalId);
      if (params?.year) sp.set("year", String(params.year));
      const res = await fetch(`/api/admin/events?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch admin events");
      const json = await res.json();
      return (json.events || []) as AdminEvent[];
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      festivalId: string;
      year: number;
      nameKh: string;
      nameEn?: string | null | undefined;
      description?: string | null | undefined;
      eventDate?: string | null | undefined;
      location?: string | undefined;
      icon?: string | undefined;
      coverImage?: string | null | undefined;
      status?: string | undefined;
      sortOrder?: number | undefined;
    }) => {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create event");
      }
      return json.event;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "events"] }),
      ]);
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        festivalId: string;
        year: number;
        nameKh: string;
        nameEn: string | null | undefined;
        description: string | null | undefined;
        eventDate: string | null | undefined;
        location: string | undefined;
        icon: string | undefined;
        coverImage: string | null | undefined;
        status: string | undefined;
        sortOrder: number | undefined;
      }>;
    }) => {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update event");
      }
      return json.event;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "events"] }),
      ]);
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete event");
      }
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "events"] }),
      ]);
    },
  });
}

export function useReorderEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; sortOrder: number }>) => {
      const res = await fetch("/api/admin/events/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reorder events");
      }
      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["archive", "events"] }),
      ]);
    },
  });
}

