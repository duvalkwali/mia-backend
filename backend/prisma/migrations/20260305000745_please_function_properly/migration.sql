-- AddForeignKey
ALTER TABLE "generated_replies" ADD CONSTRAINT "generated_replies_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
