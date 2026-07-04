/**
 * check-tasa-interes-conversion.mjs
 * Fase 9C-6C.2 — Verifica que el script de conversión cumple todas las reglas de seguridad.
 * SOLO LECTURA de archivos — no modifica nada.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SCRIPT_PATH = resolve(ROOT, 'scripts/convert-tasa-interes-to-percent.mjs')
const REPORT_PATH = resolve(ROOT, 'docs/ai-recovery/TASA_INTERES_CONVERSION_DRY_RUN.md')

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

function checkNot(label, pattern, content, detail = '') {
  const found = content.includes(pattern)
  if (!found) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label} — encontrado: "${pattern}"${detail ? ' ' + detail : ''}`)
    failed++
  }
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Check: Conversión tasa_interes — Fase 9C-6C.2')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Existencia de archivos
  console.log('── Existencia de archivos ──')
  check('Script de conversión existe', existsSync(SCRIPT_PATH))
  check('Reporte dry-run existe', existsSync(REPORT_PATH))

  if (!existsSync(SCRIPT_PATH)) {
    console.log('\n❌ Script no encontrado — no se puede continuar el check.\n')
    process.exit(1)
  }

  const src = readFileSync(SCRIPT_PATH, 'utf8')

  // 2. Modos soportados
  console.log('\n── Modos soportados ──')
  check('Soporta --dry-run', src.includes('--dry-run') || src.includes('IS_DRY'))
  check('Soporta --apply', src.includes('--apply') || src.includes('IS_APPLY'))

  // 3. Guard de seguridad
  console.log('\n── Guards de seguridad ──')
  check('Usa guard tasa_interes < 1', src.includes('tasa_interes', 1) && src.includes('lt(') || src.includes("< 1") || src.includes('.lt('))
  check('Usa guard tasa_interes > 0', src.includes('.gt(') || src.includes('> 0'))
  check('Aborta si hay mezcla de formatos en apply', src.includes('ABORTADO') || src.includes('process.exit(1)'))

  // 4. Campos prohibidos — no debe tocar estos campos
  console.log('\n── Campos prohibidos (no debe tocar) ──')
  checkNot('No toca tipo_credito_sbs', "update({ tipo_credito_sbs", src)
  checkNot('No toca subtipo_credito_sbs', "update({ subtipo_credito_sbs", src)
  checkNot('No toca cuenta_contable_bd01', "update({ cuenta_contable_bd01", src)
  checkNot('No toca cronograma_cuotas', "from('cronograma_cuotas')", src.replace(/select.*cronograma_cuotas/g, ''))
  checkNot('No toca tabla usuarios', "from('usuarios')", src)
  checkNot('No toca tabla configuracion', "from('configuracion')", src)
  checkNot('No toca auth.users', 'auth.admin', src)

  // 5. Operaciones prohibidas
  console.log('\n── Operaciones prohibidas ──')
  checkNot('No crea migraciones', 'writeFileSync.*migrations', src)
  checkNot('No crea migraciones (supabase push)', 'supabase db push', src)
  checkNot('No regenera cronogramas (insert cuotas)', "insert.*cronograma_cuotas", src)
  checkNot('No toca _client_files', "resolve.*_client_files", src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, ''))

  // 6. La operación de update solo modifica tasa_interes
  console.log('\n── Operación de update ──')
  check('Update aplica tasa * 100', src.includes('* 100') || src.includes('tasa_interes * 100'))
  check('Update solo en tabla creditos', src.includes("from('creditos')") && src.includes('.update('))

  // 7. Reporte dry-run
  if (existsSync(REPORT_PATH)) {
    const report = readFileSync(REPORT_PATH, 'utf8')
    console.log('\n── Reporte dry-run ──')
    check('Reporte menciona créditos detectados', report.includes('Créditos detectados'))
    check('Reporte menciona guard WHERE tasa < 1', report.includes('tasa_interes < 1') || report.includes('WHERE tasa_interes'))
    check('Reporte confirma que cronograma no se toca', report.includes('Cronograma_cuotas tocado') || report.includes('cronograma'))
    check('Reporte tiene SQL de apply', report.includes('UPDATE creditos'))
    check('Reporte menciona autorización requerida', report.includes('CONVERTIR TASA A PORCENTAJE'))
  }

  // Resumen
  const total = passed + failed
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  RESULTADO: ${passed}/${total} checks pasaron`)
  if (failed === 0) {
    console.log('  ✅ Todos los checks PASSED — script seguro para usar')
  } else {
    console.log(`  ❌ ${failed} checks FAILED — revisar antes de ejecutar apply`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌ Error fatal:', e.message); process.exit(1) })
