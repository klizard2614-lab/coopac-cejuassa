/**
 * dry-run-regenerate-cronogramas.mjs
 * Fase 9C-6C — Dry-run: simula regeneración de cronograma_cuotas para créditos vigentes.
 *
 * REGLAS ESTRICTAS — SOLO LECTURA:
 * - NO insert / NO update / NO delete / NO truncate
 * - NO toca usuarios / configuracion / auth.users
 * - NO modifica _client_files/
 * - NO crea migraciones
 * - NO imprime datos personales completos
 * - Solo lectura, simulación y reporte
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery')

// ─── Env ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return false
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
  return true
}

if (!loadEnv()) { console.error('❌ .env.local no encontrado'); process.exit(1) }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ─── Fórmula (sistema francés — idéntica a creditos/nuevo/page.tsx) ───────────

function round2(n) {
  return Math.round(n * 100) / 100
}

function calcCuota(principal, tasaAnual, plazo) {
  if (!principal || !plazo) return 0
  const r = tasaAnual / 100 / 12
  if (r === 0) return principal / plazo
  const factor = Math.pow(1 + r, plazo)
  return (principal * r * factor) / (factor - 1)
}

function addMonths(fechaStr, months) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const newYear = y + Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function simularCronograma(credito) {
  const { monto_aprobado: monto, tasa_interes: tasa, plazo_meses: plazo, fecha_desembolso } = credito
  const cuotaMensual = round2(calcCuota(monto, tasa, plazo))
  const r = tasa / 100 / 12
  let saldo = monto
  const cuotas = []

  for (let i = 1; i <= plazo; i++) {
    const interes = round2(saldo * r)
    let capital, cuotaTotal

    if (i === plazo) {
      capital = round2(saldo)
      cuotaTotal = round2(capital + interes)
    } else {
      capital = round2(cuotaMensual - interes)
      cuotaTotal = cuotaMensual
    }

    saldo = round2(saldo - capital)

    cuotas.push({
      nro_cuota: i,
      fecha_vencimiento: addMonths(fecha_desembolso, i),
      capital,
      interes,
      cuota_total: cuotaTotal,
      capital_pagado: 0,
      interes_pagado: 0,
      estado: 'pendiente',
    })
  }

  const totalCapitalSimulado = round2(cuotas.reduce((s, c) => s + c.capital, 0))
  const difVsMonto = round2(totalCapitalSimulado - monto)
  const difVsSaldo = round2(totalCapitalSimulado - credito.saldo_capital)

  return { cuotaMensual, cuotas, totalCapitalSimulado, difVsMonto, difVsSaldo }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Fase 9C-6C — Dry-run regeneración cronograma_cuotas')
  console.log('  SOLO LECTURA — No se insertará ningún dato')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Verificar que cronograma_cuotas está vacío
  const { count: countCronograma, error: errCron } = await sb
    .from('cronograma_cuotas')
    .select('*', { count: 'exact', head: true })
  if (errCron) { console.error('❌ Error leyendo cronograma_cuotas:', errCron.message); process.exit(1) }
  console.log(`📋 cronograma_cuotas actual: ${countCronograma} registros`)

  // 2. Leer todos los créditos (sin datos personales en consola)
  const { data: todosCreditos, error: errCred } = await sb
    .from('creditos')
    .select('id, estado, monto_aprobado, saldo_capital, tasa_interes, plazo_meses, fecha_desembolso, cuota_mensual')
    .order('id')

  if (errCred) { console.error('❌ Error leyendo créditos:', errCred.message); process.exit(1) }

  const total = todosCreditos.length
  const vigentes = todosCreditos.filter(c => c.estado === 'vigente')
  const cancelados = todosCreditos.filter(c => c.estado === 'cancelado')

  console.log(`\n📊 Créditos totales: ${total}`)
  console.log(`   Vigentes:  ${vigentes.length}`)
  console.log(`   Cancelados: ${cancelados.length}`)

  // 3. Clasificar elegibles vs no elegibles
  const elegibles = []
  const noElegibles = []

  for (const c of vigentes) {
    const razones = []
    if (!c.monto_aprobado || c.monto_aprobado <= 0) razones.push('monto_aprobado=0 o NULL')
    if (!c.plazo_meses || c.plazo_meses <= 0) razones.push('plazo_meses=0 o NULL')
    if (!c.fecha_desembolso) razones.push('fecha_desembolso=NULL')
    if (!c.tasa_interes || c.tasa_interes <= 0) razones.push('tasa_interes=0 o NULL')

    if (razones.length > 0) {
      const idS = String(c.id)
      noElegibles.push({ id: idS.length > 6 ? idS.substring(0, 6) + '****' : idS + '****', razones })
    } else {
      elegibles.push(c)
    }
  }

  console.log(`\n✅ Elegibles para simulación: ${elegibles.length}`)
  console.log(`❌ No elegibles:              ${noElegibles.length}`)

  if (noElegibles.length > 0) {
    console.log('\n   Créditos no elegibles:')
    for (const ne of noElegibles) {
      console.log(`   - ID ${ne.id}: ${ne.razones.join(', ')}`)
    }
  }

  // 4. Simular cronogramas
  console.log('\n🔄 Simulando cronogramas...\n')

  const resultados = []
  let totalCuotasEsperadas = 0

  for (const c of elegibles) {
    const sim = simularCronograma(c)
    totalCuotasEsperadas += sim.cuotas.length

    const idStr = String(c.id)
    const idMask = idStr.length > 6 ? idStr.substring(0, 6) + '****' : idStr + '****'
    const estado = Math.abs(sim.difVsMonto) < 0.05 ? '✅' : '⚠️'
    console.log(
      `  ${estado} ID ${idMask} | ` +
      `Monto: S/${c.monto_aprobado.toFixed(2)} | ` +
      `Plazo: ${c.plazo_meses}m | ` +
      `Tasa: ${c.tasa_interes}% | ` +
      `Cuotas: ${sim.cuotas.length} | ` +
      `ΣCapital: S/${sim.totalCapitalSimulado.toFixed(2)} | ` +
      `ΔMonto: S/${sim.difVsMonto.toFixed(2)} | ` +
      `ΔSaldo: S/${sim.difVsSaldo.toFixed(2)}`
    )

    resultados.push({
      id: c.id,
      estado_credito: c.estado,
      monto_aprobado: c.monto_aprobado,
      saldo_capital: c.saldo_capital,
      tasa_interes: c.tasa_interes,
      plazo_meses: c.plazo_meses,
      fecha_desembolso: c.fecha_desembolso,
      cuota_mensual_calculada: sim.cuotaMensual,
      cuota_mensual_db: c.cuota_mensual,
      num_cuotas: sim.cuotas.length,
      total_capital_simulado: sim.totalCapitalSimulado,
      dif_vs_monto: sim.difVsMonto,
      dif_vs_saldo: sim.difVsSaldo,
      primera_vencimiento: sim.cuotas[0]?.fecha_vencimiento,
      ultima_vencimiento: sim.cuotas[sim.cuotas.length - 1]?.fecha_vencimiento,
    })
  }

  console.log(`\n📈 Total cuotas esperadas: ${totalCuotasEsperadas}`)

  // 5. Resumen de diferencias
  const sinDif = resultados.filter(r => Math.abs(r.dif_vs_monto) < 0.05)
  const conDif = resultados.filter(r => Math.abs(r.dif_vs_monto) >= 0.05)
  const saldoMenor = resultados.filter(r => r.saldo_capital < r.monto_aprobado - 0.01)

  console.log(`\n📊 Resumen de simulación:`)
  console.log(`   ΣCapital ≈ Monto (desfase < S/0.05): ${sinDif.length}`)
  console.log(`   ΣCapital ≠ Monto (desfase ≥ S/0.05): ${conDif.length}`)
  console.log(`   Saldo < Monto (posibles pagos anteriores): ${saldoMenor.length}`)

  // 6. Generar reporte markdown
  const hoy = new Date().toISOString().split('T')[0]
  const lines = []

  lines.push('# CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md')
  lines.push('# Reporte Dry-Run — Regeneración cronograma_cuotas')
  lines.push(`# Generado: ${hoy} — Fase 9C-6C`)
  lines.push('')
  lines.push('> SOLO LECTURA — No se insertó ningún dato.')
  lines.push('> Apply real requiere autorización explícita (Fase 9C-6D).')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Conteos actuales')
  lines.push('')
  lines.push(`| Tabla | Registros |`)
  lines.push(`|---|---|`)
  lines.push(`| \`creditos\` totales | ${total} |`)
  lines.push(`| \`creditos\` vigentes | ${vigentes.length} |`)
  lines.push(`| \`creditos\` cancelados | ${cancelados.length} |`)
  lines.push(`| \`cronograma_cuotas\` | ${countCronograma} |`)
  lines.push('')
  lines.push('## Clasificación de créditos vigentes')
  lines.push('')
  lines.push(`| Categoría | Cantidad |`)
  lines.push(`|---|---|`)
  lines.push(`| Elegibles para cronograma | **${elegibles.length}** |`)
  lines.push(`| No elegibles | **${noElegibles.length}** |`)
  lines.push(`| Total cuotas esperadas | **${totalCuotasEsperadas}** |`)
  lines.push('')

  if (noElegibles.length > 0) {
    lines.push('## Créditos no elegibles')
    lines.push('')
    lines.push('| ID (parcial) | Razón |')
    lines.push('|---|---|')
    for (const ne of noElegibles) {
      lines.push(`| ${ne.id} | ${ne.razones.join('; ')} |`)
    }
    lines.push('')
  }

  lines.push('## Simulación por crédito elegible')
  lines.push('')
  lines.push('| ID (parcial) | Monto | Saldo | Tasa% | Plazo | Cuotas | ΣCapital | ΔMonto | ΔSaldo | 1ª Venc. | Última Venc. |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of resultados) {
    const rIdStr = String(r.id)
    const idMask = rIdStr.length > 6 ? rIdStr.substring(0, 6) + '****' : rIdStr + '****'
    const ok = Math.abs(r.dif_vs_monto) < 0.05 ? '✅' : '⚠️'
    lines.push(
      `| ${ok} ${idMask} | S/${r.monto_aprobado.toFixed(2)} | S/${r.saldo_capital.toFixed(2)} | ` +
      `${r.tasa_interes}% | ${r.plazo_meses}m | ${r.num_cuotas} | ` +
      `S/${r.total_capital_simulado.toFixed(2)} | S/${r.dif_vs_monto.toFixed(2)} | ` +
      `S/${r.dif_vs_saldo.toFixed(2)} | ${r.primera_vencimiento} | ${r.ultima_vencimiento} |`
    )
  }

  lines.push('')
  lines.push('## Resumen de coherencia')
  lines.push('')
  lines.push(`| Indicador | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| ΣCapital ≈ Monto (desfase < S/0.05) | ${sinDif.length} / ${elegibles.length} |`)
  lines.push(`| ΣCapital ≠ Monto (desfase ≥ S/0.05) | ${conDif.length} / ${elegibles.length} |`)
  lines.push(`| Saldo capital < Monto (posibles pagos sin cronograma) | ${saldoMenor.length} / ${elegibles.length} |`)
  lines.push('')
  lines.push('## Riesgos identificados')
  lines.push('')
  lines.push('1. **R1 — pagos sin id_credito:** 832 pagos tienen `id_credito = NULL`. El cronograma regenerado marcará todas las cuotas como `pendiente`. Las cuotas realmente pagadas no quedarán reflejadas hasta que se vincule `id_credito` en pagos (Fase futura).')
  lines.push('2. **R2 — saldo_capital < monto_aprobado:** Si el saldo fue reducido por pagos previos, el cronograma regenerado no coincide con el estado real del crédito.')
  lines.push('3. **R3 — cuotas con fecha pasada:** Cuotas con `fecha_vencimiento < hoy` quedan como `pendiente`; la app las detecta como vencidas por lógica de fecha.')
  lines.push('4. **R4 — doble apply:** Si el script de apply se ejecuta dos veces, habrá cuotas duplicadas. Debe verificarse que `cronograma_cuotas` esté vacío para el crédito antes de insertar.')
  lines.push('')
  lines.push('## Conclusión')
  lines.push('')
  lines.push(`- **${elegibles.length}** créditos vigentes están listos para regenerar cronograma.`)
  lines.push(`- **${noElegibles.length}** créditos no son elegibles.`)
  lines.push(`- **${totalCuotasEsperadas}** cuotas se insertarían en el apply.`)
  lines.push(`- La fórmula produce cronogramas coherentes (ΣCapital ≈ Monto en ${sinDif.length}/${elegibles.length} créditos).`)
  lines.push('')
  lines.push('## Próxima fase')
  lines.push('')
  lines.push('**Fase 9C-6D — Apply:** Crear script `scripts/apply-regenerate-cronogramas.mjs` con:')
  lines.push('- Guardas: verificar que `cronograma_cuotas` esté vacío para cada crédito antes de insertar')
  lines.push('- Flag `--dry-run` por defecto; `--apply` requiere `CEJUASSA_ALLOW_CRONOGRAMA_APPLY=true`')
  lines.push('- Insertar cuotas en lotes (no una a una) para eficiencia')
  lines.push('- Generar log de cuotas insertadas por crédito')
  lines.push('- **No ejecutar sin autorización explícita del usuario**')

  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })
  const reportPath = resolve(DOCS_DIR, 'CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md')
  writeFileSync(reportPath, lines.join('\n'), 'utf8')

  console.log(`\n📄 Reporte generado: docs/ai-recovery/CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md`)
  console.log('\n✅ Dry-run completado. No se insertó ningún dato.')
  console.log('   Para el apply real, esperar Fase 9C-6D con autorización explícita.\n')
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
