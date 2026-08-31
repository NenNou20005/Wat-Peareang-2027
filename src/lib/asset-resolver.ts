import chaulChnam from "@/assets/fest-chaul-chnam.jpg";
import visak from "@/assets/fest-visak.jpg";
import meak from "@/assets/fest-meak.jpg";
import cholVossa from "@/assets/fest-chol-vossa.jpg";
import chenhVossa from "@/assets/fest-chenh-vossa.jpg";
import pchumBen from "@/assets/fest-pchum-ben.jpg";
import kathin from "@/assets/fest-kathin.jpg";
import omTouk from "@/assets/fest-om-touk.jpg";

export const LOCAL_ASSETS_MAP: Record<string, string> = {
  "/assets/fest-chaul-chnam.jpg": chaulChnam,
  "/assets/fest-visak.jpg": visak,
  "/assets/fest-meak.jpg": meak,
  "/assets/fest-chol-vossa.jpg": cholVossa,
  "/assets/fest-chenh-vossa.jpg": chenhVossa,
  "/assets/fest-pchum-ben.jpg": pchumBen,
  "/assets/fest-kathin.jpg": kathin,
  "/assets/fest-om-touk.jpg": omTouk,
  "fest-chaul-chnam.jpg": chaulChnam,
  "fest-visak.jpg": visak,
  "fest-meak.jpg": meak,
  "fest-chol-vossa.jpg": cholVossa,
  "fest-chenh-vossa.jpg": chenhVossa,
  "fest-pchum-ben.jpg": pchumBen,
  "fest-kathin.jpg": kathin,
  "fest-om-touk.jpg": omTouk,
  "chaul-chnam": chaulChnam,
  "visak-bochea": visak,
  "meak-bochea": meak,
  "chol-vossa": cholVossa,
  "chenh-vossa": chenhVossa,
  "pchum-ben": pchumBen,
  kathin: kathin,
  "om-touk": omTouk,
  "dar-lean": cholVossa,
  "pka-samaki": chenhVossa,
  "chlong-preah-vihear": visak,
  "bombuos-neak": chaulChnam,
  "laeng-neakta": pchumBen,
  "chrot-preah-nongkoal": cholVossa,
  "puthea-pisek": meak,
  "pachay-buon": kathin,
};

/**
 * Resolves an image URL (from PostgreSQL or API) to a bundled Vite asset if applicable,
 * or returns the URL directly.
 */
export function resolveImageUrl(url?: string | null, festivalId?: string): string {
  if (!url || typeof url !== "string") {
    if (festivalId && LOCAL_ASSETS_MAP[festivalId]) {
      return LOCAL_ASSETS_MAP[festivalId];
    }
    return chaulChnam;
  }

  // Uploaded permanent assets or remote CDN URLs
  if (
    url.startsWith("/uploads/") ||
    url.startsWith("/api/storage/") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  // If URL matches one of our local bundled keys
  if (LOCAL_ASSETS_MAP[url]) {
    return LOCAL_ASSETS_MAP[url];
  }

  const filename = url.split("/").pop();
  if (filename && LOCAL_ASSETS_MAP[filename]) {
    return LOCAL_ASSETS_MAP[filename];
  }

  // If festivalId matches fallback
  if (festivalId && LOCAL_ASSETS_MAP[festivalId]) {
    return LOCAL_ASSETS_MAP[festivalId];
  }

  return url;
}
