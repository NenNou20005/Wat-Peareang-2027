import React from "react";
import { Bookmark, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavoriteStatus, useToggleFavorite } from "@/hooks/useInteractions";

interface FavoriteButtonProps {
  resourceType: "album" | "image";
  resourceId: string;
  titleText?: string;
  size?: "sm" | "md" | "lg";
  variant?: "floating" | "pill" | "subtle";
  iconType?: "bookmark" | "star";
  showLabel?: boolean;
  className?: string;
}

export function FavoriteButton({
  resourceType,
  resourceId,
  titleText,
  size = "md",
  variant = "pill",
  iconType = "bookmark",
  showLabel = true,
  className,
}: FavoriteButtonProps) {
  const { data: favorited } = useFavoriteStatus(resourceType, resourceId);
  const toggleFavoriteMutation = useToggleFavorite(resourceType, resourceId, titleText);

  const isFav = Boolean(favorited);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggleFavoriteMutation.isPending) return;
    toggleFavoriteMutation.mutate(isFav);
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const Icon = iconType === "star" ? Star : Bookmark;

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={toggleFavoriteMutation.isPending}
        aria-label={isFav ? "ដកចេញពីចំណូលចិត្ត" : "រក្សាទុកជាចំណូលចិត្ត"}
        title={isFav ? "ដកចេញពីចំណូលចិត្ត" : "រក្សាទុកជាចំណូលចិត្ត"}
        className={cn(
          "group relative flex items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90",
          size === "sm"
            ? "h-8 w-8 text-xs"
            : size === "lg"
              ? "h-11 w-11 text-base"
              : "h-9 w-9 text-sm",
          isFav
            ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 hover:bg-amber-600"
            : "bg-background/85 text-foreground hover:bg-background shadow-sm hover:text-amber-500",
          className,
        )}
      >
        <Icon
          className={cn(
            iconSizes[size],
            "transition-transform group-hover:scale-110",
            isFav && "fill-current",
          )}
        />
      </button>
    );
  }

  if (variant === "subtle") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={toggleFavoriteMutation.isPending}
        aria-label={isFav ? "ដកចេញពីចំណូលចិត្ត" : "រក្សាទុកជាចំណូលចិត្ត"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
          isFav
            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          className,
        )}
      >
        <Icon
          className={cn(iconSizes[size], "transition-transform", isFav && "fill-current scale-110")}
        />
        {showLabel && (
          <span className="whitespace-nowrap">{isFav ? "បានរក្សាទុក" : "ចំណូលចិត្ត"}</span>
        )}
      </button>
    );
  }

  // Pill variant
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggleFavoriteMutation.isPending}
      aria-label={isFav ? "ដកចេញពីចំណូលចិត្ត" : "រក្សាទុកជាចំណូលចិត្ត"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-95",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-base",
        isFav
          ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600"
          : "bg-background/90 text-foreground hover:bg-background border border-border/50 hover:text-amber-600",
        className,
      )}
    >
      <Icon
        className={cn(
          iconSizes[size],
          "transition-transform",
          isFav ? "fill-current scale-110" : "text-amber-500",
        )}
      />
      {showLabel && (
        <span className="whitespace-nowrap">{isFav ? "បានរក្សាទុក ⭐" : "ចំណូលចិត្ត"}</span>
      )}
    </button>
  );
}
