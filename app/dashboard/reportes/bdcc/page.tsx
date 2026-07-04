'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { fmtFechaBdcc, fmtNumBdcc, buildTxt, downloadTxt } from '@/lib/bdcc/format'
import { useRol } from '@/lib/useRol'
import AccesoDenegado from '@/components/AccesoDenegado'

const PUEDE_VER_BDCC = ['admin', 'contabilidad']

// ─── AVISO: BDCC/TXT fuera de alcance actual ─────────────────────────────────
// La cooperativa confirmó (2026-07-02) que el único reporte regulatorio activo
// es Anexo N°6. Esta pantalla queda archivada — no usar para entrega oficial.
// ─────────────────────────────────────────────────────────────────────────────

const BANNER_FUERA_ALCANCE = true

// ─── constantes ───────────────────────────────────────────────────────────────

const COOPAC = '01270'

const TASAS_DEFECTO = {
  normal: 0.01, cpp: 0.05, deficiente: 0.25, dudoso: 0.60, perdida: 1.00,
}

// Mnemónicos confirmados del plan SBS_BDCC_REPORTS_PLAN.md
// Advertencia: algunos mnemónicos no están completamente documentados en el plan local.
// Usar este archivo como borrador revisable — confirmar con el Oficio SBS antes de enviar.
const BD01_HDR = [
  'NUMDOC','APED','NOM','FECNAC','SEXO','ESTCIV','SIGE','CODSOC',
  'PARTIDA','TIPDOC','TIPPERS','DIREC','RELL',
  'CLASDEU','CLASAI','CODAG','MON',
  'NUMCRED','TIPCRED','SUBTIPCRED','FECDES','MONTDES','TPINT','SCONK',
  'CCVI','CCRF','CCVE','CCJU','CCCO',
  'CAPVIG','CAPREE','CAPREF','CAPVEN','CAPJUD','CAPCON','CCCAP',
  'DAK','SGPREF','SGAUT','PRREV','PRCON',
  'SCAST','CCCAST','RENDDEV','INTSUS','INGDIF',
  'TIPPER','NCUOTAS','NPAGAS','PERIODU','GRACIA','FVEG','FVEP',
]

const BD02A_HDR = [
  'NUMDOC','NUMCRED','NCUOTA','FECVEN','FCAN',
  'CAPK','INTK','CAPAGK','INTAGK','IAP',
  'DAKC','SCONK','SCONINT','TIPPAGO',
]

// BD03A/BD03B: solo encabezado — CEJUASSA no tiene garantías preferidas (Fase 7B-1)
const BD03_HDR = [
  'NUMDOC','NUMCRED',
  'TGR','FCONS','POL','FVEPOL','VCONS','FUVAL','REPEV','VCOM','VREA','CC','VBC','VANX','IGRC',
]

// ─── helpers locales ──────────────────────────────────────────────────────────

type TasasProvision = typeof TASAS_DEFECTO

function getClasifNum(dias: number): number {
  if (dias <= 8)   return 0
  if (dias <= 30)  return 1
  if (dias <= 60)  return 2
  if (dias <= 120) return 3
  return 4
}

function getTasaByNum(num: number, t: TasasProvision): number {
  return [t.normal, t.cpp, t.deficiente, t.dudoso, t.perdida][num] ?? 0
}

function diasEntre(fechaStr: string, hoy: Date): number {
  const f = new Date(fechaStr + 'T00:00:00')
  return Math.max(0, Math.floor((hoy.getTime() - f.getTime()) / 86400000))
}

function periodoYYYYMM(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, '0')}`
}

function periodoISO(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function buildYearOptions() {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2]
}

// ─── estado de archivos ───────────────────────────────────────────────────────

const ARCHIVOS = [
  { code: 'BD01',  label: 'BD01 — Créditos vigentes',        estado: 'mvp',      nota: 'Generable MVP' },
  { code: 'BD02A', label: 'BD02-A — Cuotas pagadas vigentes', estado: 'mvp',      nota: 'Generable MVP' },
  { code: 'BD03A', label: 'BD03A — Garantías (vigentes)',     estado: 'header',   nota: 'Solo encabezado — sin garantías' },
  { code: 'BD03B', label: 'BD03B — Garantías (cancelados)',   estado: 'header',   nota: 'Solo encabezado — sin garantías' },
  { code: 'BD02B', label: 'BD02-B — Cuotas pagadas cancelados', estado: 'pendiente', nota: 'Pendiente: falta módulo créditos cancelados' },
  { code: 'BD04',  label: 'BD04 — Créditos cancelados',      estado: 'pendiente', nota: 'Pendiente: falta módulo créditos cancelados' },
]

// ─── componente ───────────────────────────────────────────────────────────────

export default function BDCCPage() {
  const { rol, loading: checkingRol } = useRol()
  const now = new Date()
  const [mes, setMes]       = useState(now.getMonth() + 1)
  const [anio, setAnio]     = useState(now.getFullYear())
  const [loading, setLoading] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({})

  if (checkingRol) return <div className="p-8 text-sm text-gray-400">Verificando acceso...</div>
  if (!PUEDE_VER_BDCC.includes(rol ?? '')) {
    return <AccesoDenegado mensaje="Solo los roles Administrador y Contabilidad pueden acceder al módulo BDCC SBS." />
  }

  const yyyymm = periodoYYYYMM(anio, mes)
  const periodoISOs = periodoISO(anio, mes)
  const periodoLabel = `${MESES[mes - 1]} ${anio}`

  // ── BD01 ──────────────────────────────────────────────────────────────────

  async function generarBD01() {
    setLoading('BD01')
    setWarnings([])
    const sb = createClient()
    const warns: string[] = []

    let tasas = TASAS_DEFECTO
    const cfgRes = await sb
      .from('configuracion')
      .select('provision_normal,provision_cpp,provision_deficiente,provision_dudoso,provision_perdida')
      .eq('id', 1)
      .single()
    if (cfgRes.data) {
      tasas = {
        normal:      cfgRes.data.provision_normal      ?? TASAS_DEFECTO.normal,
        cpp:         cfgRes.data.provision_cpp         ?? TASAS_DEFECTO.cpp,
        deficiente:  cfgRes.data.provision_deficiente  ?? TASAS_DEFECTO.deficiente,
        dudoso:      cfgRes.data.provision_dudoso      ?? TASAS_DEFECTO.dudoso,
        perdida:     cfgRes.data.provision_perdida     ?? TASAS_DEFECTO.perdida,
      }
    } else {
      warns.push('⚠ No se pudieron leer las tasas de provisión desde Configuración. Usando tasas SBS por defecto.')
    }

    const [creditosRes, cuotasRes] = await Promise.all([
      sb.from('creditos').select(`
        id, nro_pagare, fecha_desembolso, monto_aprobado, tasa_interes,
        plazo_meses, saldo_capital,
        tipo_credito_sbs, subtipo_credito_sbs, cuenta_contable_bd01,
        socios(nro_socio, dni, apellidos, nombres, fecha_nacimiento, direccion,
               genero, estado_civil, convenios(nombre))
      `).eq('estado', 'vigente'),
      sb.from('cronograma_cuotas')
        .select('id_credito, nro_cuota, fecha_vencimiento, estado')
        .order('nro_cuota'),
    ])

    const creditos = (creditosRes.data ?? []) as unknown[]
    const todasCuotas = (cuotasRes.data ?? []) as {
      id_credito: number; nro_cuota: number; fecha_vencimiento: string; estado: string
    }[]

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const cuotasPorCredito: Record<number, typeof todasCuotas> = {}
    for (const cu of todasCuotas) {
      if (!cuotasPorCredito[cu.id_credito]) cuotasPorCredito[cu.id_credito] = []
      cuotasPorCredito[cu.id_credito].push(cu)
    }

    warns.push('⚠ TPINT pendiente de validación con Créditos (¿tasa nominal o TEA?).')
    warns.push('⚠ CCVE y CCJU usan la misma cuenta contable que CCVI como estimación MVP — confirmar con Contabilidad antes de enviar a SBS.')

    let countSinGenero = 0
    let countSinSubtipo = 0

    const rows: string[][] = [BD01_HDR]

    for (const rawC of creditos) {
      const c = rawC as {
        id: number; nro_pagare: string; fecha_desembolso: string
        monto_aprobado: number; tasa_interes: number; plazo_meses: number; saldo_capital: number
        tipo_credito_sbs: string | null; subtipo_credito_sbs: string | null; cuenta_contable_bd01: string | null
        socios: {
          nro_socio: string; dni: string; apellidos: string; nombres: string
          fecha_nacimiento: string | null; direccion: string | null
          genero: string | null; estado_civil: string | null
          convenios: { nombre: string } | null
        } | null
      }
      const socio = c.socios
      if (!socio) continue

      const cuotas = cuotasPorCredito[c.id] ?? []
      const pendientes = cuotas.filter(cu =>
        cu.estado === 'pendiente' || cu.estado === 'vencida' || cu.estado === 'parcial'
      )
      let dias_mora = 0
      if (pendientes.length > 0) {
        const minFecha = pendientes.reduce((min, cu) =>
          cu.fecha_vencimiento < min ? cu.fecha_vencimiento : min,
          pendientes[0].fecha_vencimiento
        )
        dias_mora = diasEntre(minFecha, hoy)
      }

      const clasifNum  = getClasifNum(dias_mora)
      const tasa       = getTasaByNum(clasifNum, tasas)
      const prov_req   = (c.saldo_capital ?? 0) * tasa
      const prov_con   = prov_req // criterio_contable_confirmado (Fase 8A-1)

      const cuotasPagadas = cuotas.filter(cu => cu.estado === 'pagada').length
      const ultimaCuota   = cuotas.length > 0
        ? cuotas.reduce((max, cu) => cu.fecha_vencimiento > max ? cu.fecha_vencimiento : max, cuotas[0].fecha_vencimiento)
        : ''

      const capVig = dias_mora === 0 ? (c.saldo_capital ?? 0) : 0
      const capVen = dias_mora > 0 && dias_mora <= 120 ? (c.saldo_capital ?? 0) : 0
      const capJud = dias_mora > 120 ? (c.saldo_capital ?? 0) : 0

      const genero     = socio.genero     ?? ''
      const estCivil   = socio.estado_civil ?? ''
      const convNombre = socio.convenios?.nombre ?? ''

      if (!genero) countSinGenero++

      const tipcred    = c.tipo_credito_sbs    ?? ''
      const subtipcred = c.subtipo_credito_sbs ?? ''
      if (!subtipcred || subtipcred === 'por_confirmar') countSinSubtipo++

      const cc   = c.cuenta_contable_bd01 ?? '1411050604'
      const ccvi = capVig > 0 ? cc : ''
      const ccve = capVen > 0 ? cc : ''
      const ccju = capJud > 0 ? cc : ''

      rows.push([
        socio.dni         ?? '',              // NUMDOC
        socio.apellidos   ?? '',              // APED
        socio.nombres     ?? '',              // NOM
        fmtFechaBdcc(socio.fecha_nacimiento), // FECNAC
        genero,                               // SEXO
        estCivil,                             // ESTCIV
        convNombre,                           // SIGE
        socio.nro_socio   ?? '',              // CODSOC
        '',                                   // PARTIDA (personas naturales)
        '1',                                  // TIPDOC (DNI)
        '1',                                  // TIPPERS (natural)
        socio.direccion   ?? '',              // DIREC
        '0',                                  // RELL
        String(clasifNum),                    // CLASDEU
        String(clasifNum),                    // CLASAI
        '001',                                // CODAG
        '01',                                 // MON (soles)
        c.nro_pagare      ?? '',              // NUMCRED
        tipcred,                              // TIPCRED
        subtipcred,                           // SUBTIPCRED
        fmtFechaBdcc(c.fecha_desembolso),     // FECDES
        fmtNumBdcc(c.monto_aprobado),         // MONTDES
        fmtNumBdcc(c.tasa_interes, 4),        // TPINT
        fmtNumBdcc(c.saldo_capital),          // SCONK
        ccvi,                                 // CCVI
        '',                                   // CCRF (no reestructurados)
        ccve,                                 // CCVE
        ccju,                                 // CCJU
        '',                                   // CCCO (no contingente)
        fmtNumBdcc(capVig),                   // CAPVIG
        '0.00',                               // CAPREE
        '0.00',                               // CAPREF
        fmtNumBdcc(capVen),                   // CAPVEN
        fmtNumBdcc(capJud),                   // CAPJUD
        '0.00',                               // CAPCON
        '',                                   // CCCAP
        String(dias_mora),                    // DAK
        '0.00',                               // SGPREF
        '0.00',                               // SGAUT
        fmtNumBdcc(prov_req),                 // PRREV
        fmtNumBdcc(prov_con),                 // PRCON
        '0.00',                               // SCAST
        '',                                   // CCCAST
        '0.00',                               // RENDDEV
        '0.00',                               // INTSUS
        '0.00',                               // INGDIF
        '18',                                 // TIPPER (consumo no revolvente)
        String(c.plazo_meses ?? 0),           // NCUOTAS
        String(cuotasPagadas),                // NPAGAS
        '30',                                 // PERIODU (mensual)
        '',                                   // GRACIA
        fmtFechaBdcc(ultimaCuota),            // FVEG
        fmtFechaBdcc(ultimaCuota),            // FVEP
      ])
    }

    if (countSinGenero > 0)
      warns.push(`⚠ ${countSinGenero} socio(s) sin género — campo SEXO vacío. Ingresar en módulo Socios.`)
    if (countSinSubtipo > 0)
      warns.push(`⚠ ${countSinSubtipo} crédito(s) con SUBTIPCRED inválido (vacío o "por_confirmar"). Confirmar subtipo SBS con área de Créditos antes de enviar a SBS.`)

    const dataRows = rows.length - 1
    downloadTxt(buildTxt(rows), `${COOPAC}_BD01_${yyyymm}.txt`)
    setWarnings(warns)
    setRowCounts(prev => ({ ...prev, BD01: dataRows }))
    setLoading(null)
  }

  // ── BD02-A ────────────────────────────────────────────────────────────────

  async function generarBD02A() {
    setLoading('BD02A')
    setWarnings([])
    const sb = createClient()
    const warns: string[] = []

    const [cuotasRes, creditosRes, recibosRes] = await Promise.all([
      sb.from('cronograma_cuotas')
        .select('id_credito, nro_cuota, fecha_vencimiento, capital, interes, capital_pagado, interes_pagado, fecha_pago, estado')
        .eq('estado', 'pagada')
        .gte('fecha_pago', `${periodoISOs}-01`)
        .lte('fecha_pago', `${periodoISOs}-31`),
      sb.from('creditos')
        .select('id, nro_pagare, socios(dni)')
        .eq('estado', 'vigente'),
      sb.from('pagos_recibos')
        .select('id_credito, interes_amortizado_pagado, tipo_pago')
        .eq('periodo', periodoISOs),
    ])

    const cuotas  = (cuotasRes.data ?? []) as {
      id_credito: number; nro_cuota: number; fecha_vencimiento: string
      capital: number; interes: number; capital_pagado: number; interes_pagado: number
      fecha_pago: string | null; estado: string
    }[]
    const creditos = (creditosRes.data ?? []) as unknown as {
      id: number; nro_pagare: string; socios: { dni: string } | null
    }[]
    const recibos  = (recibosRes.data ?? []) as {
      id_credito: number; interes_amortizado_pagado: number | null; tipo_pago: string | null
    }[]

    const creditoMap: Record<number, { nro_pagare: string; dni: string }> = {}
    for (const c of creditos) {
      creditoMap[c.id] = { nro_pagare: c.nro_pagare, dni: c.socios?.dni ?? '' }
    }

    const reciboMap: Record<number, { iap: number; tipo_pago: string }> = {}
    let tieneK = false
    for (const r of recibos) {
      if (!reciboMap[r.id_credito]) {
        reciboMap[r.id_credito] = {
          iap:       r.interes_amortizado_pagado ?? 0,
          tipo_pago: r.tipo_pago ?? 'A',
        }
      }
      if (r.tipo_pago === 'K') {
        reciboMap[r.id_credito].tipo_pago = 'K'
        tieneK = true
      }
    }
    if (tieneK) warns.push('⚠ Tipo K encontrado — "Tipo K pendiente de confirmación con Créditos."')

    const rows: string[][] = [BD02A_HDR]

    for (const cu of cuotas) {
      const cred = creditoMap[cu.id_credito]
      if (!cred) continue

      const recibo = reciboMap[cu.id_credito] ?? { iap: 0, tipo_pago: 'A' }

      let dakc = 0
      if (cu.fecha_pago && cu.fecha_vencimiento) {
        const fPago = new Date(cu.fecha_pago + 'T00:00:00')
        const fVen  = new Date(cu.fecha_vencimiento + 'T00:00:00')
        dakc = Math.max(0, Math.floor((fPago.getTime() - fVen.getTime()) / 86400000))
      }

      const sconk    = Math.max(0, (cu.capital   ?? 0) - (cu.capital_pagado   ?? 0))
      const sconint  = Math.max(0, (cu.interes   ?? 0) - (cu.interes_pagado   ?? 0))

      rows.push([
        cred.dni,                                                    // NUMDOC
        cred.nro_pagare,                                             // NUMCRED
        String(cu.nro_cuota),                                        // NCUOTA
        fmtFechaBdcc(cu.fecha_vencimiento),                          // FECVEN
        cu.fecha_pago ? fmtFechaBdcc(cu.fecha_pago) : '00/00/0000', // FCAN
        fmtNumBdcc(cu.capital),                                      // CAPK
        fmtNumBdcc(cu.interes),                                      // INTK
        fmtNumBdcc(cu.capital_pagado),                               // CAPAGK
        fmtNumBdcc(cu.interes_pagado),                               // INTAGK
        fmtNumBdcc(recibo.iap),                                      // IAP
        String(dakc),                                                // DAKC
        fmtNumBdcc(sconk),                                           // SCONK
        fmtNumBdcc(sconint),                                         // SCONINT
        recibo.tipo_pago || 'A',                                     // TIPPAGO
      ])
    }

    if (rows.length === 1)
      warns.push(`ℹ No se encontraron cuotas pagadas en el período ${periodoLabel}.`)

    const dataRows = rows.length - 1
    downloadTxt(buildTxt(rows), `${COOPAC}_BD02A_${yyyymm}.txt`)
    setWarnings(warns)
    setRowCounts(prev => ({ ...prev, BD02A: dataRows }))
    setLoading(null)
  }

  // ── BD03A/BD03B ───────────────────────────────────────────────────────────

  function generarBD03A() {
    const txt = BD03_HDR.join('\t')
    downloadTxt(txt, `${COOPAC}_BD03A_${yyyymm}.txt`)
    setWarnings(['ℹ CEJUASSA indicó que no tiene garantías preferidas. BD03A generado con solo encabezado (mnemónicos).'])
    setRowCounts(prev => ({ ...prev, BD03A: 0 }))
  }

  function generarBD03B() {
    const txt = BD03_HDR.join('\t')
    downloadTxt(txt, `${COOPAC}_BD03B_${yyyymm}.txt`)
    setWarnings(['ℹ CEJUASSA indicó que no tiene garantías preferidas. BD03B generado con solo encabezado (mnemónicos).'])
    setRowCounts(prev => ({ ...prev, BD03B: 0 }))
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  function estadoBadge(e: string) {
    if (e === 'mvp')       return 'bg-green-100 text-green-800'
    if (e === 'header')    return 'bg-blue-100 text-blue-800'
    if (e === 'pendiente') return 'bg-gray-100 text-gray-500'
    return 'bg-gray-100 text-gray-500'
  }

  function estadoLabel(e: string) {
    if (e === 'mvp')       return 'Generable MVP'
    if (e === 'header')    return 'Solo encabezado'
    if (e === 'pendiente') return 'Pendiente'
    return e
  }

  function handleGenerar(code: string) {
    if (code === 'BD01')  return generarBD01()
    if (code === 'BD02A') return generarBD02A()
    if (code === 'BD03A') { generarBD03A(); return }
    if (code === 'BD03B') { generarBD03B(); return }
  }

  const esGenerable = (code: string) => ['BD01','BD02A','BD03A','BD03B'].includes(code)

  return (
    <div className="p-8 max-w-4xl">
      {/* ── Banner: fuera de alcance actual ── */}
      {BANNER_FUERA_ALCANCE && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ BDCC/TXT fuera de alcance actual
          </p>
          <p className="text-xs text-amber-700 mt-1">
            La cooperativa confirmó que el único reporte regulatorio activo será <strong>Anexo N°6</strong>.
            Esta pantalla queda archivada — <strong>no usar para entrega oficial</strong>.
          </p>
        </div>
      )}

      {/* encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">BDCC — Base de Datos de Cartera Crediticia</h1>
        <p className="text-sm text-gray-500 mt-1">
          Oficio SBS N°32791-2026 · Código COOPAC:{' '}
          <span className="font-mono font-bold text-gray-700">{COOPAC}</span>
          {' '}· Primera entrega: <span className="font-semibold text-red-600">20/07/2026</span>
        </p>
      </div>

      {/* Banner DEMO prominente — NO ENVIAR A SBS */}
      <div className="mb-5 p-4 rounded-lg border-2 border-red-400 bg-red-50 text-sm text-red-900">
        <p className="font-bold text-base mb-1">🚫 DEMO — DATOS NO OFICIALES — NO ENVIAR A SBS</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs mt-1">
          <li>Género (<strong>SEXO</strong>) y Estado Civil (<strong>ESTCIV</strong>) son valores temporales (todos M / soltero).</li>
          <li>Subtipo de crédito SBS (<strong>SUBTIPCRED</strong>): valor <strong>por_confirmar</strong> — no válido para envío.</li>
          <li>Tipo de crédito (<strong>TIPCRED</strong>): pendiente de confirmación con Créditos.</li>
          <li>Estos archivos son para revisión interna únicamente. No presentar a SBS hasta que los datos sean oficiales.</li>
        </ul>
      </div>

      {/* aviso de mnemonicos */}
      <div className="mb-5 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
        <strong>Borrador técnico.</strong> Mnemónicos basados en el plan SBS_BDCC_REPORTS_PLAN.md. Verificar contra el Oficio SBS N°32791-2026 antes de enviar.
      </div>

      {/* selector de período */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Período de corte</h2>
        <div className="flex gap-3 items-center flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mes</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Año</label>
            <select
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {buildYearOptions().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="pt-4">
            <span className="text-sm font-medium text-gray-700">
              Período seleccionado: <strong>{periodoLabel}</strong>
              {' '}— Código de archivo: <span className="font-mono text-blue-700">{yyyymm}</span>
            </span>
          </div>
        </div>
      </div>

      {/* estado de archivos + botones */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Archivos BDCC</h2>
        <div className="space-y-3">
          {ARCHIVOS.map(a => (
            <div key={a.code} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="w-20 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${estadoBadge(a.estado)}`}>
                  {estadoLabel(a.estado)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{a.label}</p>
                <p className="text-xs text-gray-500">{a.nota}</p>
                {(a.code === 'BD03A' || a.code === 'BD03B') && (
                  <p className="text-xs text-blue-600 mt-0.5">CEJUASSA indicó que no tiene garantías preferidas.</p>
                )}
                {rowCounts[a.code] !== undefined && (
                  <p className="text-xs text-green-700 font-medium mt-0.5">
                    Último generado: {rowCounts[a.code]} fila(s) de datos
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {esGenerable(a.code) ? (
                  <button
                    onClick={() => handleGenerar(a.code)}
                    disabled={loading !== null}
                    className="px-4 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: '#1E3A5F' }}
                  >
                    {loading === a.code ? 'Generando…' : `Descargar ${a.code}.txt`}
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">
                    Pendiente de información de Créditos
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* bloque pendientes */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-600 mb-2">BD02-B y BD04 — Pendiente de información de Créditos</h2>
        <p className="text-xs text-gray-500">
          BD02-B (cuotas pagadas de créditos cancelados) y BD04 (créditos cancelados) requieren
          el módulo de créditos cancelados, que no está implementado aún. Pendiente de confirmar
          con el área de Créditos el listado de cancelados y el tipo de pago K.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Nombre de archivo cuando estén listos: <span className="font-mono">{COOPAC}_BD02B_{yyyymm}.txt</span> y <span className="font-mono">{COOPAC}_BD04_{yyyymm}.txt</span>
        </p>
      </div>

      {/* advertencias */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Advertencias de validación</h3>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-800">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* advertencias permanentes */}
      <div className="mt-5 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-800">
        <strong>Advertencias permanentes para revisión antes de enviar a SBS:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>TPINT (campo tasa): usar tasa nominal anual — confirmar con Créditos si el campo actual es nominal o TEA.</li>
          <li>CCVE / CCJU: cuentas contables para capital vencido y judicial pendientes de confirmación con Contabilidad.</li>
          <li>TIPCRED / SUBTIPCRED: códigos SBS exactos pendientes de confirmación con Créditos (actual: valor ingresado en formulario de crédito).</li>
          <li>Género y estado civil: ingresar manualmente en módulo Socios → campos Género y Estado Civil.</li>
          <li>Histórico 2024/2025: fuera del alcance actual — proyecto futuro separado.</li>
        </ul>
      </div>
    </div>
  )
}
