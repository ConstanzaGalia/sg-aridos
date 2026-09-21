import { getQuoteWithItems } from '@/app/actions/crm'
import { buildQuotePdf } from '@/lib/quote-pdf'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return new Response('No autorizado', { status: 401 })
  }

  const id = Number((await context.params).id)
  if (!Number.isFinite(id) || id <= 0) {
    return new Response('ID inválido', { status: 400 })
  }

  try {
    const detail = await getQuoteWithItems(id)
    const pdf = await buildQuotePdf({
      quoteId: id,
      total: String(detail.quote.total),
      notes: detail.quote.notes,
      validUntil: detail.quote.validUntil,
      createdAt: detail.quote.createdAt,
      clientName: detail.clientName,
      clientLegalName: detail.clientLegalName,
      clientEmail: detail.clientEmail,
      clientPhone: detail.clientPhone,
      worksiteName: detail.worksiteName,
      worksiteLegalName: detail.worksiteLegalName,
      worksiteAddress: detail.worksiteAddress,
      items: detail.items.map((item) => ({
        description: item.description,
        quantity: String(item.quantity),
        unit: item.unit,
        unitPrice: String(item.unitPrice),
        subtotal: String(item.subtotal),
      })),
    })

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cotizacion-${id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return new Response('Cotización no encontrada', { status: 404 })
  }
}
