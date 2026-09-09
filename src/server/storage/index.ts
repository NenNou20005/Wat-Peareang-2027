import dotenv from "dotenv";
dotenv.config();
import { LocalStorageProvider } from "./local";
import { R2StorageProvider } from "./r2";

export interface StoredImageResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string | undefined;
  thumbnailFilename?: string | undefined;
}

export interface StoredVideoResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface StorageObjectStream {
  stream: ReadableStream;
  contentType: string;
  contentLength?: number | undefined;
  contentRange?: string | undefined;
  acceptRanges?: string | undefined;
  status: number;
}

export interface StorageProvider {
  saveImage(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    albumId?: string;
  }): Promise<StoredImageResult>;
  deleteImage(urlOrPath: string): Promise<boolean>;
  getPublicUrl(filename: string): string;
  getObject?(key: string): Promise<{
    body: Uint8Array;
    contentType: string;
    contentLength: number;
  } | null>;
  saveThumbnail?(params: {
    buffer: Buffer;
    mimeType: string;
    ext: string;
    originalKey?: string;
    albumId?: string;
  }): Promise<{ url: string; key: string } | null>;
  getObjectStream?(key: string, range?: string): Promise<StorageObjectStream | null>;
  savePrivateImage?(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<{ r2Key: string; size: number; mimeType: string }>;
  saveVideo?(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredVideoResult>;
  deleteVideo?(urlOrPath: string): Promise<boolean>;
  savePrivateVideo?(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<{ r2Key: string; size: number; mimeType: string }>;
}

let currentStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!currentStorageProvider) {
    if (R2StorageProvider.isConfigured()) {
      const bucket = process.env["R2_BUCKET_NAME"] || "(unnamed)";
      console.log(
        `[Wat Peareang Archive]: Selected Storage Provider -> Cloudflare R2 (Bucket: "${bucket}").`,
      );
      currentStorageProvider = new R2StorageProvider();
    } else {
      const isProduction =
        process.env["NODE_ENV"] === "production" || Boolean(process.env["RENDER"]);
      if (isProduction) {
        throw new Error(
          "[Wat Peareang Archive]: Cloudflare R2 storage is required in production but is not properly configured. Refusing to use ephemeral local disk storage to prevent data loss. Please ensure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_ENDPOINT (or R2_ACCOUNT_ID) are set in environment variables.",
        );
      }
      console.log(
        "[Wat Peareang Archive]: Selected Storage Provider -> Local Disk (development fallback).",
      );
      currentStorageProvider = new LocalStorageProvider();
    }
  }
  return currentStorageProvider;
}

export function resetStorageProviderForTesting(): void {
  currentStorageProvider = null;
}

export { LocalStorageProvider, R2StorageProvider };

