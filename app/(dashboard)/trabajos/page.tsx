'use client'

import { useEffect, useState } from 'react'
import { BriefcaseBusiness, ChevronDown, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deletePayment, listPaymentsForJob, recordPayment } from '@/app/actions/finance'
import { createJob, deleteJob, listJobs, listWorksites, updateJob } from '@/app/actions/operations'
import { listClients } from '@/app/actions/clients'
import { formatMoney } from '@/lib/money'

type Client = { id: number; name: string }
type Job = Awaited<ReturnType<typeof listJobs>>[number]

const jobStatusLabel: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  completed: 'Completado',
}

const paymentStatusLabel: Record<string, string> = {
  pending: 'Sin cobrar',
  partial: 'Cobro parcial',
  paid: 'Cobrado',
}

function jobTitle(item: Job) {
  if (item.quoteId) return `Presupuesto #${item.quoteId}`
  return item.type.length > 60 ? `${item.type.slice(0, 60)}…` : item.type
}

export default function JobsPage() {
  const [items, setItems] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [worksites, setWorksites] = useState<{ id: number; name: string; clientId: number }[]>([])
  const [open, setOpen] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [payOpen, setPayOpen] = useState<number | null>(null)
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof listPaymentsForJob>>>([])
  const [error, setError] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [mobileJobOpen, setMobileJobOpen] = useState<Record<number, boolean>>({})

  async function refresh() {
    setItems(await listJobs())
    setClients((await listClients()) as Client[])
  }

  useEffect(() => {
    refresh().catch(() => setError('No se pudieron cargar los trabajos.'))
  }, [])

  useEffect(() => {
    if (!formClientId) {
      setWorksites([])
      return
    }
    listWorksites(Number(formClientId)).then((rows) => setWorksites(rows))
  }, [formClientId])

  async function submit(formData: FormData) {
    try {
      await createJob({
        clientId: Number(formData.get('clientId')),
        worksiteId: formData.get('worksiteId') ? Number(formData.get('worksiteId')) : undefined,
        type: String(formData.get('type') ?? ''),
        amount: String(formData.get('amount') ?? '0'),
        scheduledAt: String(formData.get('scheduledAt') ?? ''),
      })
      await refresh()
      setOpen(false)
    } catch {
      setError('Completa cliente y tipo de trabajo.')
    }
  }

  async function openPayments(jobId: number) {
    setPayOpen(jobId)
    setPayments(await listPaymentsForJob(jobId))
  }

  async function submitPayment(formData: FormData) {
    if (!payOpen) return
    try {
      await recordPayment({
        jobId: payOpen,
        amount: String(formData.get('amount') ?? ''),
        method: String(formData.get('method') ?? 'transfer'),
        notes: String(formData.get('notes') ?? ''),
      })
      await refresh()
      await openPayments(payOpen)
    } catch {
      setError('Monto de cobro inválido.')
    }
  }

  async function submitEdit(formData: FormData) {
    if (!editJob) return
    try {
      await updateJob({
        id: editJob.id,
        clientId: Number(formData.get('clientId')),
        worksiteId: formData.get('worksiteId') ? Number(formData.get('worksiteId')) : undefined,
        type: String(formData.get('type') ?? ''),
        amount: String(formData.get('amount') ?? '0'),
        status: String(formData.get('status') ?? editJob.status),
        scheduledAt: String(formData.get('scheduledAt') ?? ''),
        notes: String(formData.get('notes') ?? ''),
      })
      await refresh()
      setEditJob(null)
    } catch {
      setError('No se pudo actualizar el trabajo.')
    }
  }

  function toggleJobMobile(id: number) {
    setMobileJobOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function removeJob(job: Job) {
    if (!confirm('¿Eliminar este trabajo? Se borran los cobros asociados.')) return
    try {
      await deleteJob(job.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    }
  }

  return (
    <div className="p-5 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-600">Presupuestos aceptados y servicios</p>
          <h2 className="mt-1 text-2xl font-bold">Seguimiento y cobranza</h2>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white">
          <Plus className="size-4" />
          Nuevo trabajo
        </button>
      </div>
      <div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const balance = Math.max(0, Number(item.amount) - Number(item.paidAmount))
              const jobExpanded = !!mobileJobOpen[item.id]
              return (
                <div key={item.id} className="p-5">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left lg:hidden"
                    onClick={() => toggleJobMobile(item.id)}
                    aria-expanded={jobExpanded}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <BriefcaseBusiness className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{jobTitle(item)}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-600">
                          {item.clientName ?? 'Cliente'} · {item.worksiteName ?? 'Sin obra'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {jobStatusLabel[item.status] ?? item.status}
                          </span>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            {paymentStatusLabel[item.paymentStatus] ?? item.paymentStatus}
                          </span>
                        </div>
                        {!jobExpanded && (
                          <p className="mt-2 text-sm">
                            <span className="font-bold">{formatMoney(item.amount)}</span>
                            {balance > 0 && (
                              <span className="ml-2 font-semibold text-red-600">Debe {formatMoney(balance)}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn('mt-1 size-5 shrink-0 text-slate-500 transition-transform', jobExpanded && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                  <div className={cn(!jobExpanded && 'hidden lg:block', jobExpanded && 'mt-4 lg:mt-0')}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 lg:flex">
                        <BriefcaseBusiness className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="hidden lg:block">
                          <p className="font-semibold text-slate-900">{jobTitle(item)}</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {item.clientName ?? 'Cliente'} · {item.worksiteName ?? 'Sin obra'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              {jobStatusLabel[item.status] ?? item.status}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                              {paymentStatusLabel[item.paymentStatus] ?? item.paymentStatus}
                            </span>
                            {item.quoteId && (
                              <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">Cotización #{item.quoteId}</span>
                            )}
                          </div>
                        </div>
                        {item.quoteId && (
                          <span className="mb-2 inline-block rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500 lg:hidden">
                            Cotización #{item.quoteId}
                          </span>
                        )}

                        {item.deliveryItems.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Qué incluye este trabajo</p>
                            <ul className="mt-2 space-y-2">
                              {item.deliveryItems.map((line, index) => (
                                <li key={`${item.id}-line-${index}`} className="flex flex-col gap-1 border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="font-medium text-slate-800">{line.description}</span>
                                  <span className="shrink-0 text-slate-600">
                                    {line.quantity} {line.unit} × {formatMoney(line.unitPrice)}{' '}
                                    <span className="font-semibold text-slate-900">= {formatMoney(line.subtotal)}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">{item.type}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:shrink-0 lg:flex-col lg:items-end">
                      <div className="text-right text-sm">
                        <p className="font-bold">{formatMoney(item.amount)}</p>
                        <p className="text-slate-500">Pagado {formatMoney(item.paidAmount)}</p>
                        {balance > 0 && <p className="font-semibold text-red-600">Debe {formatMoney(balance)}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setEditJob(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">
                          Editar
                        </button>
                        <button type="button" onClick={() => openPayments(item.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:border-amber-300">
                          Cobros
                        </button>
                        <button type="button" onClick={() => removeJob(item)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
            {items.length === 0 && <div className="p-12 text-center text-sm text-slate-500">Todavía no hay trabajos registrados.</div>}
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form action={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nuevo trabajo</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="size-5 text-slate-400" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <select name="clientId" required value={formClientId} onChange={(e) => setFormClientId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="">Selecciona cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <select name="worksiteId" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="">Obra (opcional)</option>
                {worksites.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
              <input name="type" required placeholder="Transporte de áridos / maquinaria" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="amount" type="number" min="0" step="0.01" placeholder="Monto total" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="scheduledAt" type="datetime-local" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <button className="mt-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white">Guardar trabajo</button>
            </div>
          </form>
        </div>
      )}

      {editJob && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form action={submitEdit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar trabajo</h2>
              <button type="button" onClick={() => setEditJob(null)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <select name="clientId" required defaultValue={editJob.clientId} className="rounded-lg border px-3 py-2.5 text-sm">
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input name="type" required defaultValue={editJob.type} className="rounded-lg border px-3 py-2.5 text-sm" />
              <input name="amount" type="number" defaultValue={editJob.amount} className="rounded-lg border px-3 py-2.5 text-sm" />
              <select name="status" defaultValue={editJob.status} className="rounded-lg border px-3 py-2.5 text-sm">
                <option value="pending">Pendiente</option>
                <option value="in_progress">En curso</option>
                <option value="completed">Completado</option>
              </select>
              <textarea name="notes" placeholder="Notas" rows={2} className="rounded-lg border px-3 py-2.5 text-sm" />
              <button className="rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {payOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Cobros · trabajo #{payOpen}</h2>
              <button type="button" onClick={() => setPayOpen(null)}>
                <X className="size-5 text-slate-400" />
              </button>
            </div>
            <div className="mb-4 max-h-40 space-y-2 overflow-y-auto text-sm">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{new Date(p.paidAt).toLocaleDateString('es-AR')}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatMoney(p.amount)}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('¿Eliminar este cobro?')) return
                        await deletePayment(p.id)
                        await refresh()
                        if (payOpen) await openPayments(payOpen)
                      }}
                      className="text-xs text-red-600"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
              {payments.length === 0 && <p className="text-slate-500">Sin cobros registrados.</p>}
            </div>
            <form action={submitPayment} className="flex flex-col gap-3">
              <input name="amount" type="number" min="0" step="0.01" required placeholder="Monto" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <select name="method" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="check">Cheque</option>
              </select>
              <input name="notes" placeholder="Notas" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <button className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Registrar cobro</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
