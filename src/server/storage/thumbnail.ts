import sharp from "sharp";

export const THUMBNAIL_MAX_WIDTH = 600;
export const THUMBNAIL_QUALITY = 80;

export interface ThumbnailResult {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  isOptimized: boolean;
}

/**
 * Generates an optimized WebP thumbnail from an image buffer.
 * Automatically respects EXIF orientation tags and limits width to maxWidth.
 * Falls back to the original buffer gracefully if sharp encounters an error.
 */
export async function createImageThumbnail(
  inputBuffer: Buffer,
  maxWidth = THUMBNAIL_MAX_WIDTH,
  quality = THUMBNAIL_QUALITY,
): Promise<ThumbnailResult> {
  try {
    const resizedBuffer = await sharp(inputBuffer)
      .rotate() // Auto-orient based on EXIF
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
      })
      .webp({
        quality,
        effort: 4, // Balanced speed vs compression
      })
      .toBuffer();

    return {
      buffer: resizedBuffer,
      mimeType: "image/webp",
      ext: ".webp",
      isOptimized: true,
    };
  } catch (err) {
    console.warn("[Thumbnail Generator] Failed to generate WebP thumbnail, falling back to original:", err);
    return {
      buffer: inputBuffer,
      mimeType: "image/jpeg",
      ext: ".jpg",
      isOptimized: false,
    };
  }
}

