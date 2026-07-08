-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "whatsappAccessToken" TEXT,
ADD COLUMN     "whatsappPhoneNumberId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_whatsappPhoneNumberId_key" ON "tenants"("whatsappPhoneNumberId");

