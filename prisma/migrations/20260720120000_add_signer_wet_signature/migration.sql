-- Wet-signature capture for Admin User signer profiles (optional).
-- Stores an uploaded signature image as a base64 data URL on the AdminUser row,
-- surfaced through the {{signer.signatureImage}} document-generation token.
ALTER TABLE "AdminUser" ADD COLUMN "signatureImageDataUrl" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "signatureImageMimeType" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN "signatureImageUpdatedAt" TIMESTAMP(3);
