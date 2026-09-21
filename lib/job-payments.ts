import { db } from '@/lib/db'
import { jobs, payments } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'

export async function syncJobPaymentTotals(userId: string, jobId: number) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
  if (!job) return

  const [sumRow] = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(eq(payments.jobId, jobId), eq(payments.userId, userId)))

  const paid = Number(sumRow?.total ?? 0)
  const total = Number(job.amount ?? 0)
  let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending'
  if (paid <= 0) paymentStatus = 'pending'
  else if (paid + 0.009 < total) paymentStatus = 'partial'
  else paymentStatus = 'paid'

  await db
    .update(jobs)
    .set({
      paidAmount: String(paid),
      paymentStatus,
      paidAt: paymentStatus === 'paid' ? new Date() : job.paidAt,
      status:
        paymentStatus === 'paid'
          ? 'completed'
          : paymentStatus === 'partial' && job.status === 'pending'
            ? 'in_progress'
            : job.status,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
}
