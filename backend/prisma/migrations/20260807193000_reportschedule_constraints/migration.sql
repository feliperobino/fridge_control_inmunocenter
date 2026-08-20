-- Make ReportSchedule match the Phase 1 schema requirements
ALTER TABLE "ReportSchedule" DROP CONSTRAINT "ReportSchedule_createdById_fkey";

ALTER TABLE "ReportSchedule" ALTER COLUMN "recipients" SET NOT NULL;
ALTER TABLE "ReportSchedule" ALTER COLUMN "fridgeIds" SET NOT NULL;
ALTER TABLE "ReportSchedule" ALTER COLUMN "createdById" SET NOT NULL;

ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;