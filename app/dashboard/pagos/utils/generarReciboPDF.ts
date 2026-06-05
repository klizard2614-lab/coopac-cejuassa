import { createClient } from '@/lib/supabase'

function fmtMonto(n: number) {
  return `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)}`
}

function fmtFecha(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export async function generarReciboPDF(pagoId: string | number) {
  const supabase = createClient()

  const [{ data: pago, error: pagoError }, { data: config }] = await Promise.all([
    supabase
      .from('pagos_recibos')
      .select('*, socios(nro_socio, apellidos, nombres)')
      .eq('id', pagoId)
      .single(),
    supabase
      .from('configuracion')
      .select('nombre_cooperativa, ruc')
      .single(),
  ])

  if (pagoError || !pago) throw new Error('No se pudo cargar el recibo de pago')

  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 20
  const W = 210
  let y = 22

  // ── Encabezado ────────────────────────────────────────
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('COOPAC CEJUASSA', margin, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  if (config?.nombre_cooperativa) {
    doc.text(config.nombre_cooperativa, margin, y)
    y += 5
  }
  if (config?.ruc) {
    doc.text(`RUC: ${config.ruc}`, margin, y)
    y += 5
  }

  y += 2
  doc.setDrawColor(30, 58, 95)
  doc.setLineWidth(0.6)
  doc.line(margin, y, W - margin, y)
  y += 7

  // ── Título recibo ──────────────────────────────────────
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text(`RECIBO DE PAGO N° ${pago.nro_recibo}`, margin, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Fecha: ${fmtFecha(pago.fecha)}`, margin, y)
  doc.text(`Período: ${pago.periodo}`, 110, y)
  y += 10

  // ── Datos del socio ────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('DATOS DEL SOCIO', margin, y)
  y += 3
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, W - margin, y)
  y += 5

  const socio = pago.socios as { nro_socio: string; apellidos: string; nombres: string } | null
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`Nro Socio: ${socio?.nro_socio ?? '—'}`, margin, y)
  y += 5
  doc.text(`Nombre: ${socio ? `${socio.apellidos} ${socio.nombres}` : '—'}`, margin, y)
  y += 5
  doc.text(`Canal de pago: ${pago.canal_pago}`, margin, y)
  y += 10

  // ── Detalle del pago ───────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('DETALLE DEL PAGO', margin, y)
  y += 3

  const conceptos = [
    { label: 'Aporte',    monto: pago.monto_aporte },
    { label: 'Capital',   monto: pago.monto_capital },
    { label: 'Interés',  monto: pago.monto_interes },
    { label: 'FPS',       monto: pago.monto_fps },
    { label: 'FPS Extra', monto: pago.monto_fps_extra },
    { label: 'Otros',     monto: pago.monto_otros },
  ].filter(c => (c.monto ?? 0) > 0)

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Monto']],
    body: conceptos.map(c => [c.label, fmtMonto(c.monto)]),
    foot: [['TOTAL', fmtMonto(pago.monto_total)]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [230, 235, 242], fontStyle: 'bold', textColor: [30, 58, 95] },
    columnStyles: { 1: { halign: 'right' } },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Observación y estado ───────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  if (pago.observacion) {
    doc.text(`Observación: ${pago.observacion}`, margin, y)
    y += 6
  }
  doc.text(`Estado: ${pago.estado_flujo}`, margin, y)
  y += 16

  // ── Firma ──────────────────────────────────────────────
  doc.setDrawColor(100, 100, 100)
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + 65, y)
  y += 4
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('Firma y sello', margin, y)

  const fechaFile = (pago.fecha as string).replace(/-/g, '')
  doc.save(`recibo_${pago.nro_recibo}_${fechaFile}.pdf`)
}
