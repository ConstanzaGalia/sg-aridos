'use client'

import { useEffect, useState } from 'react'
import {
  createExpense,
  deleteExpense,
  deletePayment,
  getFinanceSummary,
  listAccountsReceivable,
  listExpenses,
  listPaymentHistory,
  recordPayment,
  updateExpense,
} from '@/app/actions/finance'
import { listJobs } from '@/app/actions/operations'
import { formatMoney } from '@/lib/money'

const expenseCategories = [
  ['fuel', 'Combustible'],
  ['payroll', 'Sueldos'],
  ['maintenance', 'Mantenimiento'],
  ['supplier', 'Proveedores'],
  ['other', 'Otros'],
] as const

const methodLabel: Record<string, string> = {
  transfer: 'Transferencia',
  cash: 'Efectivo',
  check: 'Cheque',
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function DeliveryLines({ items }: { items: { description: string; quantity: string; unit: string; subtotal: string }[] }) {
  if (!items.length) return null
  return (
    <ul className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
      {items.map((line, i) => (
        <li key={i}>
          {line.description} · {line.quantity} {line.unit} · {formatMoney(line.subtotal)}
        </li>
      ))}
    </ul>
  )
}

export default function FinanzasPage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getFinanceSummary>> | null>(null)
  const [receivable, setReceivable] = useState<Awaited<ReturnType<typeof listAccountsReceivable>>>([])
  const [incomeList, setIncomeList] = useState<Awaited<ReturnType<typeof listPaymentHistory>>>([])
  const [expenseList, setExpenseList] = useState<Awaited<ReturnType<typeof listExpenses>>>([])
  const [jobs, setJobs] = useState<Awaited<ReturnType<typeof listJobs>>>([])
  const [error, setError] = useState('')
  const [editExpense, setEditExpense] = useState<(typeof expenseList)[number] | null>(null)
  const [payJobId, setPayJobId] = useState('')
  const [payAmount, setPayAmount] = useState('')

  async function refresh() {
    const [s, r, income, e, j] = await Promise.all([
      getFinanceSummary(),
      listAccountsReceivable(),
      listPaymentHistory(),
      listExpenses(),
      listJobs(),
    ])
    setSummary(s)
    setReceivable(r)
    setIncomeList(income)
    setExpenseList(e)
    setJobs(j)
  }

  useEffect(() => {
    refresh().catch(() => setError('No se pudieron cargar las finanzas.'))
  }, [])

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    try {
      await recordPayment({ jobId: Number(payJobId), amount: payAmount, method: 'transfer' })
      setPayJobId('')
      setPayAmount('')
      await refresh()
    } catch {
      setError('No se pudo registrar el cobro.')
    }
  }

  async function submitExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      await createExpense({
        description: String(formData.get('description') ?? ''),
        amount: String(formData.get('amount') ?? ''),
        category: String(formData.get('category') ?? 'other'),
      })
      e.currentTarget.reset()
      await refresh()
    } catch {
      setError('No se pudo registrar el gasto.')
    }
  }

  return (
    <div className="space-y-6 p-5 md:p-8">
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {summary && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Ingresos ({summary.monthLabel})</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{formatMoney(summary.income)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Gastos ({summary.monthLabel})</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{formatMoney(summary.expenses)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Resultado del mes</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(summary.net)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Total por cobrar</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{formatMoney(summary.receivable)}</p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">Detalle de ingresos (cobros)</h2>
              <p className="text-xs text-slate-500">Cada cobro con cliente, obra y conceptos del presupuesto.</p>
            </div>
            {summary && (
              <p className="text-sm text-emerald-700">
                Total del mes: <strong>{formatMoney(summary.income)}</strong>
              </p>
            )}
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {incomeList.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-800">{formatMoney(row.amount)}</p>
                  <p className="text-sm font-medium text-slate-800">{row.clientName ?? 'Cliente'}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(row.paidAt)} · {methodLabel[row.method] ?? row.method} · Trabajo #{row.jobId}
                    {row.quoteId ? ` · Presupuesto #${row.quoteId}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">{row.worksiteName ?? 'Sin obra'}</p>
                  <DeliveryLines items={row.deliveryItems} />
                  {!row.deliveryItems.length && row.jobType && (
                    <p className="mt-1 text-xs text-slate-500">{row.jobType.slice(0, 120)}</p>
                  )}
                  {row.notes && <p className="mt-1 text-xs italic text-slate-400">{row.notes}</p>}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Trabajo: {formatMoney(row.jobPaidAmount)} de {formatMoney(row.jobAmount)} cobrados
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('¿Eliminar este cobro del historial?')) return
                    await deletePayment(row.id)
                    await refresh()
                  }}
                  className="shrink-0 text-xs text-red-600"
                >
                  Borrar cobro
                </button>
              </div>
            ))}
            {incomeList.length === 0 && (
              <p className="py-8 text-sm text-slate-500">Todavía no hay cobros registrados. Usá el formulario de abajo.</p>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Quién debe</h2>
            <p className="mt-1 text-xs text-slate-500">Saldo pendiente por trabajo.</p>
            <div className="mt-4 divide-y divide-slate-100">
              {receivable.map((row) => (
                <div key={row.jobId} className="py-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.clientName}</p>
                      <p className="text-xs text-slate-500">{row.worksiteName ?? 'Sin obra'}</p>
                    </div>
                    <span className="shrink-0 font-bold text-red-600">{formatMoney(row.balance)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Total {formatMoney(row.amount)} · pagado {formatMoney(row.paidAmount)}
                  </p>
                  <DeliveryLines items={row.deliveryItems} />
                  {!row.deliveryItems.length && (
                    <p className="mt-1 text-xs text-slate-500">{row.type.slice(0, 80)}</p>
                  )}
                </div>
              ))}
              {receivable.length === 0 && <p className="py-4 text-sm text-slate-500">No hay saldos pendientes.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Registrar cobro</h2>
            <form onSubmit={submitPayment} className="mt-4 flex flex-col gap-3">
              <select value={payJobId} onChange={(e) => setPayJobId(e.target.value)} required className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="">Trabajo</option>
                {jobs
                  .filter((j) => Number(j.amount) - Number(j.paidAmount) > 0.009)
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      #{j.id} {j.clientName} · debe {formatMoney(Number(j.amount) - Number(j.paidAmount))}
                    </option>
                  ))}
              </select>
              <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" min="0" step="0.01" required placeholder="Monto cobrado" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <button className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Registrar cobro</button>
            </form>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Registrar gasto</h2>
            <form onSubmit={submitExpense} className="mt-4 flex flex-col gap-3">
              <input name="description" required placeholder="Descripción" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input name="amount" type="number" min="0" step="0.01" required placeholder="Monto" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <select name="category" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                {expenseCategories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Guardar gasto</button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-bold">Últimos gastos</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {expenseList.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{exp.description}</p>
                    <p className="text-xs text-slate-500">{exp.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-600">{formatMoney(exp.amount)}</span>
                    <button type="button" onClick={() => setEditExpense(exp)} className="text-xs text-amber-700">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('¿Eliminar gasto?')) return
                        await deleteExpense(exp.id)
                        await refresh()
                      }}
                      className="text-xs text-red-600"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
              {expenseList.length === 0 && <p className="py-4 text-sm text-slate-500">Sin gastos registrados.</p>}
            </div>
          </section>
        </div>

      {editExpense && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/30 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              await updateExpense({
                id: editExpense.id,
                description: String(fd.get('description')),
                amount: String(fd.get('amount')),
                category: String(fd.get('category')),
              })
              setEditExpense(null)
              await refresh()
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="font-bold">Editar gasto</h2>
            <div className="mt-4 flex flex-col gap-3">
              <input name="description" required defaultValue={editExpense.description} className="rounded-lg border px-3 py-2 text-sm" />
              <input name="amount" type="number" required defaultValue={editExpense.amount} className="rounded-lg border px-3 py-2 text-sm" />
              <select name="category" defaultValue={editExpense.category} className="rounded-lg border px-3 py-2 text-sm">
                {expenseCategories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Guardar</button>
                <button type="button" onClick={() => setEditExpense(null)} className="text-sm text-slate-500">
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
