-- Phase 3: outbound webhook subscriptions and deliveries.

CREATE TABLE "WebhookSubscription" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "events" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
    "id" SERIAL NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "responseStatus" INTEGER,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookSubscription_isActive_idx" ON "WebhookSubscription"("isActive");
CREATE UNIQUE INDEX "WebhookDelivery_dedupeKey_key" ON "WebhookDelivery"("dedupeKey");
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "WebhookDelivery_subscriptionId_createdAt_idx" ON "WebhookDelivery"("subscriptionId", "createdAt");

ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
