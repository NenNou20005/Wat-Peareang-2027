import React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toKhmerNumber } from "@/data/archive";
import { useLikeStatus, useToggleLike } from "@/hooks/useInteractions";

interface LikeButtonProps {
  resourceType: "album" | "image";
  resourceId: string;
  initialCount?: number;
  size?: "sm" | "md" | "lg";
  variant?: "floating" | "pill" | "subtle" | "inline";
  showCount?: boolean;
  className?: string;
  countPosition?: "right" | "bottom";
}

export function LikeButton({
  resourceType,
  resourceId,
  initialCount = 0,
  size = "md",
  variant = "pill",
  showCount = true,
  className,
  countPosition = "right",
}: LikeButtonProps) {
  const { data: status } = useLikeStatus(resourceType, resourceId, initialCount);
  const toggleLikeMutation = useToggleLike(resourceType, resourceId);

  const liked = status?.liked ?? false;
  const count = status?.count ?? initialCount;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggleLikeMutation.isPending) return;
    toggleLikeMutation.mutate(liked);
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={toggleLikeMutation.isPending}
        aria-label={liked ? "ដក Like" : "Like"}
        title={liked ? "ដក Like" : "Like"}
        className={cn(
          "group relative flex items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90",
          size === "sm"
            ? "h-8 w-8 text-xs"
            : size === "lg"
              ? "h-11 w-11 text-base"
              : "h-9 w-9 text-sm",
          liked
            ? "bg-rose-500/90 text-white shadow-md shadow-rose-500/30 hover:bg-rose-600"
            : "bg-background/85 text-foreground hover:bg-background shadow-sm hover:text-rose-600",
          className,
        )}
      >
        <Heart
          className={cn(
            iconSizes[size],
            "transition-transform group-hover:scale-110",
            liked && "fill-current animate-heart-pop",
          )}
        />
        {showCount && count > 0 && <span className="sr-only">({count} likes)</span>}
      </button>
    );
  }

  if (variant === "subtle") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={toggleLikeMutation.isPending}
        aria-label={liked ? "ដក Like" : "Like"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
          liked
            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          className,
        )}
      >
        <Heart
          className={cn(iconSizes[size], "transition-transform", liked && "fill-current scale-110")}
        />
        {showCount && (
          <span className="tabular-nums font-mono text-[11px]">{toKhmerNumber(count)}</span>
        )}
      </button>
    );
  }

  // Pill variant
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggleLikeMutation.isPending}
      aria-label={liked ? "ដក Like" : "Like"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-95",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-base",
        liked
          ? "bg-rose-600 text-white shadow-md shadow-rose-600/25 hover:bg-rose-700"
          : "bg-background/90 text-foreground hover:bg-background border border-border/50",
        countPosition === "bottom" && "flex-col gap-0.5",
        className,
      )}
    >
      <Heart
        className={cn(
          iconSizes[size],
          "transition-transform",
          liked ? "fill-current scale-110" : "text-rose-500",
        )}
      />
      <span className="whitespace-nowrap">{liked ? "បាន Like" : "Like"}</span>
      {showCount && count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.2 text-[11px] font-mono",
            liked ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground",
          )}
        >
          {toKhmerNumber(count)}
        </span>
      )}
    </button>
  );
}
