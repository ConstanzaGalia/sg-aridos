'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clients, jobs, payments, quoteItems, quotes, trips, worksites } from '@/lib/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function listWorksites(clientId?: number) {
  const userId = await getUserId()
  const condition = clientId
    ? and(eq(worksites.userId, userId), eq(worksites.clientId, clientId))
    : eq(worksites.userId, userId)

  return db
    .select({
      id: worksites.id,
      name: worksites.name,
      legalName: worksites.legalName,
      address: worksites.address,
      status: worksites.status,
      clientId: worksites.clientId,
      clientName: clients.name,
    })
    .from(worksites)
    .leftJoin(clients, eq(worksites.clientId, clients.id))
    .where(condition)
    .orderBy(desc(worksites.createdAt))
}

export async function createWorksite(input: { clientId: number; name: string; legalName?: string; address?: string; notes?: string }) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name || !input.clientId) throw new Error('La obra y el cliente son obligatorios')
  await db.insert(worksites).values({
    userId,
    clientId: input.clientId,
    name,
    legalName: input.legalName?.trim() || null,
    address: input.address?.trim(),
    notes: input.notes?.trim(),
  })
  revalidatePath('/obras')
  revalidatePath(`/clientes/${input.clientId}`)
}

export async function updateWorksite(input: { id: number; name: string; legalName?: string; address?: string; notes?: string; status?: string }) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  const [ws] = await db.select({ clientId: worksites.clientId }).from(worksites).where(and(eq(worksites.id, input.id), eq(worksites.userId, userId)))
  if (!ws) throw new Error('Obra no encontrada')
  await db
    .update(worksites)
    .set({
      name,
      ...(input.legalName !== undefined ? { legalName: input.legalName.trim() || null } : {}),
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status?.trim() || 'active',
      updatedAt: new Date(),
    })
    .where(and(eq(worksites.id, input.id), eq(worksites.userId, userId)))
  revalidatePath('/obras')
  revalidatePath(`/clientes/${ws.clientId}`)
}

export async function deleteWorksite(id: number) {
  const userId = await getUserId()
  const [ws] = await db.select({ clientId: worksites.clientId }).from(worksites).where(and(eq(worksites.id, id), eq(worksites.userId, userId)))
  if (!ws) throw new Error('Obra no encontrada')
  const [quote] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.worksiteId, id), eq(quotes.userId, userId)))
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.worksiteId, id), eq(jobs.userId, userId)))
  if (quote || job) throw new Error('No se puede eliminar: la obra tiene cotizaciones o trabajos.')
  await db.delete(worksites).where(and(eq(worksites.id, id), eq(worksites.userId, userId)))
  revalidatePath('/obras')
  revalidatePath(`/clientes/${ws.clientId}`)
}

export async function listJobs() {
  const userId = await getUserId()
  const rows = await db
    .select({
      id: jobs.id,
      type: jobs.type,
      status: jobs.status,
      amount: jobs.amount,
      paidAmount: jobs.paidAmount,
      paymentStatus: jobs.paymentStatus,
      scheduledAt: jobs.scheduledAt,
      clientId: jobs.clientId,
      clientName: clients.name,
      worksiteName: worksites.name,
      quoteId: jobs.quoteId,
      notes: jobs.notes,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(worksites, eq(jobs.worksiteId, worksites.id))
    .where(eq(jobs.userId, userId))
    .orderBy(desc(jobs.createdAt))

  const quoteIds = [...new Set(rows.map((row) => row.quoteId).filter((id): id is number => id != null))]
  const itemsByQuote = new Map<number, Array<{ description: string; quantity: string; unit: string; unitPrice: string; subtotal: string }>>()

  if (quoteIds.length) {
    const items = await db
      .select({
        quoteId: quoteItems.quoteId,
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unit: quoteItems.unit,
        unitPrice: quoteItems.unitPrice,
        subtotal: quoteItems.subtotal,
      })
      .from(quoteItems)
      .where(and(eq(quoteItems.userId, userId), inArray(quoteItems.quoteId, quoteIds)))

    for (const item of items) {
      const list = itemsByQuote.get(item.quoteId) ?? []
      list.push({
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit,
        unitPrice: String(item.unitPrice),
        subtotal: String(item.subtotal),
      })
      itemsByQuote.set(item.quoteId, list)
    }
  }

  return rows.map((row) => ({
    ...row,
    deliveryItems: row.quoteId ? (itemsByQuote.get(row.quoteId) ?? []) : [],
  }))
}

export async function createJob(input: {
  clientId: number
  worksiteId?: number
  type: string
  amount: string
  scheduledAt?: string
  notes?: string
}) {
  const userId = await getUserId()
  if (!input.clientId || !input.type.trim()) throw new Error('Cliente y tipo de trabajo son obligatorios')
  await db.insert(jobs).values({
    userId,
    clientId: input.clientId,
    worksiteId: input.worksiteId,
    type: input.type.trim(),
    amount: input.amount || '0',
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
    notes: input.notes?.trim(),
  })
  revalidatePath('/trabajos')
}

export async function updateJob(input: {
  id: number
  clientId: number
  worksiteId?: number
  type: string
  amount: string
  status?: string
  scheduledAt?: string
  notes?: string
}) {
  const userId = await getUserId()
  if (!input.clientId || !input.type.trim()) throw new Error('Cliente y tipo son obligatorios')
  await db
    .update(jobs)
    .set({
      clientId: input.clientId,
      worksiteId: input.worksiteId,
      type: input.type.trim(),
      amount: input.amount || '0',
      status: input.status?.trim() || 'pending',
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, input.id), eq(jobs.userId, userId)))
  revalidatePath('/trabajos')
  revalidatePath('/finanzas')
  revalidatePath('/')
}

export async function deleteJob(id: number) {
  const userId = await getUserId()
  const [job] = await db.select({ clientId: jobs.clientId, quoteId: jobs.quoteId }).from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
  if (!job) throw new Error('Trabajo no encontrado')
  await db.delete(trips).where(and(eq(trips.jobId, id), eq(trips.userId, userId)))
  await db.delete(payments).where(and(eq(payments.jobId, id), eq(payments.userId, userId)))
  await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
  if (job.quoteId) {
    await db.update(quotes).set({ status: 'sent', updatedAt: new Date() }).where(and(eq(quotes.id, job.quoteId), eq(quotes.userId, userId)))
  }
  revalidatePath('/trabajos')
  revalidatePath('/finanzas')
  revalidatePath('/cotizaciones')
  revalidatePath(`/clientes/${job.clientId}`)
}
