-- Staff tasks for authenticated follow-ups. Apply with `prisma migrate deploy`; not auto-applied.
CREATE TABLE IF NOT EXISTS "staff_tasks" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "staff_tasks_userId_status_idx" ON "staff_tasks"("userId", "status");
