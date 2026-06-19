-- UVideo MVP schema migration for age verification, S3 video moderation, quick chat, audio moderation, reports, and audit logs.
-- This migration is intentionally additive/backfill-friendly for existing local data.

DO $$ BEGIN CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'verified_15_plus', 'verified_18_plus'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('user', 'creator', 'moderator', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "VideoStatus" AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "StorageProvider" AS ENUM ('aws_s3'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "QuickChatCategory" AS ENUM ('reaction', 'question', 'feedback', 'praise', 'humor'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ReportTargetType" AS ENUM ('video', 'audio', 'user', 'quick_chat'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "generatedAvatarSeed" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "generatedAvatarVariant" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationProvider" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'unverified';

ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "s3Key" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "cloudfrontUrl" TEXT;
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "status" "VideoStatus" NOT NULL DEFAULT 'approved';
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "storageProvider" "StorageProvider" NOT NULL DEFAULT 'aws_s3';
UPDATE "Video" SET "title" = COALESCE("title", "caption"), "approvedAt" = COALESCE("approvedAt", "createdAt") WHERE "status" = 'approved';

CREATE TABLE IF NOT EXISTS "QuickChatPhrase" ("id" TEXT NOT NULL PRIMARY KEY, "phraseText" TEXT NOT NULL UNIQUE, "category" "QuickChatCategory" NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "QuickChatSuggestion" ("id" TEXT NOT NULL PRIMARY KEY, "phraseText" TEXT NOT NULL, "normalized" TEXT NOT NULL UNIQUE, "category" "QuickChatCategory" NOT NULL, "submittedBy" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "status" "ModerationStatus" NOT NULL DEFAULT 'pending', "reviewedBy" TEXT REFERENCES "User"("id"), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3));
CREATE TABLE IF NOT EXISTS "AudioSubmission" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "s3Key" TEXT NOT NULL, "storageProvider" "StorageProvider" NOT NULL DEFAULT 'aws_s3', "submittedBy" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "status" "ModerationStatus" NOT NULL DEFAULT 'pending', "reviewedBy" TEXT REFERENCES "User"("id"), "rejectionReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3));
CREATE TABLE IF NOT EXISTS "Report" ("id" TEXT NOT NULL PRIMARY KEY, "targetType" "ReportTargetType" NOT NULL, "targetId" TEXT NOT NULL, "reason" TEXT NOT NULL, "reportedBy" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "status" "ModerationStatus" NOT NULL DEFAULT 'pending', "reviewedBy" TEXT REFERENCES "User"("id"), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3));
CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL REFERENCES "User"("id"), "action" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);

INSERT INTO "QuickChatPhrase" ("id", "phraseText", "category") VALUES
('qc_bruh','bruh 💀','humor'),('qc_w','W','reaction'),('qc_huge_w','huge W','praise'),('qc_lowkey_fire','lowkey fire','praise'),('qc_tutorial','tutorial?','question'),('qc_part_2','part 2 when?','question'),('qc_helped','this helped fr','feedback'),('qc_wild','nah that''s wild','reaction')
ON CONFLICT ("phraseText") DO NOTHING;
