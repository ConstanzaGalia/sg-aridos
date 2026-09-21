'use client'

import { CalendarDays, CircleDollarSign, Construction, Users, Wallet, BriefcaseBusiness } from 'lucide-react'

export type DashboardSummary = {
  clients: number
  worksites: number
  jobs: number
  unpaidJobs: number
  revenue: string
  expenses: string
  net: string
  receivable: string
  recentJobs: Array<{
    id: number
    type: string
    status: string
    paymentStatus: string
    amount: string
    paidAmount: string
    scheduledAt: Date | null
    clientName: string | null
  }>
}

function dateLabel(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    : 'Sin fecha'
}

function money(value: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value))
}

export default function DashboardHome({ summary }: { summary: DashboardSummary }) {
  const cards = [
    ['Clientes activos', summary.clients, 'registrados', Users],
    ['Obras activas', summary.worksites, 'en seguimiento', Construction],
    ['Trabajos en curso', summary.jobs, `${summary.unpaidJobs} con cobranza pendiente`, BriefcaseBusiness],
    ['Cobrado este mes', money(summary.revenue), `Gastos ${money(summary.expenses)}`, CircleDollarSign],
    ['Resultado del mes', money(summary.net), 'ingresos − gastos', Wallet],
    ['Por cobrar total', money(summary.receivable), 'saldo de clientes', CircleDollarSign],
  ] as const

  return (
    <div className="p-5 md:p-8">
      <div className="mb-7">
        <p className="mb-1 text-sm font-semibold text-amber-600">Datos reales de tu operación</p>
        <h2 className="text-2xl font-bold">Lo que está pasando hoy</h2>
        <p className="mt-1 text-sm text-slate-500">Este resumen se actualiza desde tus clientes, obras, trabajos y finanzas.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, detail, Icon]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Icon className="size-[19px]" />
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="font-bold">Trabajos recientes</h3>
            <p className="text-xs text-slate-400">Últimos trabajos registrados</p>
          </div>
          <a href="/trabajos" className="text-xs font-semibold text-amber-700">
            Ver todos
          </a>
        </div>
        <div className="divide-y divide-slate-100">
          {summary.recentJobs.length ? (
            summary.recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-slate-800">{job.clientName ?? 'Cliente sin nombre'}</p>
                  <p className="text-xs text-slate-500">
                    {job.type.slice(0, 42)} · {dateLabel(job.scheduledAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(job.amount)}</p>
                  <span className="text-[11px] capitalize text-amber-700">{job.paymentStatus}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="p-8 text-sm text-slate-400">Todavía no hay trabajos registrados.</p>
          )}
        </div>
      </section>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <CalendarDays className="size-4" />
        Los datos mostrados pertenecen a tu cuenta y se actualizan al guardar cambios.
      </div>
    </div>
  )
}
