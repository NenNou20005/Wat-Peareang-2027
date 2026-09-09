import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageProvider, StoredImageResult, StoredVideoResult } from "./index";
import { createImageThumbnail } from "./thumbnail";

function getExtensionFromMime(mime: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
  };
  return mimeMap[mime.toLowerCase()] || ".jpg";
}

function getVideoExtensionFromMime(mime: string): string {
  const videoMimeMap: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
  };
  return videoMimeMap[mime.toLowerCase()] || ".mp4";
}

function sanitizeAlbumId(albumId?: string): string | undefined {
  if (!albumId) return undefined;
  const trimmed = albumId.trim();
  // Strip slashes, backslashes, path traversal sequences, and control chars
  // Retain alphanumeric, hyphens, underscores, and Khmer Unicode characters
  const clean = trimmed
    .replace(/[\\/\s]+/g, "-")
    .replace(/[^a-zA-Z0-9_\u1780-\u17FF-]/g, "")
    .replace(/^-+|-+$/g, "");
  if (!clean || clean === "." || clean === "..") return undefined;
  return clean;
}

function isPathInside(childPath: string, parentDir: string): boolean {
  const resolvedParent = path.resolve(parentDir);
  const resolvedChild = path.resolve(childPath);
  const parentWithSep = resolvedParent.endsWith(path.sep) ? resolvedParent : resolvedParent + path.sep;
  if (!resolvedChild.startsWith(parentWithSep)) {
    return false;
  }
  const relative = path.relative(resolvedParent, resolvedChild);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private publicPrefix: string;

  constructor(options?: { uploadDir?: string; publicPrefix?: string }) {
    this.uploadDir = options?.uploadDir || path.resolve(process.cwd(), "public", "uploads");
    this.publicPrefix = options?.publicPrefix || "/uploads";

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public async saveImage(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    albumId?: string;
  }): Promise<StoredImageResult> {
    const ext = getExtensionFromMime(params.mimeType);
    const cleanAlbumId = sanitizeAlbumId(params.albumId);
    const fileId = crypto.randomUUID();

    let targetDir = this.uploadDir;
    let filename = `${fileId}${ext}`;
    let relPath = filename;

    if (cleanAlbumId) {
      targetDir = path.resolve(this.uploadDir, "albums", cleanAlbumId, "originals");
      relPath = `albums/${cleanAlbumId}/originals/${filename}`;
    }

    // Strict containment check BEFORE any filesystem directory creation or writes
    if (cleanAlbumId && !isPathInside(targetDir, this.uploadDir)) {
      throw new Error("Invalid target directory: path traversal detected.");
    }

    const destinationPath = path.resolve(targetDir, filename);
    if (!isPathInside(destinationPath, this.uploadDir)) {
      throw new Error("Invalid storage destination path.");
    }

    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    await fs.promises.writeFile(destinationPath, params.buffer);
    const url = `${this.publicPrefix}/${relPath}`;

    let thumbnailUrl = url;
    let thumbnailFilename = relPath;

    try {
      let thumbsDir = path.resolve(this.uploadDir, "thumbs");
      const thumb = await createImageThumbnail(params.buffer);
      const thumbFilename = cleanAlbumId ? `${fileId}-thumb${thumb.ext}` : `${crypto.randomUUID()}${thumb.ext}`;
      let thumbRelPath = `thumbs/${thumbFilename}`;

      if (cleanAlbumId) {
        thumbsDir = path.resolve(this.uploadDir, "albums", cleanAlbumId, "thumbs");
        thumbRelPath = `albums/${cleanAlbumId}/thumbs/${thumbFilename}`;
      }

      if (!isPathInside(thumbsDir, this.uploadDir)) {
        throw new Error("Invalid thumbnail directory: path traversal detected.");
      }

      const thumbDestPath = path.resolve(thumbsDir, thumbFilename);
      if (!isPathInside(thumbDestPath, this.uploadDir)) {
        throw new Error("Invalid thumbnail destination path.");
      }

      if (!fs.existsSync(thumbsDir)) {
        await fs.promises.mkdir(thumbsDir, { recursive: true });
      }

      await fs.promises.writeFile(thumbDestPath, thumb.buffer);
      thumbnailUrl = `${this.publicPrefix}/${thumbRelPath}`;
      thumbnailFilename = thumbRelPath;
    } catch (thumbErr) {
      console.warn("[LocalStorage] Failed to create thumbnail, falling back to original:", thumbErr);
    }

    return {
      url,
      filename: relPath,
      size: params.buffer.length,
      mimeType: params.mimeType,
      thumbnailUrl,
      thumbnailFilename,
    };
  }

  public async saveThumbnail(params: {
    buffer: Buffer;
    mimeType: string;
    ext: string;
    originalKey?: string;
    albumId?: string;
  }): Promise<{ url: string; key: string } | null> {
    try {
      const rawAlbumId =
        params.albumId ||
        (params.originalKey?.match(/^albums\/([^/]+)\//)?.[1] ?? undefined);
      const cleanAlbumId = sanitizeAlbumId(rawAlbumId);
      const fileId = crypto.randomUUID();

      let thumbsDir = path.resolve(this.uploadDir, "thumbs");
      const thumbFilename = cleanAlbumId ? `${fileId}-thumb${params.ext}` : `${crypto.randomUUID()}${params.ext}`;
      let thumbRelPath = `thumbs/${thumbFilename}`;

      if (cleanAlbumId) {
        thumbsDir = path.resolve(this.uploadDir, "albums", cleanAlbumId, "thumbs");
        thumbRelPath = `albums/${cleanAlbumId}/thumbs/${thumbFilename}`;
      }

      if (!isPathInside(thumbsDir, this.uploadDir)) {
        throw new Error("Invalid thumbnail directory: path traversal detected.");
      }

      const thumbDestPath = path.resolve(thumbsDir, thumbFilename);
      if (!isPathInside(thumbDestPath, this.uploadDir)) {
        throw new Error("Invalid thumbnail destination path.");
      }

      if (!fs.existsSync(thumbsDir)) {
        await fs.promises.mkdir(thumbsDir, { recursive: true });
      }

      await fs.promises.writeFile(thumbDestPath, params.buffer);
      return {
        url: `${this.publicPrefix}/${thumbRelPath}`,
        key: thumbRelPath,
      };
    } catch (err) {
      console.error("[LocalStorage]: Failed to save thumbnail:", err);
      return null;
    }
  }

  public async deleteImage(urlOrPath: string): Promise<boolean> {
    try {
      let cleanPath = urlOrPath.replace(/^\/+/, "").replace(/\\/g, "/");
      if (cleanPath.startsWith("uploads/")) {
        cleanPath = cleanPath.replace(/^uploads\//, "");
      }
      let filePath = path.resolve(this.uploadDir, cleanPath);

      if (!isPathInside(filePath, this.uploadDir)) {
        filePath = path.resolve(this.uploadDir, path.basename(urlOrPath));
      }

      if (!isPathInside(filePath, this.uploadDir)) {
        return false;
      }

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public getPublicUrl(filename: string): string {
    return `${this.publicPrefix}/${filename}`;
  }

  public async getObject(key: string): Promise<{
    body: Uint8Array;
    contentType: string;
    contentLength: number;
  } | null> {
    try {
      const cleanKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
      let filePath = path.resolve(this.uploadDir, cleanKey);

      if (!isPathInside(filePath, this.uploadDir)) {
        filePath = path.resolve(this.uploadDir, path.basename(key));
      }

      if (!isPathInside(filePath, this.uploadDir)) {
        return null;
      }

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const buffer = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".avif": "image/avif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
      };

      return {
        body: new Uint8Array(buffer),
        contentType: mimeMap[ext] || "application/octet-stream",
        contentLength: buffer.length,
      };
    } catch {
      return null;
    }
  }

  public async savePrivateImage(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<{ r2Key: string; size: number; mimeType: string }> {
    const ext = getExtensionFromMime(params.mimeType);
    const filename = `${crypto.randomUUID()}${ext}`;
    const privateDir = path.resolve(this.uploadDir, "private-archive");

    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    const destinationPath = path.resolve(privateDir, filename);
    if (!isPathInside(destinationPath, this.uploadDir)) {
      throw new Error("Invalid storage destination path.");
    }

    await fs.promises.writeFile(destinationPath, params.buffer);

    return {
      r2Key: `private-archive/${filename}`,
      size: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  public async saveVideo(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredVideoResult> {
    const ext = getVideoExtensionFromMime(params.mimeType);
    const filename = `${crypto.randomUUID()}${ext}`;
    const videoDir = path.resolve(this.uploadDir, "videos");

    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    const destinationPath = path.resolve(videoDir, filename);
    if (!isPathInside(destinationPath, this.uploadDir)) {
      throw new Error("Invalid storage destination path.");
    }

    await fs.promises.writeFile(destinationPath, params.buffer);

    return {
      url: `${this.publicPrefix}/videos/${filename}`,
      filename: `videos/${filename}`,
      size: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  public async savePrivateVideo(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<{ r2Key: string; size: number; mimeType: string }> {
    const ext = getVideoExtensionFromMime(params.mimeType);
    const filename = `${crypto.randomUUID()}${ext}`;
    const privateVideoDir = path.resolve(this.uploadDir, "private-archive", "videos");

    if (!fs.existsSync(privateVideoDir)) {
      fs.mkdirSync(privateVideoDir, { recursive: true });
    }

    const destinationPath = path.resolve(privateVideoDir, filename);
    if (!isPathInside(destinationPath, this.uploadDir)) {
      throw new Error("Invalid storage destination path.");
    }

    await fs.promises.writeFile(destinationPath, params.buffer);

    return {
      r2Key: `private-archive/videos/${filename}`,
      size: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  public async deleteVideo(urlOrPath: string): Promise<boolean> {
    return this.deleteImage(urlOrPath);
  }
}

