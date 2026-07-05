-- CreateTable
CREATE TABLE "FiledDocument" (
    "id" TEXT NOT NULL,
    "matterId" INTEGER NOT NULL,
    "matterDisplayNumber" TEXT,
    "level" TEXT NOT NULL,
    "clioDocumentId" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "fileHash" TEXT,
    "folderKey" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "titleLabel" TEXT NOT NULL,
    "freehandTitle" TEXT,
    "fields" JSONB,
    "sourceType" TEXT NOT NULL DEFAULT 'upload',
    "ocrExtractionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiledDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiledDocument_matterId_idx" ON "FiledDocument"("matterId");

-- CreateIndex
CREATE INDEX "FiledDocument_matterDisplayNumber_idx" ON "FiledDocument"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "FiledDocument_folderKey_idx" ON "FiledDocument"("folderKey");

-- CreateIndex
CREATE INDEX "FiledDocument_clioDocumentId_idx" ON "FiledDocument"("clioDocumentId");

-- CreateIndex
CREATE INDEX "FiledDocument_fileHash_idx" ON "FiledDocument"("fileHash");

-- CreateIndex
CREATE INDEX "FiledDocument_status_idx" ON "FiledDocument"("status");
