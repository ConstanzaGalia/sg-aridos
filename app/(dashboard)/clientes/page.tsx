'use client'

import { useEffect, useState } from 'react'
import { Archive, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { archiveClient, createClient, deleteClient, listClients, updateClient } from '@/app/actions/clients'

type Client = { id: number; name: string; legalName: string | null; phone: string | null; email: string | null; notes: string | null; status: string; createdAt: Date }

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Client | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setClients((await listClients()) as Client[])
  }

  useEffect(() => {
    refresh().catch(() => setError('No se pudieron cargar los clientes.'))
  }, [])

  const filtered = clients.filter((client) =>
    `${client.name} ${client.legalName ?? ''} ${client.email ?? ''} ${client.phone ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  )

  async function submitCreate(formData: FormData) {
    setBusy(true)
    setError('')
    try {
      await createClient({
        name: String(formData.get('name') ?? ''),
        legalName: String(formData.get('legalName') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        email: String(formData.get('email') ?? ''),
        notes: String(formData.get('notes') ?? ''),
      })
      await refresh()
      setOpen(false)
    } catch {
      setError('Revisa el nombre o razón social e inténtalo nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit(formData: FormData) {
    if (!edit) return
    setBusy(true)
    setError('')
    try {
      await updateClient({
        id: edit.id,
        name: String(formData.get('name') ?? ''),
        legalName: String(formData.get('legalName') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        email: String(formData.get('email') ?? ''),
        notes: String(formData.get('notes') ?? ''),
      })
      await refresh()
      setEdit(null)
    } catch {
      setError('No se pudo actualizar el cliente.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(client: Client) {
    if (!confirm(`¿Eliminar a ${client.name}? Solo si no tiene cotizaciones ni trabajos.`)) return
    try {
      await deleteClient(client.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    }
  }

  function ClientForm({ onSubmit, initial, title }: { onSubmit: (fd: FormData) => void; initial?: Client; title: string }) {
    return (
      <form
        action={onSubmit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={() => (initial ? setEdit(null) : setOpen(false))} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Nombre o contacto
            <input name="name" required defaultValue={initial?.name} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Razón social
            <input name="legalName" defaultValue={initial?.legalName ?? ''} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Teléfono
              <input name="phone" defaultValue={initial?.phone ?? ''} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Email
              <input name="email" type="email" defaultValue={initial?.email ?? ''} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Notas
            <textarea name="notes" defaultValue={initial?.notes ?? ''} rows={2} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal" />
          </label>
          <button disabled={busy} className="rounded-lg bg-amber-500 px-4 py-3 font-semibold text-white disabled:opacity-60">
            {busy ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="p-5 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-600">Directorio comercial</p>
          <h2 className="mt-1 text-2xl font-bold">Tus clientes</h2>
          <p className="mt-1 text-sm text-slate-500">Registra contacto y razón social por separado.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white">
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </div>
      <section>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <UserRound className="size-5" />
                </div>
                <div className="flex gap-1">
                  <button aria-label="Editar" onClick={() => setEdit(client)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
                    <Pencil className="size-4" />
                  </button>
                  <button aria-label="Archivar" onClick={async () => { await archiveClient(client.id); await refresh() }} className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
                    <Archive className="size-4" />
                  </button>
                  <button aria-label="Eliminar" onClick={() => remove(client)} className="rounded-md p-2 text-red-400 hover:bg-red-50">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <h3 className="mt-4 font-semibold">{client.name}</h3>
              {client.legalName && <p className="mt-1 text-sm text-slate-600">{client.legalName}</p>}
              <a href={`/clientes/${client.id}`} className="mt-4 inline-block text-sm font-semibold text-amber-700 hover:underline">
                Ver ficha →
              </a>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-500">
                {client.phone && (
                  <span className="flex items-center gap-2">
                    <Phone className="size-3.5" />
                    {client.phone}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-2">
                    <Mail className="size-3.5" />
                    {client.email}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-5">
          <ClientForm onSubmit={submitCreate} title="Nuevo cliente" />
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-5">
          <ClientForm onSubmit={submitEdit} initial={edit} title="Editar cliente" />
        </div>
      )}
    </div>
  )
}
