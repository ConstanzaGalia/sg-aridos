'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { catalogItems, clients, jobs, payments, quoteItems, quotes, trips, worksites } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

async function recalcQuoteTotal(quoteId: number) {
  const items = await db.select({ subtotal: quoteItems.subtotal }).from(quoteItems).where(eq(quoteItems.quoteId, quoteId))
  const newTotal = items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0)
  await db.update(quotes).set({ total: String(newTotal), updatedAt: new Date() }).where(eq(quotes.id, quoteId))
}

async function getEditableQuote(userId: string, quoteId: number) {
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId)))
  if (!quote) throw new Error('Cotización no encontrada')
  if (quote.status === 'accepted' || quote.status === 'rejected') {
    throw new Error('No se puede editar una cotización aceptada o rechazada')
  }
  return quote
}

const products = ['Arena grillada', 'Arena lavada', 'Arena lavada extrafina', 'Ripio bruto fino', 'Ripio bruto fino lavado', 'Base estabilizada', 'Ripio bruto grueso', 'Rechazo', 'Piedra 1-3', 'Granza', 'Piedra bola', 'Trituración 1-3', 'Trituración 1 1/4', 'Balastro', 'Tierra relleno', 'Tierra negra']
const services = ['Fletes camión', 'Alquiler camión por horas', 'Alquiler máquina por horas']

export async function createCatalogItem(input: { name: string; kind: 'product' | 'service'; pricingMode: string }) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  await db.insert(catalogItems).values({ userId, name, kind: input.kind, pricingMode: input.pricingMode })
  revalidatePath('/catalogo')
}

export async function listCatalog() {
  const userId = await getUserId()
  return db.select().from(catalogItems).where(eq(catalogItems.userId, userId)).orderBy(catalogItems.kind, catalogItems.name)
}

export async function seedCatalog() {
  const userId = await getUserId()
  const existing = await db.select({ name: catalogItems.name }).from(catalogItems).where(eq(catalogItems.userId, userId))
  const names = new Set(existing.map((item) => item.name))
  const values = [...products.map((name) => ({ userId, name, kind: 'product', pricingMode: 'per_trip' })), ...services.map((name) => ({ userId, name, kind: 'service', pricingMode: name === 'Fletes camión' ? 'tons_km' : 'hours' }))].filter((item) => !names.has(item.name))
  if (values.length) await db.insert(catalogItems).values(values)
  revalidatePath('/catalogo')
}

export async function listQuotes(clientId?: number) {
  const userId = await getUserId()
  const conditions = clientId
    ? and(eq(quotes.userId, userId), eq(quotes.clientId, clientId))
    : eq(quotes.userId, userId)

  return db
    .select({
      id: quotes.id,
      status: quotes.status,
      total: quotes.total,
      createdAt: quotes.createdAt,
      clientId: quotes.clientId,
      clientName: clients.name,
      worksiteId: quotes.worksiteId,
      worksiteName: worksites.name,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(worksites, eq(quotes.worksiteId, worksites.id))
    .where(conditions)
    .orderBy(desc(quotes.createdAt))
}

export async function createQuote(input: { clientId: number; worksiteId: number; notes?: string }) {
  const userId = await getUserId()
  if (!input.clientId || !input.worksiteId) throw new Error('Cliente y obra son obligatorios')

  const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.userId, userId)))
  if (!client) throw new Error('Cliente no válido')

  const [worksite] = await db
    .select({ id: worksites.id })
    .from(worksites)
    .where(and(eq(worksites.id, input.worksiteId), eq(worksites.clientId, input.clientId), eq(worksites.userId, userId)))
  if (!worksite) throw new Error('Obra no válida para este cliente')

  const [quote] = await db
    .insert(quotes)
    .values({ userId, clientId: input.clientId, worksiteId: input.worksiteId, notes: input.notes?.trim(), total: '0' })
    .returning({ id: quotes.id })

  revalidatePath('/cotizaciones')
  revalidatePath(`/clientes/${input.clientId}`)
  return quote.id
}

export async function addLineToQuote(input: {
  quoteId: number
  catalogItemId: number
  description: string
  quantity: string
  unitPrice: string
  unit: string
  distanceKm?: string
  tons?: string
  hours?: string
  notes?: string
}) {
  const userId = await getUserId()
  const quantity = Number(input.quantity || 1)
  const unitPrice = Number(input.unitPrice || 0)
  if (!input.quoteId || !input.catalogItemId || !input.description.trim() || unitPrice < 0) throw new Error('Completa producto y precio')

  await getEditableQuote(userId, input.quoteId)
  const [catalogItem] = await db.select({ id: catalogItems.id }).from(catalogItems).where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.userId, userId)))
  if (!catalogItem) throw new Error('Elemento de catálogo no válido')

  const subtotal = quantity * unitPrice
  await db.insert(quoteItems).values({
    userId,
    quoteId: input.quoteId,
    catalogItemId: input.catalogItemId,
    description: input.description.trim(),
    quantity: String(quantity),
    unit: input.unit || 'viaje',
    unitPrice: String(unitPrice),
    subtotal: String(subtotal),
    distanceKm: input.distanceKm || undefined,
    tons: input.tons || undefined,
    hours: input.hours || undefined,
    notes: input.notes?.trim(),
  })

  await recalcQuoteTotal(input.quoteId)
  revalidatePath('/cotizaciones')
}

export async function getQuoteWithItems(id: number) {
  const userId = await getUserId()
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
  if (!quote) throw new Error('Cotización no encontrada')
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id))
  const [worksite] = quote.worksiteId
    ? await db
        .select({ name: worksites.name, legalName: worksites.legalName, address: worksites.address })
        .from(worksites)
        .where(eq(worksites.id, quote.worksiteId))
    : [undefined]
  const [client] = await db
    .select({
      name: clients.name,
      legalName: clients.legalName,
      email: clients.email,
      phone: clients.phone,
    })
    .from(clients)
    .where(eq(clients.id, quote.clientId))
  return {
    quote,
    items,
    worksiteName: worksite?.name ?? null,
    worksiteLegalName: worksite?.legalName ?? null,
    worksiteAddress: worksite?.address ?? null,
    clientName: client?.name ?? null,
    clientLegalName: client?.legalName ?? null,
    clientEmail: client?.email ?? null,
    clientPhone: client?.phone ?? null,
  }
}

export async function deleteLineFromQuote(id: number) {
  const userId = await getUserId()
  const [line] = await db.select({ quoteId: quoteItems.quoteId }).from(quoteItems).where(and(eq(quoteItems.id, id), eq(quoteItems.userId, userId)))
  if (!line) throw new Error('Línea no encontrada')
  await getEditableQuote(userId, line.quoteId)
  await db.delete(quoteItems).where(and(eq(quoteItems.id, id), eq(quoteItems.userId, userId)))
  await recalcQuoteTotal(line.quoteId)
  revalidatePath('/cotizaciones')
}

export async function updateQuote(input: { id: number; notes?: string; worksiteId?: number }) {
  const userId = await getUserId()
  const quote = await getEditableQuote(userId, input.id)

  let worksiteId = quote.worksiteId
  if (input.worksiteId !== undefined) {
    if (!input.worksiteId) throw new Error('La obra es obligatoria')
    const [worksite] = await db
      .select({ id: worksites.id })
      .from(worksites)
      .where(and(eq(worksites.id, input.worksiteId), eq(worksites.clientId, quote.clientId), eq(worksites.userId, userId)))
    if (!worksite) throw new Error('Obra no válida')
    worksiteId = input.worksiteId
  }

  await db
    .update(quotes)
    .set({
      notes: input.notes !== undefined ? input.notes.trim() || null : quote.notes,
      worksiteId,
      updatedAt: new Date(),
    })
    .where(and(eq(quotes.id, input.id), eq(quotes.userId, userId)))

  revalidatePath('/cotizaciones')
  revalidatePath(`/clientes/${quote.clientId}`)
}

export async function updateQuoteLine(input: {
  id: number
  description: string
  quantity: string
  unitPrice: string
  unit: string
  distanceKm?: string
  tons?: string
  hours?: string
  notes?: string
}) {
  const userId = await getUserId()
  const [existing] = await db.select().from(quoteItems).where(and(eq(quoteItems.id, input.id), eq(quoteItems.userId, userId)))
  if (!existing) throw new Error('Línea no encontrada')
  await getEditableQuote(userId, existing.quoteId)

  const quantity = Number(input.quantity || 1)
  const unitPrice = Number(input.unitPrice || 0)
  if (!input.description.trim() || unitPrice < 0) throw new Error('Descripción y precio son obligatorios')

  const subtotal = quantity * unitPrice
  await db
    .update(quoteItems)
    .set({
      description: input.description.trim(),
      quantity: String(quantity),
      unitPrice: String(unitPrice),
      unit: input.unit || 'viaje',
      subtotal: String(subtotal),
      distanceKm: input.distanceKm || null,
      tons: input.tons || null,
      hours: input.hours || null,
      notes: input.notes?.trim() || null,
    })
    .where(and(eq(quoteItems.id, input.id), eq(quoteItems.userId, userId)))

  await recalcQuoteTotal(existing.quoteId)
  revalidatePath('/cotizaciones')
}

export async function deleteQuote(id: number) {
  const userId = await getUserId()
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
  if (!quote) throw new Error('Cotización no encontrada')

  const linkedJobs = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.quoteId, id), eq(jobs.userId, userId)))
  for (const job of linkedJobs) {
    await db.delete(trips).where(and(eq(trips.jobId, job.id), eq(trips.userId, userId)))
    await db.delete(payments).where(and(eq(payments.jobId, job.id), eq(payments.userId, userId)))
    await db.delete(jobs).where(and(eq(jobs.id, job.id), eq(jobs.userId, userId)))
  }

  await db.delete(quoteItems).where(and(eq(quoteItems.quoteId, id), eq(quoteItems.userId, userId)))
  await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)))

  revalidatePath('/cotizaciones')
  revalidatePath('/trabajos')
  revalidatePath('/finanzas')
  revalidatePath('/')
  revalidatePath(`/clientes/${quote.clientId}`)
}

export async function updateQuoteStatus(id: number, status: 'draft' | 'sent' | 'accepted' | 'rejected') {
  const userId = await getUserId()
  if (status === 'accepted') {
    await acceptQuote(id)
    return
  }
  await db.update(quotes).set({ status, updatedAt: new Date() }).where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
  revalidatePath('/cotizaciones')
}

export async function acceptQuote(id: number) {
  const userId = await getUserId()
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)))
  if (!quote) throw new Error('Cotización no encontrada')
  if (quote.status === 'accepted') throw new Error('Esta cotización ya fue aceptada')

  const items = await db.select().from(quoteItems).where(and(eq(quoteItems.quoteId, id), eq(quoteItems.userId, userId)))
  if (!items.length) throw new Error('La cotización no tiene detalle')
  if (!quote.worksiteId) throw new Error('La cotización debe tener una obra asignada')

  const [existingJob] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.quoteId, id), eq(jobs.userId, userId)))
  if (existingJob) throw new Error('Ya existe un trabajo para esta cotización')

  const summary =
    items.length === 1
      ? items[0].description
      : `${items[0].description} (+${items.length - 1} ítem${items.length > 2 ? 's' : ''} más)`

  await db.update(quotes).set({ status: 'accepted', updatedAt: new Date() }).where(and(eq(quotes.id, id), eq(quotes.userId, userId)))

  await db.insert(jobs).values({
    userId,
    clientId: quote.clientId,
    worksiteId: quote.worksiteId,
    quoteId: quote.id,
    type: `Presupuesto #${quote.id}: ${summary}`,
    amount: quote.total,
    status: 'pending',
    paymentStatus: 'pending',
    notes: quote.notes ?? undefined,
  })

  revalidatePath('/cotizaciones')
  revalidatePath('/trabajos')
  revalidatePath('/')
  revalidatePath(`/clientes/${quote.clientId}`)
}

export async function listClientsForCrm() {
  const userId = await getUserId()
  return db
    .select({ id: clients.id, name: clients.name, legalName: clients.legalName })
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.status, 'active')))
    .orderBy(clients.name)
}

export async function listCatalogForCrm() {
  return listCatalog()
}

export async function updateCatalogItem(input: {
  id: number
  name: string
  kind: 'product' | 'service'
  pricingMode: string
  active?: boolean
}) {
  const userId = await getUserId()
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  await db
    .update(catalogItems)
    .set({
      name,
      kind: input.kind,
      pricingMode: input.pricingMode,
      active: input.active ?? true,
      updatedAt: new Date(),
    })
    .where(and(eq(catalogItems.id, input.id), eq(catalogItems.userId, userId)))
  revalidatePath('/catalogo')
}

export async function deleteCatalogItem(id: number) {
  const userId = await getUserId()
  await db.delete(catalogItems).where(and(eq(catalogItems.id, id), eq(catalogItems.userId, userId)))
  revalidatePath('/catalogo')
}
