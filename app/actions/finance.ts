'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clients, expenses, jobs, payments, quoteItems, worksites } from '@/lib/db/schema'
import { syncJobPaymentTotals } from '@/lib/job-payments'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

type DeliveryLine = { description: string; quantity: string; unit: string; subtotal: string }

async function loadDeliveryItemsByQuote(userId: string, quoteIds: number[]) {
  const map = new Map<number, DeliveryLine[]>()
  if (!quoteIds.length) return map

  const items = await db
    .select({
      quoteId: quoteItems.quoteId,
      description: quoteItems.description,
      quantity: quoteItems.quantity,
      unit: quoteItems.unit,
      subtotal: quoteItems.subtotal,
    })
    .from(quoteItems)
    .where(and(eq(quoteItems.userId, userId), inArray(quoteItems.quoteId, quoteIds)))

  for (const item of items) {
    const list = map.get(item.quoteId) ?? []
    list.push({
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      subtotal: String(item.subtotal),
    })
    map.set(item.quoteId, list)
  }
  return map
}

export async function recordPayment(input: {
  jobId: number
  amount: string
  method?: string
  notes?: string
  paidAt?: string
}) {
  const userId = await getUserId()
  const amount = Number(input.amount)
  if (!input.jobId || !Number.isFinite(amount) || amount <= 0) throw new Error('Monto de pago inválido')

  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, userId)))
  if (!job) throw new Error('Trabajo no encontrado')

  await db.insert(payments).values({
    userId,
    jobId: input.jobId,
    amount: String(amount),
    method: input.method?.trim() || 'transfer',
    notes: input.notes?.trim(),
    paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
  })

  await syncJobPaymentTotals(userId, input.jobId)
  revalidatePath('/trabajos')
  revalidatePath('/finanzas')
  revalidatePath('/')
  revalidatePath(`/clientes/${job.clientId}`)
}

export async function listPaymentsForJob(jobId: number) {
  const userId = await getUserId()
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.jobId, jobId), eq(payments.userId, userId)))
    .orderBy(desc(payments.paidAt))
}

export async function createExpense(input: {
  description: string
  amount: string
  category?: string
  jobId?: number
  worksiteId?: number
  expenseDate?: string
}) {
  const userId = await getUserId()
  const amount = Number(input.amount)
  const description = input.description.trim()
  if (!description || !Number.isFinite(amount) || amount <= 0) throw new Error('Descripción y monto son obligatorios')

  await db.insert(expenses).values({
    userId,
    description,
    amount: String(amount),
    category: input.category?.trim() || 'other',
    jobId: input.jobId,
    worksiteId: input.worksiteId,
    expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
  })

  revalidatePath('/finanzas')
  revalidatePath('/')
}

export async function listExpenses(limit = 50) {
  const userId = await getUserId()
  return db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      category: expenses.category,
      expenseDate: expenses.expenseDate,
      jobId: expenses.jobId,
      worksiteName: worksites.name,
    })
    .from(expenses)
    .leftJoin(worksites, eq(expenses.worksiteId, worksites.id))
    .where(eq(expenses.userId, userId))
    .orderBy(desc(expenses.expenseDate))
    .limit(limit)
}

export async function listAccountsReceivable() {
  const userId = await getUserId()
  const rows = await db
    .select({
      jobId: jobs.id,
      clientId: jobs.clientId,
      clientName: clients.name,
      worksiteName: worksites.name,
      type: jobs.type,
      quoteId: jobs.quoteId,
      amount: jobs.amount,
      paidAmount: jobs.paidAmount,
      paymentStatus: jobs.paymentStatus,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(worksites, eq(jobs.worksiteId, worksites.id))
    .where(eq(jobs.userId, userId))
    .orderBy(desc(jobs.createdAt))

  const quoteIds = [...new Set(rows.map((r) => r.quoteId).filter((id): id is number => id != null))]
  const deliveryByQuote = await loadDeliveryItemsByQuote(userId, quoteIds)

  return rows
    .map((row) => {
      const total = Number(row.amount ?? 0)
      const paid = Number(row.paidAmount ?? 0)
      const balance = Math.max(0, total - paid)
      return {
        ...row,
        balance: String(balance),
        deliveryItems: row.quoteId ? (deliveryByQuote.get(row.quoteId) ?? []) : [],
      }
    })
    .filter((row) => Number(row.balance) > 0.009)
}

export async function listPaymentHistory(limit = 80) {
  const userId = await getUserId()
  const rows = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      notes: payments.notes,
      paidAt: payments.paidAt,
      jobId: jobs.id,
      jobType: jobs.type,
      quoteId: jobs.quoteId,
      jobAmount: jobs.amount,
      jobPaidAmount: jobs.paidAmount,
      clientName: clients.name,
      worksiteName: worksites.name,
    })
    .from(payments)
    .innerJoin(jobs, eq(payments.jobId, jobs.id))
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(worksites, eq(jobs.worksiteId, worksites.id))
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.paidAt))
    .limit(limit)

  const quoteIds = [...new Set(rows.map((r) => r.quoteId).filter((id): id is number => id != null))]
  const deliveryByQuote = await loadDeliveryItemsByQuote(userId, quoteIds)

  return rows.map((row) => ({
    ...row,
    deliveryItems: row.quoteId ? (deliveryByQuote.get(row.quoteId) ?? []) : [],
  }))
}

export async function getFinanceSummary(month?: string) {
  const userId = await getUserId()
  const now = month ? new Date(`${month}-01T12:00:00`) : new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [incomeRow, expenseRow, receivableRow] = await Promise.all([
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
        total: sql<string>`coalesce(sum(${jobs.amount}::numeric - ${jobs.paidAmount}::numeric), 0)`,
      })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), sql`${jobs.amount}::numeric > ${jobs.paidAmount}::numeric`)),
  ])

  const income = Number(incomeRow[0]?.total ?? 0)
  const expenseTotal = Number(expenseRow[0]?.total ?? 0)
  const receivable = Math.max(0, Number(receivableRow[0]?.total ?? 0))

  return {
    income: String(income),
    expenses: String(expenseTotal),
    net: String(income - expenseTotal),
    receivable: String(receivable),
    monthLabel: new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(start),
  }
}

export async function updateExpense(input: {
  id: number
  description: string
  amount: string
  category?: string
  expenseDate?: string
}) {
  const userId = await getUserId()
  const description = input.description.trim()
  const amount = Number(input.amount)
  if (!description || !Number.isFinite(amount) || amount <= 0) throw new Error('Descripción y monto son obligatorios')
  await db
    .update(expenses)
    .set({
      description,
      amount: String(amount),
      category: input.category?.trim() || 'other',
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
    })
    .where(and(eq(expenses.id, input.id), eq(expenses.userId, userId)))
  revalidatePath('/finanzas')
  revalidatePath('/')
}

export async function deleteExpense(id: number) {
  const userId = await getUserId()
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
  revalidatePath('/finanzas')
  revalidatePath('/')
}

export async function deletePayment(id: number) {
  const userId = await getUserId()
  const [payment] = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.userId, userId)))
  if (!payment) throw new Error('Cobro no encontrado')
  const [job] = await db.select({ clientId: jobs.clientId }).from(jobs).where(eq(jobs.id, payment.jobId))
  await db.delete(payments).where(and(eq(payments.id, id), eq(payments.userId, userId)))
  await syncJobPaymentTotals(userId, payment.jobId)
  revalidatePath('/trabajos')
  revalidatePath('/finanzas')
  revalidatePath('/')
  if (job) revalidatePath(`/clientes/${job.clientId}`)
}
