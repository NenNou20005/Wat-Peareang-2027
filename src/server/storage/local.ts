import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageProvider, StoredImageResult } from "./index";

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
      const filename = path.basename(urlOrPath);
      const filePath = path.join(this.uploadDir, filename);

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
}
