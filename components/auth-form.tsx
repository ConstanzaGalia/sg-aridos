'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

const logoUrl = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-FIw8e69PxQtzF5rPEAj4u44p18pDOK.png'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const data = new FormData(event.currentTarget)
    const result = mode === 'sign-in'
      ? await authClient.signIn.email({ email: String(data.get('email')), password: String(data.get('password')) })
      : await authClient.signUp.email({ name: String(data.get('name')), email: String(data.get('email')), password: String(data.get('password')) })
    setPending(false)
    if (result.error) {
      setError('No pudimos completar el acceso. Revisa tus datos e inténtalo nuevamente.')
      return
    }
    router.push('/')
    router.refresh()
  }

  const isSignIn = mode === 'sign-in'

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
      <div className="flex flex-col items-center text-center">
        <img src={logoUrl} alt="Logo SG Áridos" className="mb-5 size-20 rounded-2xl object-cover shadow-md" />
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-600">SG Áridos</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{isSignIn ? 'Ingresar' : 'Crear cuenta'}</h1>
        <p className="mt-2 text-base text-slate-500">Gestión de servicios y operaciones</p>
      </div>

      {mode === 'sign-up' && <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">Nombre<input name="name" required autoComplete="name" placeholder="Tu nombre" className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>}
      <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">Email<input name="email" type="email" required autoComplete="email" placeholder="tu@email.com" className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
      <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">Contraseña<input name="password" type="password" minLength={8} required autoComplete={isSignIn ? 'current-password' : 'new-password'} placeholder="Mínimo 8 caracteres" className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="h-12 rounded-xl bg-amber-500 px-4 text-base font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60">{pending ? 'Procesando...' : isSignIn ? 'Ingresar' : 'Crear cuenta'}</button>
      <a className="text-center text-sm font-semibold text-amber-700 transition hover:text-amber-800 hover:underline" href={isSignIn ? '/sign-up' : '/sign-in'}>{isSignIn ? 'Crear una cuenta' : 'Ya tengo una cuenta'}</a>
    </form>
  )
}
