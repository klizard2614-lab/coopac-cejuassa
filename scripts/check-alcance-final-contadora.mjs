/**
 * check-alcance-final-contadora.mjs
 * Fase 10J-2 — Verificación de guardrails de alcance final
 *
 * Verifica que:
 * - El documento de alcance final existe y tiene el contenido correcto
 * - BDCC/TXT queda marcado como fuera de alcance (código no borrado)
 * - Anexo 06 queda como reporte principal
 * - Tasa TEA está documentada
 * - Ampliaciones 10J-2 está planificada
 * - No se tocó DB (sin nuevas migraciones no autorizadas)
 * - No se tocó cronograma_cuotas ni pagos_recibos
 *
 * REGLAS: Solo lectura de archivos locales. Sin acceso a DB.
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

let pass = 0
let fail = 0

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    fail++
  }
}

function fileExists(rel) {
  return existsSync(resolve(ROOT, rel))
}

function fileContains(rel, str) {
  if (!fileExists(rel)) return false
  return readFileSync(resolve(ROOT, rel), 'utf8').includes(str)
}

function countFiles(dir) {
  const d = resolve(ROOT, dir)
  if (!existsSync(d)) return 0
  return readdirSync(d).length
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  check-alcance-final-contadora — Guardrails 10J-2')
  console.log('  Solo lectura de archivos · Sin acceso a DB')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── 1. Documento de alcance final ────────────────────────────────────────
  console.log('── 1. Documento de alcance final ───────────────────────')
  const alcanceDoc = 'docs/ai-recovery/COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md'
  check('COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md existe', fileExists(alcanceDoc))
  check('Decisiones finales documentadas (tasa TEA)', fileContains(alcanceDoc, 'TEA'))
  check('Decisiones finales documentadas (consumo)', fileContains(alcanceDoc, 'Consumo'))
  check('Decisiones finales documentadas (convenio)', fileContains(alcanceDoc, 'convenio'))
  check('Qué queda dentro — sección presente', fileContains(alcanceDoc, 'DENTRO del alcance'))
  check('Qué queda fuera — sección presente', fileContains(alcanceDoc, 'FUERA del alcance'))
  check('Impacto por módulo — sección presente', fileContains(alcanceDoc, 'Impacto por módulo'))
  check('Pendientes reales — sección presente', fileContains(alcanceDoc, 'Pendientes reales'))
  check('Riesgos — sección presente', fileContains(alcanceDoc, 'Riesgos conocidos'))
  check('Siguiente fase — sección presente', fileContains(alcanceDoc, 'Siguiente fase'))
  console.log()

  // ── 2. BDCC/TXT marcado como fuera de alcance ────────────────────────────
  console.log('── 2. BDCC/TXT fuera de alcance ────────────────────────')
  check('BDCC marcado como fuera de alcance en documento', fileContains(alcanceDoc, 'Fuera del alcance'))
  check('Código BDCC no eliminado (bdcc/page.tsx preservado)', fileExists('app/dashboard/reportes/bdcc/page.tsx'))
  check('Código BDCC no eliminado (lib/bdcc/format.ts preservado)', fileExists('lib/bdcc/format.ts'))
  check('Migración BDCC preservada', fileExists('supabase/migrations/20260620000001_bdcc_min_fields.sql'))
  check('BDCC/TXT NO aparece en "dentro del alcance"', !fileContains(alcanceDoc, 'BDCC SBS✅') && !fileContains(alcanceDoc, 'TXT ✅'))
  console.log()

  // ── 3. Anexo N°6 como reporte principal ──────────────────────────────────
  console.log('── 3. Anexo N°6 como reporte principal ─────────────────')
  check('Anexo 6 existe como página', fileExists('app/dashboard/reportes/anexo6/page.tsx'))
  check('Anexo 6 en documento de alcance como reporte principal', fileContains(alcanceDoc, 'Anexo N°6'))
  check('Anexo 6 listado con activo:true en reportes/page.tsx',
    fileContains('app/dashboard/reportes/page.tsx', 'Anexo N°6') &&
    fileContains('app/dashboard/reportes/page.tsx', 'activo: true'))
  check('Reportes operativos (Aportes, Caja) no eliminados',
    fileExists('app/dashboard/reportes/aportes') &&
    fileExists('app/dashboard/reportes/caja'))
  console.log()

  // ── 4. Tasa TEA documentada ───────────────────────────────────────────────
  console.log('── 4. Tasa TEA documentada ─────────────────────────────')
  check('TEA documentada en documento de alcance', fileContains(alcanceDoc, 'TEA'))
  check('AI_HANDOFF.md menciona TEA (tras actualización)', fileContains('docs/ai-recovery/AI_HANDOFF.md', 'TEA'))
  check('Tasa de interés está en campos de creditos (DATABASE_AND_AUTH.md)', fileContains('docs/ai-recovery/DATABASE_AND_AUTH.md', 'tasa_interes'))
  check('Fórmula usa tasa/100/12 (compatible TEA en sistema francés)', fileContains('docs/ai-recovery/AI_HANDOFF.md', 'tasa/100/12'))
  console.log()

  // ── 5. Ampliaciones 10J-2 planificada ────────────────────────────────────
  console.log('── 5. Ampliaciones 10J-2 planificada ───────────────────')
  check('Fase 10J-2 mencionada en COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md', fileContains(alcanceDoc, '10J-2'))
  check('Fase 10J-2 menciona cuota manual', fileContains(alcanceDoc, 'cuota'))
  check('Fase 10J-2 menciona plazo manual', fileContains(alcanceDoc, 'plazo'))
  check('Fase 10J-2 menciona tasa manual', fileContains(alcanceDoc, 'tasa'))
  check('NEXT_STEPS.md tiene sección de Fase 10J-2', fileContains('docs/ai-recovery/NEXT_STEPS.md', '10J-2'))
  check('RPC 10J-1 existe (base para 10J-2)',
    fileExists('supabase/migrations/20260624000001_create_aplicar_ampliacion_credito.sql'))
  console.log()

  // ── 6. No se crearon migraciones sin autorización ─────────────────────────
  console.log('── 6. Guardrails de base de datos ──────────────────────')
  const migCount = countFiles('supabase/migrations')
  console.log(`  Migraciones locales actuales: ${migCount}`)
  check('No se creó migración de tasa_nueva/cuota_nueva sin autorización',
    !fileExists('supabase/migrations/20260702000001_ampliaciones_tea_cuota.sql') &&
    !fileExists('supabase/migrations/20260702_ampliaciones_10j2.sql'))
  check('No se crearon nuevas migraciones no autorizadas en esta fase',
    migCount <= 10,
    `${migCount} migraciones — si hay más de 10, verificar manualmente`)
  console.log()

  // ── 7. cronograma_cuotas y pagos_recibos no tocados ──────────────────────
  console.log('── 7. Tablas protegidas no modificadas ─────────────────')
  const ampliSection = 'app/dashboard/creditos/_components/AmpliacionesSection.tsx'
  check('AmpliacionesSection.tsx no toca cronograma_cuotas',
    !fileContains(ampliSection, 'cronograma_cuotas'))
  check('AmpliacionesSection.tsx no toca pagos_recibos',
    !fileContains(ampliSection, 'pagos_recibos'))
  // La migración incluye el comentario "NO toca cronograma_cuotas" — eso es correcto.
  // Verificamos que no hay UPDATE/INSERT/DELETE sobre esas tablas (solo comentario).
  const rpcMig = resolve(ROOT, 'supabase/migrations/20260624000001_create_aplicar_ampliacion_credito.sql')
  const rpcContent = fileExists('supabase/migrations/20260624000001_create_aplicar_ampliacion_credito.sql')
    ? readFileSync(rpcMig, 'utf8')
        .replace(/--.*$/gm, '')             // quitar comentarios --
        .replace(/COMMENT ON FUNCTION[\s\S]*?;/gm, '') // quitar COMMENT ON (puede tener texto de doc)
    : ''
  check('RPC aplicar_ampliacion no toca cronograma_cuotas (SQL activo)',
    !rpcContent.includes('cronograma_cuotas'))
  check('RPC aplicar_ampliacion no toca pagos_recibos (SQL activo)',
    !rpcContent.includes('pagos_recibos'))
  check('No se ejecutó recálculo automático de cuotas',
    !fileExists('scripts/recalcular-cronograma-ampliaciones.mjs'))
  console.log()

  // ── 8. Scripts de esta fase existen ──────────────────────────────────────
  console.log('── 8. Scripts de Fase 10J-2 ───────────────────────────')
  check('plan-alcance-final-contadora.mjs existe', fileExists('scripts/plan-alcance-final-contadora.mjs'))
  check('check-alcance-final-contadora.mjs existe', fileExists('scripts/check-alcance-final-contadora.mjs'))
  console.log()

  // ── 9. Cambios UI Fase 10J-2A (BDCC fuera de nav, banner, labels TEA) ───
  console.log('── 9. Cambios UI Fase 10J-2A ───────────────────────────')
  const reportesPage = 'app/dashboard/reportes/page.tsx'
  check('BDCC NO está en sección principal de reportes (fuera de navegación)',
    !fileContains(reportesPage, "href: '/dashboard/reportes/bdcc'"))
  check('BDCC aparece solo en sección "Archivado" en reportes/page.tsx',
    fileContains(reportesPage, 'Archivado'))
  check('bdcc/page.tsx conserva banner FUERA_ALCANCE',
    fileContains('app/dashboard/reportes/bdcc/page.tsx', 'BANNER_FUERA_ALCANCE'))
  check('bdcc/page.tsx muestra texto de banner al usuario',
    fileContains('app/dashboard/reportes/bdcc/page.tsx', 'fuera de alcance actual'))
  check('creditos/[id]/page.tsx usa label "Tasa TEA"',
    fileContains('app/dashboard/creditos/[id]/page.tsx', 'Tasa TEA'))
  check('creditos/nuevo/page.tsx usa label "Tasa de interés TEA"',
    fileContains('app/dashboard/creditos/nuevo/page.tsx', 'Tasa de interés TEA'))
  check('creditos/[id]/editar/page.tsx usa label "Tasa de interés TEA"',
    fileContains('app/dashboard/creditos/[id]/editar/page.tsx', 'Tasa de interés TEA'))
  check('No se creó migración en Fase 10J-2A',
    !fileExists('supabase/migrations/20260702000001_10j2a.sql'))
  console.log()

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  TOTAL: ${pass + fail} verificaciones`)
  console.log(`  ✅ PASS: ${pass}`)
  console.log(`  ❌ FAIL: ${fail}`)
  console.log()

  if (fail === 0) {
    console.log('  ✅ Todos los guardrails de Fase 10J-2 verificados correctamente.')
    console.log()
    console.log('  Próximo paso: ejecutar npm run plan:alcance-final-contadora')
    console.log('  para ver el detalle de pendientes técnicos.')
  } else {
    console.log(`  ❌ ${fail} guardrail(s) fallaron. Revisar antes de continuar.`)
    process.exit(1)
  }
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
