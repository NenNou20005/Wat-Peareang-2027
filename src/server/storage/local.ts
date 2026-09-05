import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageProvider, StoredImageResult, StoredVideoResult } from "./index";

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
  }): Promise<StoredImageResult> {
    const ext = getExtensionFromMime(params.mimeType);
    const filename = `${crypto.randomUUID()}${ext}`;
    const destinationPath = path.join(this.uploadDir, filename);

    // Prevent path traversal
    if (!destinationPath.startsWith(this.uploadDir)) {
      throw new Error("Invalid storage destination path.");
    }

    await fs.promises.writeFile(destinationPath, params.buffer);

    return {
      url: `${this.publicPrefix}/${filename}`,
      filename,
      size: params.buffer.length,
      mimeType: params.mimeType,
    };
  }

  public async deleteImage(urlOrPath: string): Promise<boolean> {
    try {
      const cleanPath = urlOrPath.replace(/^\/+/, "").replace(/\\/g, "/");
      let filePath = path.resolve(this.uploadDir, cleanPath);

      if (!filePath.startsWith(this.uploadDir)) {
        filePath = path.resolve(this.uploadDir, path.basename(urlOrPath));
      }

      if (!filePath.startsWith(this.uploadDir)) {
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

      if (!filePath.startsWith(this.uploadDir)) {
        filePath = path.resolve(this.uploadDir, path.basename(key));
      }

      if (!filePath.startsWith(this.uploadDir)) {
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
    if (!destinationPath.startsWith(this.uploadDir)) {
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
    if (!destinationPath.startsWith(this.uploadDir)) {
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
    if (!destinationPath.startsWith(this.uploadDir)) {
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

