import dotenv from "dotenv";
dotenv.config();
import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
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

export class R2StorageProvider implements StorageProvider {
  private client: S3Client | null = null;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    this.bucketName = process.env["R2_BUCKET_NAME"] || "";
    this.publicUrl = (
      process.env["R2_PUBLIC_URL"] ||
      process.env["R2_CUSTOM_DOMAIN"] ||
      ""
    ).replace(/\/$/, "");
  }

  public static isConfigured(): boolean {
    const hasKey =
      Boolean(process.env["R2_ACCESS_KEY_ID"]) && Boolean(process.env["R2_SECRET_ACCESS_KEY"]);
    const hasBucket = Boolean(process.env["R2_BUCKET_NAME"]);
    const hasEndpointOrAccount =
      Boolean(process.env["R2_ENDPOINT"]) || Boolean(process.env["R2_ACCOUNT_ID"]);

    return hasKey && hasBucket && hasEndpointOrAccount;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
    const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
    const accountId = process.env["R2_ACCOUNT_ID"];
    let endpoint = process.env["R2_ENDPOINT"];

    if (!endpoint && accountId) {
      endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    }

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error(
        "Cloudflare R2 storage credentials are not properly configured in environment variables.",
      );
    }

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  public async saveImage(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredImageResult> {
    const client = this.getClient();
    const ext = getExtensionFromMime(params.mimeType);
    const uniqueKey = `uploads/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

    console.log(
      `[Storage/R2]: Starting upload to bucket="${this.bucketName}", key="${uniqueKey}", size=${params.buffer.length}B, mime="${params.mimeType}"`,
    );

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: uniqueKey,
          Body: params.buffer,
          ContentType: params.mimeType,
          Metadata: {
            originalFilename: encodeURIComponent(params.originalFilename),
          },
        }),
      );

      const url = this.getPublicUrl(uniqueKey);
      console.log(`[Storage/R2]: Upload success! URL="${url}"`);

      return {
        url,
        filename: uniqueKey,
        size: params.buffer.length,
        mimeType: params.mimeType,
      };
    } catch (err) {
      console.error(
        `[Storage/R2]: Upload FAILED for key="${uniqueKey}" in bucket="${this.bucketName}":`,
        err instanceof Error ? err.message : err,
      );
      throw new Error(
        `Failed to upload image to Cloudflare R2: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  public async deleteImage(urlOrKey: string): Promise<boolean> {
    try {
      const client = this.getClient();
      const key = this.extractKeyFromUrl(urlOrKey);
      if (!key) return false;

      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return true;
    } catch (err) {
      console.error("[Cloudflare R2 Delete Error]:", err);
      return false;
    }
  }

  public async getObject(key: string): Promise<{
    body: Uint8Array;
    contentType: string;
    contentLength: number;
  } | null> {
    try {
      const client = this.getClient();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();

      return {
        body: bytes,
        contentType: res.ContentType || "image/jpeg",
        contentLength: res.ContentLength || bytes.length,
      };
    } catch (err) {
      console.error("[Cloudflare R2 GetObject Error]:", err);
      return null;
    }
  }

  public getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    return `/api/storage/r2/${encodeURIComponent(key)}`;
  }

  private extractKeyFromUrl(urlOrKey: string): string {
    if (!urlOrKey) return "";
    if (
      !urlOrKey.startsWith("http://") &&
      !urlOrKey.startsWith("https://") &&
      !urlOrKey.startsWith("/")
    ) {
      return urlOrKey;
    }
    if (urlOrKey.includes("/api/storage/r2/")) {
      const match = urlOrKey.match(/\/api\/storage\/r2\/(.+)/);
      return match && match[1] ? decodeURIComponent(match[1]) : "";
    }
    if (this.publicUrl && urlOrKey.startsWith(this.publicUrl)) {
      return urlOrKey.replace(this.publicUrl, "").replace(/^\//, "");
    }
    const parts = urlOrKey.split("/");
    return parts.slice(-2).join("/");
  }
}
