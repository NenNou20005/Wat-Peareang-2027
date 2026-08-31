import dotenv from "dotenv";
dotenv.config();
import { LocalStorageProvider } from "./local";
import { R2StorageProvider } from "./r2";

export interface StoredImageResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  saveImage(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredImageResult>;
  deleteImage(urlOrPath: string): Promise<boolean>;
  getPublicUrl(filename: string): string;
  getObject?(key: string): Promise<{
    body: Uint8Array;
    contentType: string;
    contentLength: number;
  } | null>;
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
      console.log("[Wat Peareang Archive]: Selected Storage Provider -> Local Disk.");
      currentStorageProvider = new LocalStorageProvider();
    }
  }
  return currentStorageProvider;
}

export { LocalStorageProvider, R2StorageProvider };
