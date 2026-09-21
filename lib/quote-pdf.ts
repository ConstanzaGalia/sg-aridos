import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { companyProfile } from '@/lib/company'
import { formatMoney } from '@/lib/money'

export type QuotePdfPayload = {
  quoteId: number
  total: string
  notes: string | null
  validUntil: Date | null
  createdAt: Date
  clientName: string | null
  clientLegalName: string | null
  clientEmail: string | null
  clientPhone: string | null
  worksiteName: string | null
  worksiteLegalName: string | null
  worksiteAddress: string | null
  items: {
    description: string
    quantity: string
    unit: string
    unitPrice: string
    subtotal: string
  }[]
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

export async function buildQuotePdf(payload: QuotePdfPayload): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 16

  try {
    const res = await fetch(companyProfile.logoUrl)
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') ?? 'image/png'
      const format = contentType.includes('png') ? 'PNG' : 'JPEG'
      const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`
      doc.addImage(dataUrl, format, 14, y - 4, 22, 22)
    }
  } catch {
    /* sin logo */
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text(companyProfile.tradeName, 40, y + 2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(companyProfile.tagline, 40, y + 8)

  const issuerLines: string[] = []
  if (companyProfile.legalName && companyProfile.legalName !== companyProfile.tradeName) {
    issuerLines.push(`Razón social: ${companyProfile.legalName}`)
  } else if (companyProfile.legalName) {
    issuerLines.push(companyProfile.legalName)
  }
  if (companyProfile.cuit) issuerLines.push(`CUIT: ${companyProfile.cuit}`)
  if (companyProfile.address) issuerLines.push(companyProfile.address)
  if (companyProfile.phone) issuerLines.push(`Tel: ${companyProfile.phone}`)
  if (companyProfile.email) issuerLines.push(companyProfile.email)

  let issuerY = y + 13
  for (const line of issuerLines) {
    doc.text(line, 40, issuerY)
    issuerY += 4
  }

  y = Math.max(issuerY + 4, 38)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  doc.text('Cotización', 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.text(`Fecha: ${formatDate(payload.createdAt)}`, pageWidth - 14, y, { align: 'right' })
  if (payload.validUntil) {
    y += 6
    doc.text(`Válida hasta: ${formatDate(payload.validUntil)}`, pageWidth - 14, y, { align: 'right' })
  }

  y += payload.validUntil ? 10 : 8
  doc.setDrawColor(226, 232, 240)
  doc.line(14, y, pageWidth - 14, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text('Cliente', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const clientLines = [
    payload.clientName && `Nombre: ${payload.clientName}`,
    payload.clientLegalName && `Razón social: ${payload.clientLegalName}`,
    payload.clientEmail && `Email: ${payload.clientEmail}`,
    payload.clientPhone && `Teléfono: ${payload.clientPhone}`,
  ].filter(Boolean) as string[]
  for (const line of clientLines) {
    doc.text(line, 14, y)
    y += 5
  }
  if (!clientLines.length) {
    doc.text('—', 14, y)
    y += 5
  }

  y += 3
  doc.setFont('helvetica', 'bold')
  doc.text('Obra', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const obraLines = [
    payload.worksiteName && `Referencia: ${payload.worksiteName}`,
    `Razón social (facturación): ${payload.worksiteLegalName?.trim() || payload.worksiteName || '—'}`,
  ].filter(Boolean) as string[]
  for (const line of obraLines) {
    doc.text(line, 14, y)
    y += 5
  }
  if (payload.worksiteAddress) {
    doc.setTextColor(100, 116, 139)
    doc.text(payload.worksiteAddress, 14, y)
    doc.setTextColor(71, 85, 105)
    y += 5
  }

  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Descripción', 'Cant.', 'Unidad', 'P. unitario', 'Subtotal']],
    body: payload.items.map((item) => [
      item.description,
      String(item.quantity),
      item.unit,
      formatMoney(item.unitPrice),
      formatMoney(item.subtotal),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 18 },
      2: { cellWidth: 22 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: 14, right: 14 },
  })

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20
  let afterTable = tableEnd + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text(`Total: ${formatMoney(payload.total)}`, pageWidth - 14, afterTable, { align: 'right' })
  afterTable += 10

  if (payload.notes?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Observaciones', 14, afterTable)
    afterTable += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const split = doc.splitTextToSize(payload.notes.trim(), pageWidth - 28)
    doc.text(split, 14, afterTable)
    afterTable += split.length * 4 + 4
  }

  const footerY = doc.internal.pageSize.getHeight() - 12
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(
    `Documento generado por ${companyProfile.tradeName} · ${new Intl.DateTimeFormat('es-AR').format(new Date())}`,
    pageWidth / 2,
    footerY,
    { align: 'center' },
  )

  return doc.output('arraybuffer')
}
