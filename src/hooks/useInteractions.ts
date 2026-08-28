import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVisitorId } from "@/lib/analytics";
import { toast } from "sonner";

export interface LikeStatusResponse {
  liked: boolean;
  count: number;
}

export interface FavoriteStatusResponse {
  favorited: boolean;
}

export interface FavoritedAlbum {
  id: string;
  festivalId: string;
  festivalName: string;
  festivalEmoji: string;
  festivalAccent: string;
  year: number;
  location: string;
  title: string;
  description?: string;
  photoCount: number;
  coverImage?: string;
  favoritedAt: string;
}

export interface FavoritedImage {
  id: string;
  albumId: string;
  albumTitle: string;
  year?: number;
  festivalName?: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  favoritedAt: string;
}

export interface UserFavoritesData {
  albums: FavoritedAlbum[];
  images: FavoritedImage[];
}

export interface InteractionsAnalyticsData {
  likes: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  favorites: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  topLikedAlbums: {
    rank: number;
    albumId: string;
    title: string;
    year: number;
    festivalName: string;
    festivalEmoji: string;
    coverImage?: string;
    likesCount: number;
    viewsCount: number;
  }[];
  topLikedImages: {
    rank: number;
    imageId: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    albumTitle: string;
    year?: number;
    festivalName?: string;
    likesCount: number;
    viewsCount: number;
  }[];
  topFavoritedAlbums: {
    rank: number;
    albumId: string;
    title: string;
    year: number;
    festivalName: string;
    festivalEmoji: string;
    coverImage?: string;
    favoritesCount: number;
  }[];
  topFavoritedImages: {
    rank: number;
    imageId: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    albumTitle: string;
    year?: number;
    festivalName?: string;
    favoritesCount: number;
  }[];
}

/**
 * Hook to query like status and count for an album or image
 */
export function useLikeStatus(
  resourceType: "album" | "image",
  resourceId: string,
  initialCount = 0,
) {
  const visitorId = getVisitorId();

  return useQuery<LikeStatusResponse>({
    queryKey: ["like-status", resourceType, resourceId],
    queryFn: async () => {
      if (!resourceId) return { liked: false, count: initialCount };
      const res = await fetch(
        `/api/interactions/like/status?resourceType=${resourceType}&resourceId=${encodeURIComponent(resourceId)}&visitorId=${encodeURIComponent(visitorId)}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch like status");
      }
      const data = await res.json();
      return {
        liked: Boolean(data.liked),
        count: typeof data.count === "number" ? data.count : initialCount,
      };
    },
    initialData: { liked: false, count: initialCount },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to mutate like status (optimistic toggle)
 */
export function useToggleLike(resourceType: "album" | "image", resourceId: string) {
  const queryClient = useQueryClient();
  const visitorId = getVisitorId();
  const queryKey = ["like-status", resourceType, resourceId];

  return useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      const endpoint = "/api/interactions/like";
      const method = currentlyLiked ? "DELETE" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
          visitorId,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to update like");
      }
      return await res.json();
    },
    onMutate: async (currentlyLiked: boolean) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<LikeStatusResponse>(queryKey) || {
        liked: currentlyLiked,
        count: 0,
      };
      const nextLiked = !currentlyLiked;
      const nextCount = nextLiked ? prev.count + 1 : Math.max(0, prev.count - 1);

      queryClient.setQueryData<LikeStatusResponse>(queryKey, {
        liked: nextLiked,
        count: nextCount,
      });

      return { prev };
    },
    onError: (_err, _variables, context) => {
      if (context?.prev) {
        queryClient.setQueryData(queryKey, context.prev);
      }
      toast.error("មិនអាចកែប្រែ Like បានទេ សូមព្យាយាមម្តងទៀត");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["album", resourceId] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-interactions"] });
    },
  });
}

/**
 * Hook to query favorite status for an album or image
 */
export function useFavoriteStatus(
  resourceType: "album" | "image",
  resourceId: string,
  initialFavorited = false,
) {
  const visitorId = getVisitorId();

  return useQuery<boolean>({
    queryKey: ["favorite-status", resourceType, resourceId],
    queryFn: async () => {
      if (!resourceId) return false;
      const res = await fetch(
        `/api/interactions/favorite/status?resourceType=${resourceType}&resourceId=${encodeURIComponent(resourceId)}&visitorId=${encodeURIComponent(visitorId)}`,
      );
      if (!res.ok) {
        return initialFavorited;
      }
      const data = await res.json();
      return Boolean(data.favorited);
    },
    initialData: initialFavorited,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to mutate favorite status (optimistic toggle)
 */
export function useToggleFavorite(
  resourceType: "album" | "image",
  resourceId: string,
  titleText?: string,
) {
  const queryClient = useQueryClient();
  const visitorId = getVisitorId();
  const queryKey = ["favorite-status", resourceType, resourceId];

  return useMutation({
    mutationFn: async (currentlyFavorited: boolean) => {
      const endpoint = "/api/interactions/favorite";
      const method = currentlyFavorited ? "DELETE" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
          visitorId,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to update favorite");
      }
      return await res.json();
    },
    onMutate: async (currentlyFavorited: boolean) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<boolean>(queryKey) ?? currentlyFavorited;
      const nextFavorited = !currentlyFavorited;

      queryClient.setQueryData<boolean>(queryKey, nextFavorited);

      return { prev };
    },
    onSuccess: (data, currentlyFavorited) => {
      if (!currentlyFavorited) {
        toast.success(
          titleText
            ? `បានរក្សាទុក "${titleText}" ក្នុងចំណូលចិត្ត ⭐`
            : "បានរក្សាទុកក្នុងបញ្ជីចំណូលចិត្ត ⭐",
        );
      } else {
        toast.info("បានដកចេញពីបញ្ជីចំណូលចិត្ត");
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(queryKey, context.prev);
      }
      toast.error("មិនអាចកែប្រែចំណូលចិត្តបានទេ");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics-interactions"] });
    },
  });
}

/**
 * Hook to fetch all user favorites
 */
export function useUserFavorites(resourceType: "album" | "image" | "all" = "all") {
  const visitorId = getVisitorId();

  return useQuery<UserFavoritesData>({
    queryKey: ["user-favorites", resourceType],
    queryFn: async () => {
      const res = await fetch(
        `/api/interactions/favorites?visitorId=${encodeURIComponent(visitorId)}&resourceType=${resourceType}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch favorites");
      }
      const data = await res.json();
      return data.data || { albums: [], images: [] };
    },
    staleTime: 10 * 1000,
  });
}

/**
 * Hook to fetch interactions analytics for admin dashboard
 */
export function useInteractionsAnalytics(period: "today" | "7d" | "30d" | "all" = "all") {
  return useQuery<InteractionsAnalyticsData>({
    queryKey: ["admin-analytics-interactions", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/interactions?period=${period}`);
      if (!res.ok) {
        throw new Error("Failed to fetch interactions analytics");
      }
      const json = await res.json();
      return json.data;
    },
    staleTime: 30 * 1000,
  });
}
