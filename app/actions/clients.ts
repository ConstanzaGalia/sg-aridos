'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clients, jobs, quotes, worksites } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function listClients() {
  const userId = await getUserId()
  return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt))
}

export async function createClient(input: { name: string; legalName?: string; phone?: string; email?: string; notes?: string }) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  await db.insert(clients).values({
    userId,
    name,
    legalName: input.legalName?.trim(),
    phone: input.phone?.trim(),
    email: input.email?.trim(),
    notes: input.notes?.trim(),
  })
  revalidatePath('/')
  revalidatePath('/clientes')
}

export async function archiveClient(id: number) {
  const userId = await getUserId()
  await db.update(clients).set({ status: 'archived', updatedAt: new Date() }).where(and(eq(clients.id, id), eq(clients.userId, userId)))
  revalidatePath('/')
  revalidatePath('/clientes')
}

export async function updateClient(input: {
  id: number
  name: string
  legalName?: string
  phone?: string
  email?: string
  notes?: string
}) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  await db
    .update(clients)
    .set({
      name,
      legalName: input.legalName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, input.id), eq(clients.userId, userId)))
  revalidatePath('/clientes')
  revalidatePath(`/clientes/${input.id}`)
}

export async function deleteClient(id: number) {
  const userId = await getUserId()
  const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)))
  if (!client) throw new Error('Cliente no encontrado')

  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.clientId, id), eq(jobs.userId, userId)))
  const [quote] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.clientId, id), eq(quotes.userId, userId)))
  if (job || quote) throw new Error('No se puede eliminar: tiene cotizaciones o trabajos. Archivalo en su lugar.')

  await db.delete(worksites).where(and(eq(worksites.clientId, id), eq(worksites.userId, userId)))
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)))
  revalidatePath('/clientes')
}

export async function getClientHub(clientId: number) {
  const userId = await getUserId()
  const [client] = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
  if (!client) throw new Error('Cliente no encontrado')

  const [clientWorksites, clientQuotes, clientJobs] = await Promise.all([
    db.select().from(worksites).where(and(eq(worksites.clientId, clientId), eq(worksites.userId, userId))).orderBy(desc(worksites.createdAt)),
    db
      .select({
        id: quotes.id,
        status: quotes.status,
        total: quotes.total,
        createdAt: quotes.createdAt,
        worksiteId: quotes.worksiteId,
        worksiteName: worksites.name,
      })
      .from(quotes)
      .leftJoin(worksites, eq(quotes.worksiteId, worksites.id))
      .where(and(eq(quotes.clientId, clientId), eq(quotes.userId, userId)))
      .orderBy(desc(quotes.createdAt)),
    db
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        amount: jobs.amount,
        paidAmount: jobs.paidAmount,
        paymentStatus: jobs.paymentStatus,
        worksiteName: worksites.name,
        quoteId: jobs.quoteId,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .leftJoin(worksites, eq(jobs.worksiteId, worksites.id))
      .where(and(eq(jobs.clientId, clientId), eq(jobs.userId, userId)))
      .orderBy(desc(jobs.createdAt)),
  ])

  let totalOwed = 0
  let totalQuoted = 0
  for (const job of clientJobs) {
    totalOwed += Math.max(0, Number(job.amount) - Number(job.paidAmount))
  }
  for (const quote of clientQuotes) {
    if (quote.status === 'sent' || quote.status === 'draft') totalQuoted += Number(quote.total)
  }

  return {
    client,
    worksites: clientWorksites,
    quotes: clientQuotes,
    jobs: clientJobs,
    totalOwed: String(totalOwed),
    totalQuoted: String(totalQuoted),
  }
}
