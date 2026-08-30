import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely downloads an archive image file in the browser without navigating away.
 */
export async function downloadArchiveImage(
  url: string,
  defaultFilename?: string,
): Promise<boolean> {
  if (typeof window === "undefined" || !url) return false;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    let filename = defaultFilename;
    if (!filename) {
      const cleanUrl = url.split("?")[0]?.split("#")[0] ?? "";
      const base = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
      filename = base && base.includes(".") ? base : `wat-peareang-${Date.now()}.jpg`;
    }
    if (!filename.includes(".")) {
      filename += ".jpg";
    }

    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);

    return true;
  } catch {
    // Fallback: direct anchor download trigger
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = defaultFilename || "wat-peareang-image.jpg";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return true;
    } catch {
      return false;
    }
  }
}
