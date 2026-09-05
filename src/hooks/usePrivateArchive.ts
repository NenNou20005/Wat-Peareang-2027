import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PrivateAlbumItem {
  id: string;
  title: string;
  description: string | null;
  coverKey: string | null;
  coverUrl: string | null;
  photoCount: number;
  videoCount?: number;
  firstImageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateImageItem {
  id: string;
  privateAlbumId: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  title: string | null;
  description: string | null;
  createdAt: string;
  fileUrl: string;
}

export interface PrivateVideoItem {
  id: string;
  privateAlbumId: string;
  filename: string;
  mimeType: string;
  size: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  description: string | null;
  createdAt: string;
  fileUrl: string;
}

export interface PrivateAlbumDetailData {
  album: PrivateAlbumItem;
  images: PrivateImageItem[];
  videos?: PrivateVideoItem[];
}

export const privateArchiveKeys = {
  all: ["admin", "private-archive"] as const,
  session: () => ["admin", "private-archive", "session"] as const,
  albums: () => ["admin", "private-archive", "albums"] as const,
  album: (id: string) => ["admin", "private-archive", "albums", id] as const,
};

/**
 * Hook to check if private archive is unlocked
 */
export function usePrivateArchiveSession() {
  return useQuery<{ unlocked: boolean }>({
    queryKey: privateArchiveKeys.session(),
    queryFn: async () => {
      const res = await fetch("/api/admin/private-archive/session", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          return { unlocked: false };
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      return { unlocked: Boolean(json.unlocked) };
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to unlock private archive
 */
export function useUnlockPrivateArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/admin/private-archive/unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "លេខកូដសម្ងាត់មិនត្រឹមត្រូវឡើយ។");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.setQueryData(privateArchiveKeys.session(), { unlocked: true });
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to lock private archive immediately
 */
export function useLockPrivateArchive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/private-archive/lock", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to lock archive");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.setQueryData(privateArchiveKeys.session(), { unlocked: false });
      queryClient.removeQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to fetch list of private albums
 */
export function usePrivateAlbums(enabled = true) {
  return useQuery<PrivateAlbumItem[]>({
    queryKey: privateArchiveKeys.albums(),
    queryFn: async () => {
      const res = await fetch("/api/admin/private-archive/albums", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("PRIVATE_ARCHIVE_LOCKED");
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch private albums");
      return json.data || [];
    },
    enabled,
    staleTime: 1000 * 60,
  });
}

/**
 * Hook to fetch specific private album and its images
 */
export function usePrivateAlbum(albumId: string, enabled = true) {
  return useQuery<PrivateAlbumDetailData>({
    queryKey: privateArchiveKeys.album(albumId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/private-archive/albums/${encodeURIComponent(albumId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("PRIVATE_ARCHIVE_LOCKED");
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch private album");
      return json.data;
    },
    enabled: Boolean(albumId) && enabled,
    staleTime: 1000 * 30,
  });
}

/**
 * Hook to create private album
 */
export function useCreatePrivateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string | undefined }) => {
      const res = await fetch("/api/admin/private-archive/albums", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create private album");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to update private album
 */
export function useUpdatePrivateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
    }: {
      id: string;
      title: string;
      description?: string | undefined;
    }) => {
      const res = await fetch(`/api/admin/private-archive/albums/${encodeURIComponent(id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update private album");
      }
      return json.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.album(variables.id) });
    },
  });
}

/**
 * Hook to delete private album
 */
export function useDeletePrivateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/private-archive/albums/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete private album");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to upload single private image
 */
export function useUploadPrivateImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      privateAlbumId,
      title,
    }: {
      file: File;
      privateAlbumId: string;
      title?: string | undefined;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("privateAlbumId", privateAlbumId);
      if (title) formData.append("title", title);

      const res = await fetch("/api/admin/private-archive/images/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to upload image");
      }
      return json.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.album(variables.privateAlbumId) });
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to delete private image
 */
export function useDeletePrivateImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, albumId }: { id: string; albumId: string }) => {
      const res = await fetch(`/api/admin/private-archive/images/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete image");
      }
      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.album(variables.albumId) });
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to upload single private video
 */
export function useUploadPrivateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      privateAlbumId,
      title,
      description,
    }: {
      file: File;
      privateAlbumId: string;
      title?: string | undefined;
      description?: string | undefined;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("privateAlbumId", privateAlbumId);
      if (title) formData.append("title", title);
      if (description) formData.append("description", description);

      const res = await fetch("/api/admin/private-archive/videos/upload", {
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.album(variables.privateAlbumId) });
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to delete private video
 */
export function useDeletePrivateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, albumId }: { id: string; albumId: string }) => {
      const res = await fetch(`/api/admin/private-archive/videos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to delete video");
      }
      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.album(variables.albumId) });
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.albums() });
    },
  });
}

/**
 * Hook to change private archive access code (Super Admin only)
 */
export function useChangePrivateCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newCode: string) => {
      const res = await fetch("/api/admin/private-archive/change-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to change access code");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privateArchiveKeys.all });
    },
  });
}

