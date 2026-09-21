'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  CircleDollarSign,
  Construction,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react'

const links = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Obras', href: '/obras', icon: Construction },
  { label: 'Cotizaciones', href: '/cotizaciones', icon: CircleDollarSign },
  { label: 'Trabajos', href: '/trabajos', icon: BriefcaseBusiness },
  { label: 'Finanzas', href: '/finanzas', icon: Wallet },
  { label: 'Catálogo', href: '/catalogo', icon: Package },
] as const

const pageMeta: Record<string, { section: string; title: string }> = {
  '/': { section: 'Resumen operativo', title: 'Dashboard' },
  '/clientes': { section: 'General', title: 'Clientes' },
  '/obras': { section: 'General', title: 'Obras' },
  '/cotizaciones': { section: 'CRM comercial', title: 'Cotizaciones' },
  '/trabajos': { section: 'Operación', title: 'Trabajos' },
  '/finanzas': { section: 'Administración', title: 'Finanzas' },
  '/catalogo': { section: 'Catálogo comercial', title: 'Productos y servicios' },
}

function metaForPath(pathname: string) {
  if (pathname.startsWith('/clientes/')) {
    return { section: 'General', title: 'Ficha de cliente' }
  }
  return pageMeta[pathname] ?? { section: 'SG Áridos', title: 'Gestión' }
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = metaForPath(pathname)
  const greeting = pathname === '/' ? `Buen día, ${userName.split(' ')[0]}` : meta.title

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <div className={menuOpen ? 'fixed inset-0 z-30 bg-slate-950/30 lg:hidden' : 'hidden'} onClick={() => setMenuOpen(false)} />
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex h-20 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-FIw8e69PxQtzF5rPEAj4u44p18pDOK.png"
                alt="Logo SG Áridos"
                className="size-10 rounded-xl object-cover"
              />
              <div>
                <p className="text-[15px] font-bold text-slate-900">SG Áridos</p>
                <p className="text-[11px] text-slate-400">Gestión de servicios</p>
              </div>
            </div>
            <button aria-label="Cerrar menú" className="lg:hidden" onClick={() => setMenuOpen(false)}>
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Operación</p>
            {links.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${
                  isActive(pathname, href) ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon className="size-[17px]" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-100 p-3">
            <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-[13px] text-slate-500">
              <Settings className="size-[17px]" />
              Configuración
            </button>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <p className="truncate text-xs font-semibold text-slate-700">{userName}</p>
              <ChevronDown className="ml-auto size-4" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-8">
            <div className="flex items-center gap-3">
              <button aria-label="Abrir menú" type="button" className="lg:hidden" onClick={() => setMenuOpen(true)}>
                <Menu className="size-5" />
              </button>
              <div>
                <p className="text-xs text-slate-400">{meta.section}</p>
                <h1 className="text-xl font-bold md:text-2xl">{greeting}</h1>
              </div>
            </div>
            <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg lg:hidden" aria-label="SG Áridos — inicio">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-FIw8e69PxQtzF5rPEAj4u44p18pDOK.png"
                alt="SG Áridos"
                className="size-10 rounded-xl object-cover"
              />
            </Link>
            <button type="button" className="hidden rounded-lg p-2 text-slate-500 lg:block" aria-label="Notificaciones">
              <Bell className="size-[18px]" />
            </button>
          </header>
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
