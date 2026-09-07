CREATE TABLE "AlarmRecipient" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlarmRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlarmRecipient_email_key" ON "AlarmRecipient"("email");