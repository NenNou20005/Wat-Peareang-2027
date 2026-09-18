ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "sha256" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "width" integer;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN IF NOT EXISTS "height" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_images_sha256" ON "images" USING btree ("sha256");

