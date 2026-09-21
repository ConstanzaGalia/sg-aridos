/** Datos del emisor en cotizaciones y PDF. Podés override con variables NEXT_PUBLIC_* en .env */
export const companyProfile = {
  tradeName: 'SG Áridos',
  legalName: process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME?.trim() || 'SG Áridos',
  tagline: 'Gestión de servicios',
  logoUrl:
    'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-FIw8e69PxQtzF5rPEAj4u44p18pDOK.png',
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL?.trim() || '',
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE?.trim() || '',
  cuit: process.env.NEXT_PUBLIC_COMPANY_CUIT?.trim() || '',
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || '',
}
