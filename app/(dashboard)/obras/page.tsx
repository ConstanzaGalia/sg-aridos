'use client'

import { useEffect, useState } from 'react'
import { Building2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { createWorksite, deleteWorksite, listWorksites, updateWorksite } from '@/app/actions/operations'
import { listClients } from '@/app/actions/clients'

type Client = { id: number; name: string }
type Worksite = { id: number; name: string; address: string | null; clientName: string | null; status: string }

export default function WorksitesPage() {
  const [items, setItems] = useState<Worksite[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Worksite | null>(null)
  const [error, setError] = useState('')

  async function refresh() {
    setItems((await listWorksites()) as Worksite[])
    setClients((await listClients()) as Client[])
  }

  useEffect(() => {
    refresh().catch(() => setError('No se pudieron cargar las obras.'))
  }, [])

  async function submitCreate(formData: FormData) {
    try {
      await createWorksite({
        clientId: Number(formData.get('clientId')),
        name: String(formData.get('name') ?? ''),
        address: String(formData.get('address') ?? ''),
      })
      await refresh()
      setOpen(false)
    } catch {
      setError('Completa los datos de la obra.')
    }
  }

  async function submitEdit(formData: FormData) {
    if (!edit) return
    try {
      await updateWorksite({
        id: edit.id,
        name: String(formData.get('name') ?? ''),
        address: String(formData.get('address') ?? ''),
        status: String(formData.get('status') ?? 'active'),
      })
      await refresh()
      setEdit(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar.')
    }
  }

  async function remove(item: Worksite) {
    if (!confirm(`¿Eliminar obra "${item.name}"?`)) return
    try {
      await deleteWorksite(item.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    }
  }

  const filtered = items.filter((item) =>
    `${item.name} ${item.clientName ?? ''} ${item.address ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="p-5 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-600">Seguimiento de obras</p>
          <h2 className="mt-1 text-2xl font-bold">Tus obras</h2>
          <p className="mt-1 text-sm text-slate-500">Asocia cada obra a un cliente.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search className="size-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar obra..." className="w-full bg-transparent text-sm outline-none sm:w-48" />
          </label>
          <button onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus className="size-4" />
            Nueva obra
          </button>
        </div>
      </div>
      <div>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Building2 className="size-5" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEdit(item)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => remove(item)} className="rounded-md p-2 text-red-400 hover:bg-red-50">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <h3 className="mt-4 font-bold">{item.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.clientName ?? 'Cliente'}</p>
              <p className="mt-3 text-xs text-slate-400">{item.address || 'Sin dirección'} · {item.status}</p>
            </article>
          ))}
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form action={submitCreate} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Nueva obra</h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input name="name" required placeholder="Nombre de la obra" className="rounded-lg border px-3 py-2.5 text-sm" />
              <select name="clientId" required className="rounded-lg border px-3 py-2.5 text-sm">
                <option value="">Cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input name="address" placeholder="Dirección" className="rounded-lg border px-3 py-2.5 text-sm" />
              <button className="rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white">Guardar</button>
            </div>
          </form>
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form action={submitEdit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar obra</h2>
              <button type="button" onClick={() => setEdit(null)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input name="name" required defaultValue={edit.name} className="rounded-lg border px-3 py-2.5 text-sm" />
              <input name="address" defaultValue={edit.address ?? ''} className="rounded-lg border px-3 py-2.5 text-sm" />
              <select name="status" defaultValue={edit.status} className="rounded-lg border px-3 py-2.5 text-sm">
                <option value="active">Activa</option>
                <option value="archived">Archivada</option>
              </select>
              <button className="rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white">Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
