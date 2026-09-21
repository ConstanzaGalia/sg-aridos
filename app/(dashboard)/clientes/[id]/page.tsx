'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Building2, CircleDollarSign, Plus, X } from 'lucide-react'
import { getClientHub } from '@/app/actions/clients'
import { createWorksite, deleteWorksite, updateWorksite } from '@/app/actions/operations'
import { formatMoney } from '@/lib/money'

type Hub = Awaited<ReturnType<typeof getClientHub>>

export default function ClientDetailPage() {
  const params = useParams()
  const clientId = Number(params.id)
  const [hub, setHub] = useState<Hub | null>(null)
  const [error, setError] = useState('')
  const [openWorksite, setOpenWorksite] = useState(false)
  const [editWorksite, setEditWorksite] = useState<{ id: number; name: string; legalName: string | null; address: string | null } | null>(null)

  async function refresh() {
    setHub(await getClientHub(clientId))
  }

  useEffect(() => {
    if (!clientId) return
    refresh().catch(() => setError('No se pudo cargar la ficha del cliente.'))
  }, [clientId])

  async function submitWorksite(formData: FormData) {
    try {
      await createWorksite({
        clientId,
        name: String(formData.get('name') ?? ''),
        legalName: String(formData.get('legalName') ?? ''),
        address: String(formData.get('address') ?? ''),
      })
      await refresh()
      setOpenWorksite(false)
    } catch {
      setError('No se pudo crear la obra.')
    }
  }

  if (!hub && !error) {
    return <div className="p-10 text-slate-500">Cargando ficha...</div>
  }

  if (!hub) {
    return (
      <div className="p-10">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  const { client, worksites, quotes, jobs, totalOwed, totalQuoted } = hub

  return (
    <div className="space-y-6 p-5 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/clientes" className="text-sm text-slate-500 hover:text-amber-700">
            ← Volver a clientes
          </Link>
          <h2 className="mt-2 text-2xl font-bold">{client.name}</h2>
        </div>
        <Link href={`/cotizaciones?clientId=${client.id}`} className="rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
          Nueva cotización
        </Link>
      </div>
      <div className="space-y-6">
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Saldo pendiente</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatMoney(totalOwed)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">En cotización (borrador/enviada)</p>
            <p className="mt-1 text-2xl font-bold">{formatMoney(totalQuoted)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs text-slate-500">Obras activas</p>
            <p className="mt-1 text-2xl font-bold">{worksites.filter((w) => w.status === 'active').length}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Obras</h2>
            <button onClick={() => setOpenWorksite(true)} className="flex items-center gap-1 text-sm font-semibold text-amber-700">
              <Plus className="size-4" /> Nueva obra
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {worksites.map((ws) => (
              <article key={ws.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-amber-600" />
                    <p className="font-semibold">{ws.name}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setEditWorksite({ id: ws.id, name: ws.name, legalName: ws.legalName, address: ws.address })} className="text-amber-700">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('¿Eliminar obra?')) return
                        try {
                          await deleteWorksite(ws.id)
                          await refresh()
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
                        }
                      }}
                      className="text-red-600"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
                {ws.legalName && <p className="mt-1 text-xs text-slate-600">Facturación: {ws.legalName}</p>}
                <p className="mt-1 text-xs text-slate-500">{ws.address || 'Sin dirección'}</p>
              </article>
            ))}
            {worksites.length === 0 && <p className="text-sm text-slate-500">Sin obras. Creá una para poder cotizar.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold">Cotizaciones</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">#{q.id} · {q.worksiteName ?? 'Sin obra'}</p>
                  <p className="text-xs capitalize text-slate-500">{q.status}</p>
                </div>
                <span className="font-semibold">{formatMoney(q.total)}</span>
              </div>
            ))}
            {quotes.length === 0 && <p className="py-4 text-sm text-slate-500">Sin cotizaciones.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold">Trabajos y cobranza</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {jobs.map((job) => {
              const balance = Math.max(0, Number(job.amount) - Number(job.paidAmount))
              return (
                <div key={job.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{job.type}</p>
                    <p className="text-xs text-slate-500">
                      {job.worksiteName ?? 'Sin obra'} · {job.paymentStatus}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{formatMoney(job.amount)} total · pagado {formatMoney(job.paidAmount)}</p>
                    {balance > 0 && <p className="font-semibold text-red-600">Debe {formatMoney(balance)}</p>}
                  </div>
                </div>
              )
            })}
            {jobs.length === 0 && <p className="py-4 text-sm text-slate-500">Sin trabajos. Aceptá una cotización para generarlos.</p>}
          </div>
          <a href="/finanzas" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
            <CircleDollarSign className="size-4" /> Ver finanzas y registrar cobros
          </a>
        </section>

        {(client.phone || client.email || client.legalName) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            {client.legalName && <p>Razón social: {client.legalName}</p>}
            {client.phone && <p>Tel: {client.phone}</p>}
            {client.email && <p>Email: {client.email}</p>}
          </section>
        )}
      </div>

      {editWorksite && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form
            action={async (fd) => {
              try {
                await updateWorksite({
                  id: editWorksite.id,
                  name: String(fd.get('name') ?? ''),
                  legalName: String(fd.get('legalName') ?? ''),
                  address: String(fd.get('address') ?? ''),
                })
                await refresh()
                setEditWorksite(null)
              } catch {
                setError('No se pudo actualizar la obra.')
              }
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold">Editar obra</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input name="name" required defaultValue={editWorksite.name} placeholder="Nombre / referencia" className="rounded-lg border px-3 py-2.5 text-sm" />
              <input name="legalName" defaultValue={editWorksite.legalName ?? ''} placeholder="Razón social para facturar" className="rounded-lg border px-3 py-2.5 text-sm" />
              <input name="address" defaultValue={editWorksite.address ?? ''} className="rounded-lg border px-3 py-2.5 text-sm" />
              <button className="rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {openWorksite && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form action={submitWorksite} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nueva obra</h2>
              <button type="button" onClick={() => setOpenWorksite(false)}>
                <X className="size-5 text-slate-400" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input name="name" required placeholder="Nombre / referencia de la obra" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="legalName" placeholder="Razón social para facturar (si difiere)" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="address" placeholder="Dirección" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <button className="mt-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white">Guardar obra</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
