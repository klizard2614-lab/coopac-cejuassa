import { createClient } from '@/lib/supabase'

function fmtMonto(n: number) {
  return `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)}`
}

function fmtFecha(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtHoy() {
  const now = new Date()
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

export async function generarFichaSocioPDF(socioId: string | number) {
  const supabase = createClient()

  const [
    { data: socio, error: socioError },
    { data: config },
    { data: aportes },
    { data: creditos },
    { data: pagos },
  ] = await Promise.all([
    supabase
      .from('socios')
      .select('*, convenios(nombre)')
      .eq('id', socioId)
      .single(),
    supabase
      .from('configuracion')
      .select('nombre_cooperativa')
      .single(),
    supabase
      .from('aportes')
      .select('fecha, tipo, monto, saldo_nuevo')
      .eq('id_socio', socioId)
      .order('fecha', { ascending: false })
      .limit(12),
    supabase
      .from('creditos')
      .select('nro_pagare, monto_aprobado, saldo_capital, estado')
      .eq('id_socio', socioId)
      .order('created_at', { ascending: false }),
    supabase
      .from('pagos_recibos')
      .select('fecha, nro_recibo, monto_total, estado_flujo')
      .eq('id_socio', socioId)
      .order('fecha', { ascending: false })
      .limit(6),
  ])

  if (socioError || !socio) throw new Error('No se pudo cargar el socio')

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

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('FICHA DE SOCIO', margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  if (config?.nombre_cooperativa) {
    doc.text(config.nombre_cooperativa, margin, y)
    y += 4
  }
  doc.text(`Generado: ${fmtHoy()}`, margin, y)
  y += 4

  doc.setDrawColor(30, 58, 95)
  doc.setLineWidth(0.6)
  doc.line(margin, y, W - margin, y)
  y += 8

  // ── Datos personales ───────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('DATOS PERSONALES', margin, y)
  y += 3
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, y, W - margin, y)
  y += 6

  const convenioNombre = (socio.convenios as { nombre: string } | null)?.nombre ?? '—'
  const estadoLabel = { activo: 'Activo', retirado: 'Retirado', suspendido: 'Suspendido', fallecido: 'Fallecido' }[socio.estado as string] ?? socio.estado

  const datosPersonales = [
    [`Nro Socio: ${socio.nro_socio}`, `DNI: ${socio.dni ?? '—'}`],
    [`Nombre completo: ${socio.apellidos} ${socio.nombres}`, `Estado: ${estadoLabel}`],
    [`Convenio: ${convenioNombre}`, `Ingreso: ${fmtFecha(socio.fecha_ingreso)}`],
    [`Teléfono: ${socio.telefono ?? '—'}`, `Email: ${socio.email ?? '—'}`],
  ]

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  for (const [col1, col2] of datosPersonales) {
    doc.text(col1, margin, y)
    doc.text(col2, 110, y)
    y += 5
  }
  if (socio.direccion) {
    doc.text(`Dirección: ${socio.direccion}`, margin, y)
    y += 5
  }
  y += 4

  // ── Aportes ────────────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('APORTES (últimos 12)', margin, y)
  y += 3

  if (aportes && aportes.length > 0) {
    const totalAportes = aportes.reduce((sum, a) => sum + (a.monto ?? 0), 0)
    const saldoActual = aportes[0]?.saldo_nuevo ?? 0

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Monto', 'Saldo']],
      body: aportes.map(a => [
        fmtFecha(a.fecha),
        a.tipo ?? '—',
        fmtMonto(a.monto),
        fmtMonto(a.saldo_nuevo),
      ]),
      foot: [[`Total movimientos: ${aportes.length}`, '', fmtMonto(totalAportes), `Saldo actual: ${fmtMonto(saldoActual)}`]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [230, 235, 242], fontStyle: 'bold', textColor: [30, 58, 95], fontSize: 8 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('Sin aportes registrados', margin, y + 5)
    y += 10
  }

  // ── Créditos ───────────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('CRÉDITOS', margin, y)
  y += 3

  if (creditos && creditos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Nro Pagaré', 'Monto Aprobado', 'Saldo Capital', 'Estado']],
      body: creditos.map(c => [
        c.nro_pagare,
        fmtMonto(c.monto_aprobado),
        fmtMonto(c.saldo_capital),
        c.estado,
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('Sin créditos registrados', margin, y + 5)
    y += 10
  }

  // ── Últimos pagos ──────────────────────────────────────
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 58, 95)
  doc.text('ÚLTIMOS PAGOS (últimos 6)', margin, y)
  y += 3

  if (pagos && pagos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Nro Recibo', 'Total', 'Estado']],
      body: pagos.map(p => [
        fmtFecha(p.fecha),
        p.nro_recibo,
        fmtMonto(p.monto_total),
        p.estado_flujo,
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 2: { halign: 'right' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('Sin pagos registrados', margin, y + 5)
  }

  const apellidosFile = (socio.apellidos as string).replace(/\s+/g, '_').toUpperCase()
  doc.save(`ficha_socio_${socio.nro_socio}_${apellidosFile}.pdf`)
}
