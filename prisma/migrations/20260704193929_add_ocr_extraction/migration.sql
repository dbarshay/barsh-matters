-- CreateTable
CREATE TABLE "OcrExtraction" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'adhoc',
    "matterId" INTEGER,
    "matterDisplayNumber" TEXT,
    "clioDocumentId" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "fileHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "meanConfidence" DOUBLE PRECISION,
    "text" TEXT NOT NULL,
    "keyValues" JSONB NOT NULL,
    "tables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrExtraction_matterId_idx" ON "OcrExtraction"("matterId");

-- CreateIndex
CREATE INDEX "OcrExtraction_matterDisplayNumber_idx" ON "OcrExtraction"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "OcrExtraction_fileHash_idx" ON "OcrExtraction"("fileHash");

-- CreateIndex
CREATE INDEX "OcrExtraction_sourceType_idx" ON "OcrExtraction"("sourceType");

-- CreateIndex
CREATE INDEX "OcrExtraction_clioDocumentId_idx" ON "OcrExtraction"("clioDocumentId");
