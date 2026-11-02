-- AlterTable
ALTER TABLE "Team"
  ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "maxRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Report"
  ADD COLUMN "closureReason" TEXT,
  ADD COLUMN "duplicateOfId" INTEGER;

-- CreateTable
CREATE TABLE "DuplicateCandidate" (
  "id" SERIAL NOT NULL,
  "reportId" INTEGER NOT NULL,
  "candidateId" INTEGER NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "distanceM" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFollower" (
  "id" SERIAL NOT NULL,
  "reportId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeRecord" (
  "id" SERIAL NOT NULL,
  "duplicateId" INTEGER NOT NULL,
  "canonicalId" INTEGER NOT NULL,
  "mergedById" INTEGER,
  "undoneById" INTEGER,
  "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MergeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentDecision" (
  "id" SERIAL NOT NULL,
  "reportId" INTEGER NOT NULL,
  "teamId" INTEGER,
  "mode" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "runnerUpScore" DOUBLE PRECISION,
  "reasons" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AssignmentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateCandidate_reportId_candidateId_key" ON "DuplicateCandidate"("reportId", "candidateId");
CREATE INDEX "DuplicateCandidate_reportId_status_idx" ON "DuplicateCandidate"("reportId", "status");
CREATE INDEX "DuplicateCandidate_candidateId_idx" ON "DuplicateCandidate"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportFollower_reportId_userId_key" ON "ReportFollower"("reportId", "userId");
CREATE INDEX "ReportFollower_userId_idx" ON "ReportFollower"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MergeRecord_duplicateId_key" ON "MergeRecord"("duplicateId");
CREATE INDEX "MergeRecord_canonicalId_idx" ON "MergeRecord"("canonicalId");
CREATE INDEX "MergeRecord_undoneAt_idx" ON "MergeRecord"("undoneAt");

-- CreateIndex
CREATE INDEX "AssignmentDecision_reportId_createdAt_idx" ON "AssignmentDecision"("reportId", "createdAt");
CREATE INDEX "AssignmentDecision_mode_createdAt_idx" ON "AssignmentDecision"("mode", "createdAt");

-- CreateIndex
CREATE INDEX "Report_duplicateOfId_idx" ON "Report"("duplicateOfId");
CREATE INDEX "Report_category_status_createdAt_idx" ON "Report"("category", "status", "createdAt");
CREATE INDEX "Report_latitude_longitude_idx" ON "Report"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFollower" ADD CONSTRAINT "ReportFollower_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportFollower" ADD CONSTRAINT "ReportFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRecord" ADD CONSTRAINT "MergeRecord_duplicateId_fkey" FOREIGN KEY ("duplicateId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MergeRecord" ADD CONSTRAINT "MergeRecord_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentDecision" ADD CONSTRAINT "AssignmentDecision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentDecision" ADD CONSTRAINT "AssignmentDecision_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
