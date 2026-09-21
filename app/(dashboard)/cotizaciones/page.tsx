'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  acceptQuote,
  addLineToQuote,
  createQuote,
  deleteLineFromQuote,
  deleteQuote,
  getQuoteWithItems,
  listCatalogForCrm,
  listClientsForCrm,
  listQuotes,
  updateQuote,
  updateQuoteLine,
  updateQuoteStatus,
} from '@/app/actions/crm'
import { listWorksites } from '@/app/actions/operations'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { ChevronDown, Download } from 'lucide-react'

type CatalogItem = { id: number; name: string; kind: string; pricingMode: string }
type Quote = {
  id: number
  status: string
  total: string
  createdAt: Date
  clientId: number
  clientName: string | null
  worksiteId: number | null
  worksiteName: string | null
}
type Worksite = { id: number; name: string; clientId: number }
type Line = {
  catalogItemId: string
  description: string
  quantity: string
  unitPrice: string
  unit: string
  distanceKm: string
  tons: string
  hours: string
}

const modes: Record<string, string> = { per_trip: 'camionada/viaje', tons_km: 'toneladas y km', hours: 'hora' }
const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
}

const emptyLine = (): Line => ({
  catalogItemId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  unit: 'viaje',
  distanceKm: '',
  tons: '',
  hours: '',
})

function QuotesPage() {
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<{ id: number; name: string; legalName: string | null }[]>([])
  const [worksites, setWorksites] = useState<Worksite[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clientId, setClientId] = useState('')
  const [worksiteId, setWorksiteId] = useState('')
  const [line, setLine] = useState<Line>(emptyLine())
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<Awaited<ReturnType<typeof getQuoteWithItems>> | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editLineId, setEditLineId] = useState<number | null>(null)
  const [editLineForm, setEditLineForm] = useState({ description: '', quantity: '1', unitPrice: '' })
  const [addLineOpen, setAddLineOpen] = useState(false)
  const [existingLine, setExistingLine] = useState<Line>(emptyLine())
  const [newQuoteOpen, setNewQuoteOpen] = useState(false)

  async function loadQuotes() {
    const q = await listQuotes()
    setQuotes(q as Quote[])
  }

  async function loadBase() {
    const [c, cat] = await Promise.all([listClientsForCrm(), listCatalogForCrm()])
    setClients(c)
    setCatalog(cat)
    await loadQuotes()
  }

  useEffect(() => {
    loadBase().catch(() => setError('Inicia sesión para usar el CRM.'))
  }, [])

  useEffect(() => {
    const preselect = searchParams.get('clientId')
    if (preselect) {
      setClientId(preselect)
      setNewQuoteOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (!clientId) {
      setWorksites([])
      setWorksiteId('')
      return
    }
    listWorksites(Number(clientId))
      .then((rows) => setWorksites(rows as Worksite[]))
      .catch(() => setWorksites([]))
    setWorksiteId('')
  }, [clientId])

  const draftTotal = useMemo(() => lines.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0), [lines])
  const clientWorksites = worksites.filter((w) => String(w.clientId) === clientId)

  function updateLine(key: keyof Line, value: string) {
    setLine((current) => ({ ...current, [key]: value }))
  }

  function onCatalogPick(id: string) {
    const item = catalog.find((c) => String(c.id) === id)
    updateLine('catalogItemId', id)
    if (item && !line.description) updateLine('description', item.name)
  }

  function addLine() {
    if (!line.catalogItemId || !line.description || !line.unitPrice) {
      return setError('Completa producto, descripción y precio de la línea.')
    }
    setLines((current) => [...current, line])
    setLine(emptyLine())
    setError('')
  }

  async function saveQuote() {
    if (!clientId || !worksiteId || !lines.length) {
      return setError('Selecciona cliente, obra y agrega al menos un producto.')
    }
    setSaving(true)
    try {
      const id = await createQuote({ clientId: Number(clientId), worksiteId: Number(worksiteId) })
      for (const item of lines) {
        await addLineToQuote({
          quoteId: id,
          catalogItemId: Number(item.catalogItemId),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit,
          distanceKm: item.distanceKm,
          tons: item.tons,
          hours: item.hours,
        })
      }
      setLines([])
      setClientId('')
      setWorksiteId('')
      await loadQuotes()
      setError('')
    } catch {
      setError('No se pudo guardar la cotización.')
    } finally {
      setSaving(false)
    }
  }

  async function openQuote(id: number) {
    const detail = await getQuoteWithItems(id)
    setSelectedQuoteId(id)
    setSelectedDetail(detail)
    setEditNotes(detail.quote.notes ?? '')
    setEditLineId(null)
    setAddLineOpen(false)
  }

  const quoteEditable =
    selectedDetail && (selectedDetail.quote.status === 'draft' || selectedDetail.quote.status === 'sent')

  async function saveQuoteMeta() {
    if (!selectedDetail) return
    try {
      await updateQuote({ id: selectedDetail.quote.id, notes: editNotes })
      await openQuote(selectedDetail.quote.id)
      await loadQuotes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  async function removeQuote() {
    if (!selectedDetail) return
    const status = selectedDetail.quote.status
    const message =
      status === 'accepted'
        ? 'Esta cotización está aceptada. Se eliminará también el trabajo generado y los cobros registrados. ¿Continuar?'
        : '¿Eliminar esta cotización?'
    if (!confirm(message)) return
    try {
      await deleteQuote(selectedDetail.quote.id)
      setSelectedDetail(null)
      setSelectedQuoteId(null)
      await loadQuotes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    }
  }

  async function removeLine(lineId: number) {
    if (!confirm('¿Eliminar esta línea?')) return
    try {
      await deleteLineFromQuote(lineId)
      if (selectedQuoteId) await openQuote(selectedQuoteId)
      await loadQuotes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la línea.')
    }
  }

  async function saveLineEdit() {
    if (!editLineId) return
    try {
      await updateQuoteLine({
        id: editLineId,
        description: editLineForm.description,
        quantity: editLineForm.quantity,
        unitPrice: editLineForm.unitPrice,
        unit: 'viaje',
      })
      setEditLineId(null)
      if (selectedQuoteId) await openQuote(selectedQuoteId)
      await loadQuotes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la línea.')
    }
  }

  async function addLineToExisting() {
    if (!selectedDetail || !existingLine.catalogItemId || !existingLine.description || !existingLine.unitPrice) {
      return setError('Completa producto, descripción y precio.')
    }
    try {
      await addLineToQuote({
        quoteId: selectedDetail.quote.id,
        catalogItemId: Number(existingLine.catalogItemId),
        description: existingLine.description,
        quantity: existingLine.quantity,
        unitPrice: existingLine.unitPrice,
        unit: existingLine.unit,
      })
      setExistingLine(emptyLine())
      setAddLineOpen(false)
      await openQuote(selectedDetail.quote.id)
      await loadQuotes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar la línea.')
    }
  }

  async function setStatus(id: number, status: 'draft' | 'sent' | 'accepted' | 'rejected') {
    try {
      if (status === 'accepted') await acceptQuote(id)
      else await updateQuoteStatus(id, status)
      await loadQuotes()
      if (selectedQuoteId === id) await openQuote(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el estado.')
    }
  }

  return (
    <div className="p-5 md:p-8">
      {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left lg:hidden"
              onClick={() => setNewQuoteOpen((open) => !open)}
              aria-expanded={newQuoteOpen}
            >
              <div className="min-w-0">
                <span className="block font-bold">Nueva cotización</span>
                {!newQuoteOpen && (lines.length > 0 || clientId) && (
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {lines.length > 0
                      ? `${lines.length} línea${lines.length === 1 ? '' : 's'} · ${formatMoney(draftTotal)}`
                      : 'Cliente u obra seleccionados'}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', newQuoteOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
            <h2 className="hidden font-bold lg:block">Nueva cotización</h2>
            <div className={cn(!newQuoteOpen && 'hidden lg:block')}>
            <label className="mt-4 flex flex-col gap-1 text-sm font-medium lg:mt-4">
              Cliente
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded-lg border border-slate-200 p-3 font-normal">
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.legalName ? ` · ${client.legalName}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Obra
              <select
                value={worksiteId}
                onChange={(e) => setWorksiteId(e.target.value)}
                disabled={!clientId}
                className="rounded-lg border border-slate-200 p-3 font-normal disabled:bg-slate-100"
              >
                <option value="">{clientId ? 'Seleccionar obra' : 'Elegí un cliente primero'}</option>
                {clientWorksites.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </label>
            {clientId && clientWorksites.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Este cliente no tiene obras.{' '}
                <a href={`/clientes/${clientId}`} className="underline">
                  Crear obra en la ficha
                </a>
              </p>
            )}
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">Agregar producto o servicio</p>
              <select value={line.catalogItemId} onChange={(e) => onCatalogPick(e.target.value)} className="mt-3 w-full rounded-lg border border-slate-200 p-3">
                <option value="">Seleccionar concepto</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {modes[item.pricingMode] ?? item.pricingMode}
                  </option>
                ))}
              </select>
              <input
                value={line.description}
                onChange={(e) => updateLine('description', e.target.value)}
                placeholder="Descripción de esta línea"
                className="mt-3 w-full rounded-lg border border-slate-200 p-3"
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input value={line.quantity} onChange={(e) => updateLine('quantity', e.target.value)} type="number" min="1" placeholder="Cantidad" className="rounded-lg border border-slate-200 p-3" />
                <input value={line.unitPrice} onChange={(e) => updateLine('unitPrice', e.target.value)} type="number" min="0" placeholder="Precio unitario" className="rounded-lg border border-slate-200 p-3" />
              </div>
              <button type="button" onClick={addLine} className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                Agregar a la cotización
              </button>
            </div>
            <button type="button" disabled={saving} onClick={saveQuote} className="mt-5 w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? 'Guardando...' : `Guardar cotización · ${formatMoney(draftTotal)}`}
            </button>
            </div>
          </section>
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold">Líneas del borrador</h2>
              {!lines.length ? (
                <p className="mt-5 text-sm text-slate-500">Agrega productos y servicios antes de guardar.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {lines.map((item, index) => (
                    <div key={`${item.catalogItemId}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-slate-500">
                          {item.quantity} × {formatMoney(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-bold">{formatMoney(Number(item.quantity) * Number(item.unitPrice))}</p>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-4 font-bold">
                    Total <span>{formatMoney(draftTotal)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold">Cotizaciones guardadas</h2>
              <div className="mt-4 space-y-2">
                {quotes.map((quote) => (
                  <div key={quote.id} className="rounded-lg border border-slate-100 p-3">
                    <button type="button" onClick={() => openQuote(quote.id)} className="flex w-full items-center justify-between text-left hover:text-amber-800">
                      <span>
                        <span className="block font-medium">{quote.clientName ?? 'Cliente'}</span>
                        <span className="text-xs text-slate-500">
                          #{quote.id} · {quote.worksiteName ?? 'Sin obra'} · {statusLabel[quote.status] ?? quote.status}
                        </span>
                      </span>
                      <strong>{formatMoney(quote.total)}</strong>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {selectedDetail && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-bold">Cotización #{selectedQuoteId}</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={`/api/quotes/${selectedDetail.quote.id}/pdf`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-amber-300 hover:text-amber-900"
                      download
                    >
                      <Download className="size-3.5" aria-hidden />
                      Descargar PDF
                    </a>
                    <button type="button" onClick={removeQuote} className="text-xs font-semibold text-red-600 hover:underline">
                      Eliminar cotización
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedDetail.clientName} · {selectedDetail.worksiteName ?? 'Sin obra'} ·{' '}
                  {statusLabel[selectedDetail.quote.status] ?? selectedDetail.quote.status}
                </p>
                {quoteEditable && (
                  <label className="mt-4 block text-sm">
                    Notas
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2"
                    />
                    <button type="button" onClick={saveQuoteMeta} className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
                      Guardar notas
                    </button>
                  </label>
                )}
                <div className="mt-4 space-y-2">
                  {selectedDetail.items.map((item) =>
                    editLineId === item.id ? (
                      <div key={item.id} className="space-y-2 rounded-lg bg-white p-3 text-sm">
                        <input
                          value={editLineForm.description}
                          onChange={(e) => setEditLineForm((f) => ({ ...f, description: e.target.value }))}
                          className="w-full rounded border border-slate-200 p-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={editLineForm.quantity}
                            onChange={(e) => setEditLineForm((f) => ({ ...f, quantity: e.target.value }))}
                            className="rounded border border-slate-200 p-2"
                          />
                          <input
                            type="number"
                            value={editLineForm.unitPrice}
                            onChange={(e) => setEditLineForm((f) => ({ ...f, unitPrice: e.target.value }))}
                            className="rounded border border-slate-200 p-2"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={saveLineEdit} className="rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-white">
                            Guardar
                          </button>
                          <button type="button" onClick={() => setEditLineId(null)} className="text-xs text-slate-500">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
                        <span>{item.description}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formatMoney(item.subtotal)}</span>
                          {quoteEditable && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditLineId(item.id)
                                  setEditLineForm({
                                    description: item.description,
                                    quantity: String(item.quantity),
                                    unitPrice: String(item.unitPrice),
                                  })
                                }}
                                className="text-xs text-amber-700"
                              >
                                Editar
                              </button>
                              <button type="button" onClick={() => removeLine(item.id)} className="text-xs text-red-600">
                                Borrar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
                {quoteEditable && (
                  <div className="mt-3">
                    {!addLineOpen ? (
                      <button type="button" onClick={() => setAddLineOpen(true)} className="text-sm font-semibold text-amber-700">
                        + Agregar línea
                      </button>
                    ) : (
                      <div className="mt-2 rounded-lg bg-white p-3 text-sm">
                        <select
                          value={existingLine.catalogItemId}
                          onChange={(e) => {
                            const id = e.target.value
                            const cat = catalog.find((c) => String(c.id) === id)
                            setExistingLine((l) => ({ ...l, catalogItemId: id, description: cat?.name ?? l.description }))
                          }}
                          className="mb-2 w-full rounded border p-2"
                        >
                          <option value="">Concepto</option>
                          {catalog.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <input
                          value={existingLine.description}
                          onChange={(e) => setExistingLine((l) => ({ ...l, description: e.target.value }))}
                          placeholder="Descripción"
                          className="mb-2 w-full rounded border p-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={existingLine.quantity}
                            onChange={(e) => setExistingLine((l) => ({ ...l, quantity: e.target.value }))}
                            className="rounded border p-2"
                          />
                          <input
                            type="number"
                            value={existingLine.unitPrice}
                            onChange={(e) => setExistingLine((l) => ({ ...l, unitPrice: e.target.value }))}
                            className="rounded border p-2"
                          />
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={addLineToExisting} className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                            Agregar
                          </button>
                          <button type="button" onClick={() => setAddLineOpen(false)} className="text-xs text-slate-500">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-3 text-right font-bold">Total: {formatMoney(selectedDetail.quote.total)}</p>
                {selectedDetail.quote.status !== 'accepted' && selectedDetail.quote.status !== 'rejected' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedDetail.quote.status === 'draft' && (
                      <button type="button" onClick={() => setStatus(selectedDetail.quote.id, 'sent')} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">
                        Marcar enviada
                      </button>
                    )}
                    {selectedDetail.quote.status === 'sent' && (
                      <button type="button" onClick={() => setStatus(selectedDetail.quote.id, 'draft')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">
                        Volver a borrador
                      </button>
                    )}
                    <button type="button" onClick={() => setStatus(selectedDetail.quote.id, 'accepted')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                      Presupuesto aceptado → crear trabajo
                    </button>
                    <button type="button" onClick={() => setStatus(selectedDetail.quote.id, 'rejected')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">
                      Rechazar
                    </button>
                  </div>
                )}
                {selectedDetail.quote.status === 'accepted' && (
                  <a href="/trabajos" className="mt-4 inline-block text-sm font-semibold text-amber-700">
                    Ver trabajos generados →
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
    </div>
  )
}

export default function CotizacionesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Cargando cotizaciones...</div>}>
      <QuotesPage />
    </Suspense>
  )
}
