'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, X } from 'lucide-react'
import { createCatalogItem, deleteCatalogItem, listCatalog, seedCatalog, updateCatalogItem } from '@/app/actions/crm'

type CatalogItem = { id: number; name: string; kind: string; pricingMode: string; active: boolean }
const modeLabels: Record<string, string> = { per_trip: 'Por camionada / viaje', tons_km: 'Por toneladas y km', hours: 'Por hora' }

export default function CatalogoPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<CatalogItem | null>(null)

  async function load() {
    setLoading(true)
    try {
      await seedCatalog()
      setItems((await listCatalog()) as CatalogItem[])
    } catch {
      setError('Inicia sesión para administrar el catálogo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function addItem(formData: FormData) {
    try {
      await createCatalogItem({
        name: String(formData.get('name')),
        kind: String(formData.get('kind')) as 'product' | 'service',
        pricingMode: String(formData.get('pricingMode')),
      })
      await load()
    } catch {
      setError('No se pudo crear el elemento.')
    }
  }

  async function saveEdit(formData: FormData) {
    if (!edit) return
    try {
      await updateCatalogItem({
        id: edit.id,
        name: String(formData.get('name')),
        kind: String(formData.get('kind')) as 'product' | 'service',
        pricingMode: String(formData.get('pricingMode')),
        active: formData.get('active') === 'on',
      })
      setEdit(null)
      await load()
    } catch {
      setError('No se pudo actualizar.')
    }
  }

  async function remove(item: CatalogItem) {
    if (!confirm(`¿Eliminar "${item.name}" del catálogo?`)) return
    try {
      await deleteCatalogItem(item.id)
      await load()
    } catch {
      setError('No se pudo eliminar.')
    }
  }

  const products = items.filter((item) => item.kind === 'product')
  const services = items.filter((item) => item.kind === 'service')
  const groups = [
    { title: `Productos (${products.length})`, list: products },
    { title: `Servicios (${services.length})`, list: services },
  ]

  function ItemRow({ item }: { item: CatalogItem }) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
        <span className="font-medium">{item.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{modeLabels[item.pricingMode] ?? item.pricingMode}</span>
          <button type="button" onClick={() => setEdit(item)} className="text-slate-400 hover:text-amber-700">
            <Pencil className="size-4" />
          </button>
          <button type="button" onClick={() => remove(item)} className="text-slate-400 hover:text-red-600">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">
      <div>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold text-amber-600">Catálogo comercial</p>
            <h2 className="mt-1 text-2xl font-bold">Productos y servicios</h2>
          </div>
          <form action={addItem} className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <input name="name" required placeholder="Nuevo producto o servicio" className="min-w-56 rounded-lg border px-3 py-2 text-sm" />
            <select name="kind" className="rounded-lg border px-3 py-2 text-sm">
              <option value="product">Producto</option>
              <option value="service">Servicio</option>
            </select>
            <select name="pricingMode" className="rounded-lg border px-3 py-2 text-sm">
              <option value="per_trip">Por viaje</option>
              <option value="tons_km">Toneladas / km</option>
              <option value="hours">Por hora</option>
            </select>
            <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Agregar</button>
          </form>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <p className="mt-10 text-slate-500">Cargando catálogo...</p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {groups.map((group) => (
              <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">{group.title}</h2>
                <div className="mt-5 flex flex-col gap-2">{group.list.map((item) => <ItemRow key={item.id} item={item} />)}</div>
              </section>
            ))}
          </div>
        )}
      </div>
      {edit && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form action={saveEdit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Editar ítem</h2>
              <button type="button" onClick={() => setEdit(null)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input name="name" required defaultValue={edit.name} className="rounded-lg border px-3 py-2 text-sm" />
              <select name="kind" defaultValue={edit.kind} className="rounded-lg border px-3 py-2 text-sm">
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </select>
              <select name="pricingMode" defaultValue={edit.pricingMode} className="rounded-lg border px-3 py-2 text-sm">
                <option value="per_trip">Por viaje</option>
                <option value="tons_km">Toneladas / km</option>
                <option value="hours">Por hora</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={edit.active} />
                Activo en catálogo
              </label>
              <button className="rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
