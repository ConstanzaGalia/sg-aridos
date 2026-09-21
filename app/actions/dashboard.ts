'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clients, expenses, jobs, payments, worksites } from '@/lib/db/schema'
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function getDashboardSummary() {
  const userId = await getUserId()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [clientCount, worksiteCount, jobStats, incomeMonth, expenseMonth, receivableRow, recentJobs] = await Promise.all([
    db.select({ value: count() }).from(clients).where(and(eq(clients.userId, userId), eq(clients.status, 'active'))),
    db.select({ value: count() }).from(worksites).where(and(eq(worksites.userId, userId), eq(worksites.status, 'active'))),
    db
      .select({
        pending: sql<number>`count(*) filter (where ${jobs.status} in ('pending', 'in_progress'))`,
        unpaid: sql<number>`count(*) filter (where ${jobs.paymentStatus} in ('pending', 'partial'))`,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId)),
    db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.userId, userId), gte(payments.paidAt, start), lte(payments.paidAt, end))),
    db
      .select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), gte(expenses.expenseDate, start), lte(expenses.expenseDate, end))),
    db
      .select({
        total: sql<string>`coalesce(sum(greatest(${jobs.amount}::numeric - ${jobs.paidAmount}::numeric, 0)), 0)`,
      })
      .from(jobs)
      .where(eq(jobs.userId, userId)),
    db
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        paymentStatus: jobs.paymentStatus,
        amount: jobs.amount,
        paidAmount: jobs.paidAmount,
        scheduledAt: jobs.scheduledAt,
        clientName: clients.name,
      })
      .from(jobs)
      .leftJoin(clients, eq(jobs.clientId, clients.id))
      .where(eq(jobs.userId, userId))
      .orderBy(desc(jobs.createdAt))
      .limit(5),
  ])

  const income = incomeMonth[0]?.total ?? '0'
  const expenseTotal = expenseMonth[0]?.total ?? '0'

  return {
    clients: clientCount[0]?.value ?? 0,
    worksites: worksiteCount[0]?.value ?? 0,
    jobs: jobStats[0]?.pending ?? 0,
    unpaidJobs: jobStats[0]?.unpaid ?? 0,
    revenue: income,
    expenses: expenseTotal,
    net: String(Number(income) - Number(expenseTotal)),
    receivable: receivableRow[0]?.total ?? '0',
    recentJobs,
  }
}
