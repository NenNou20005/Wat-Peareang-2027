import { LocalStorageProvider } from "./local";

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
}

let currentStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!currentStorageProvider) {
    currentStorageProvider = new LocalStorageProvider();
  }
  return currentStorageProvider;
}
