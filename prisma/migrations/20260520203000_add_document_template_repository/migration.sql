-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "defaultFilenameSuffix" TEXT,
    "generationEndpoint" TEXT,
    "outputFormat" TEXT NOT NULL DEFAULT 'docx',
    "sourceOfTruth" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "editableInRepository" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bodyFormat" TEXT NOT NULL DEFAULT 'docx-template',
    "storageKind" TEXT NOT NULL DEFAULT 'metadata-only',
    "contentText" TEXT,
    "contentJson" JSONB,
    "mergeFieldSet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateMergeField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "exampleValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateMergeField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_key_key" ON "DocumentTemplate"("key");

-- CreateIndex
CREATE INDEX "DocumentTemplate_category_idx" ON "DocumentTemplate"("category");

-- CreateIndex
CREATE INDEX "DocumentTemplate_enabled_idx" ON "DocumentTemplate"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_versionNumber_key" ON "DocumentTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_templateId_idx" ON "DocumentTemplateVersion"("templateId");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_status_idx" ON "DocumentTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateMergeField_templateId_key_key" ON "DocumentTemplateMergeField"("templateId", "key");

-- CreateIndex
CREATE INDEX "DocumentTemplateMergeField_templateId_idx" ON "DocumentTemplateMergeField"("templateId");

-- CreateIndex
CREATE INDEX "DocumentTemplateMergeField_source_idx" ON "DocumentTemplateMergeField"("source");

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateMergeField" ADD CONSTRAINT "DocumentTemplateMergeField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
