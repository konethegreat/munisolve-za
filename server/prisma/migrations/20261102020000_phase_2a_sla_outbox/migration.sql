SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "responseMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" SERIAL NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reportId" INTEGER,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "responseDueAt" TIMESTAMP(3),
ADD COLUMN     "resolutionDueAt" TIMESTAMP(3),
ADD COLUMN     "slaCycleStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_category_key" ON "SlaPolicy"("category");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_nextAttemptAt_idx" ON "NotificationOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_reportId_idx" ON "NotificationOutbox"("reportId");

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the default policies once. Changing a target later is a new migration.
INSERT INTO "SlaPolicy" ("category", "responseMinutes", "resolutionMinutes", "isActive", "createdAt", "updatedAt") VALUES
    ('ELECTRICITY_OUTAGE', 120, 4320, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WATER_LEAK', 240, 4320, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('SEWAGE', 480, 4320, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('TRAFFIC_LIGHT', 480, 14400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('REFUSE_COLLECTION', 1440, 7200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('POTHOLE', 2880, 43200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('STREETLIGHT', 2880, 30240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ILLEGAL_DUMPING', 2880, 10080, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('GRAFFITI', 4320, 20160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PARK_MAINTENANCE', 4320, 20160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('OTHER', 4320, 20160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("category") DO NOTHING;

-- Backfill existing reports from their category policy.
UPDATE "Report" AS r
SET "responseDueAt" = COALESCE(r."responseDueAt", r."createdAt" + make_interval(mins => p."responseMinutes")),
    "resolutionDueAt" = COALESCE(r."resolutionDueAt", r."createdAt" + make_interval(mins => p."resolutionMinutes")),
    "slaCycleStartedAt" = COALESCE(r."slaCycleStartedAt", r."createdAt")
FROM "SlaPolicy" AS p
WHERE p."category" = r."category";

-- Rows whose category has no policy still need a window: 72 h response, 14 days resolution.
UPDATE "Report"
SET "responseDueAt" = COALESCE("responseDueAt", "createdAt" + INTERVAL '72 hours'),
    "resolutionDueAt" = COALESCE("resolutionDueAt", "createdAt" + INTERVAL '336 hours'),
    "slaCycleStartedAt" = COALESCE("slaCycleStartedAt", "createdAt")
WHERE "responseDueAt" IS NULL OR "resolutionDueAt" IS NULL OR "slaCycleStartedAt" IS NULL;
