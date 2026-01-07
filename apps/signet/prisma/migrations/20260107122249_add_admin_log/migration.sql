-- CreateTable
CREATE TABLE "AdminLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "keyName" TEXT,
    "appId" INTEGER,
    "appName" TEXT,
    "clientName" TEXT,
    "clientVersion" TEXT,
    "ipAddress" TEXT
);

-- CreateIndex
CREATE INDEX "AdminLog_timestamp_idx" ON "AdminLog"("timestamp");

-- CreateIndex
CREATE INDEX "AdminLog_eventType_idx" ON "AdminLog"("eventType");
