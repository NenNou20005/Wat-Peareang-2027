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

/**
 * Safe, clear broken-image SVG fallback to prevent masking load errors with festival placeholders.
 */
export const BROKEN_IMAGE_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <g transform="translate(176, 95)" stroke="#94a3b8" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="1" y1="1" x2="47" y2="47"/>
    <path d="M21 21H7a4 4 0 0 0-4 4v16a4 4 0 0 0 4 4h34a4 4 0 0 0 4-4v-5"/>
    <path d="M45 31.5V11a4 4 0 0 0-4-4H15"/>
    <circle cx="18" cy="18" r="3"/>
    <path d="m42 33-8-8-5 5"/>
  </g>
  <text x="200" y="185" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#64748b" text-anchor="middle">
    មិនអាចផ្ទុករូបភាពបាន
  </text>
  <text x="200" y="205" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">
    (Image Unavailable)
  </text>
</svg>`);
