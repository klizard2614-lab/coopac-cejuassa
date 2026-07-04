/**
 * plan-data-reset.mjs
 * Fase 9C-0 — Dry-run de plan de limpieza de datos
 *
 * Este script NO borra nada.
 * Solo audita las tablas y muestra el plan sugerido.
 *
 * Uso: npm run plan:data-reset
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Cargar .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ No se encontró .env.local — no se puede conectar a Supabase')
    process.exit(1)
  }
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ── Clasificación de tablas ─────────────────────────────────────────────────
const NO_BORRAR = ['usuarios', 'configuracion']

const OPERATIVAS = [
  { table: 'cronograma_cuotas', order: 1, reason: 'Cuotas de créditos — depende de creditos' },
  { table: 'ampliaciones',      order: 2, reason: 'Ampliaciones — depende de creditos (verificar FK)' },
  { table: 'aportes',           order: 3, reason: 'Aportes de socios — depende de socios y pagos_recibos' },
  { table: 'pagos_recibos',     order: 4, reason: 'Recibos de pago — depende de socios y creditos' },
  { table: 'creditos',          order: 5, reason: 'Créditos — depende de socios' },
  { table: 'egresos',           order: 6, reason: 'Egresos — FK opcional a socios' },
  { table: 'socios',            order: 7, reason: 'Socios — tabla raíz operativa' },
  { table: 'convenios',         order: 8, reason: 'Convenios — referenciados por socios' },
]

const REVISAR = [
  { table: 'auditoria',              reason: 'Log de acciones — puede tener valor histórico' },
  { table: 'cartera_mes',            reason: 'Cierres calculados — verificar si son prueba o reales' },
  { table: 'cartera_resumen_mes',    reason: 'Resumen de cartera — verificar si son prueba o reales' },
  { table: 'validacion_cuadre_mes',  reason: 'Validaciones de cierre — verificar' },
]

// ── Contar registros por tabla ──────────────────────────────────────────────
async function countTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    if (error) {
      if (error.code === '42P01') return { exists: false, count: 0 }
      return { exists: true, count: null, error: error.message }
    }
    return { exists: true, count: count ?? 0 }
  } catch {
    return { exists: false, count: 0 }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  CEJUASSA — Plan de Limpieza de Datos (DRY-RUN)')
  console.log('  Este script NO borra nada.')
  console.log('═'.repeat(60) + '\n')

  // Tablas protegidas
  console.log('🔒 TABLAS PROTEGIDAS (NO BORRAR):\n')
  for (const t of NO_BORRAR) {
    const result = await countTable(t)
    const countStr = result.exists
      ? `${result.count !== null ? result.count + ' registros' : '(error al contar)'}`
      : '(no existe)'
    console.log(`   ✅ ${t.padEnd(25)} → ${countStr}`)
  }

  console.log('\n' + '─'.repeat(60))
  console.log('\n📋 TABLAS OPERATIVAS (candidatas a limpiar):\n')
  console.log('   Orden | Tabla                     | Registros | Motivo')
  console.log('   ' + '─'.repeat(75))

  let totalRegistros = 0
  let tablasConDatos = 0

  for (const item of OPERATIVAS) {
    const result = await countTable(item.table)
    let countStr
    if (!result.exists) {
      countStr = '(no existe)'
    } else if (result.count === null) {
      countStr = `(error: ${result.error})`
    } else {
      countStr = `${result.count} registros`
      totalRegistros += result.count
      if (result.count > 0) tablasConDatos++
    }
    const existsIcon = !result.exists ? '⬜' : result.count === 0 ? '✅' : '⚠️ '
    console.log(`   ${String(item.order).padEnd(6)} | ${existsIcon} ${item.table.padEnd(23)} | ${countStr.padEnd(17)} | ${item.reason}`)
  }

  console.log('\n   ' + '─'.repeat(50))
  console.log(`   Total: ${totalRegistros} registros en ${tablasConDatos} tablas con datos`)

  console.log('\n' + '─'.repeat(60))
  console.log('\n🔍 TABLAS A REVISAR ANTES DE BORRAR:\n')

  for (const item of REVISAR) {
    const result = await countTable(item.table)
    let countStr
    if (!result.exists) {
      countStr = '(no existe en DB)'
    } else if (result.count === null) {
      countStr = `(error: ${result.error})`
    } else {
      countStr = `${result.count} registros`
    }
    const icon = !result.exists ? '⬜' : result.count === 0 ? '✅' : '❓'
    console.log(`   ${icon} ${item.table.padEnd(28)} → ${countStr}`)
    console.log(`      Motivo: ${item.reason}`)
  }

  console.log('\n' + '═'.repeat(60))
  console.log('\n📌 ORDEN SUGERIDO DE BORRADO:\n')
  console.log('   (No ejecutar sin autorización explícita)\n')
  for (const item of OPERATIVAS) {
    console.log(`   ${item.order}. DELETE FROM ${item.table};`)
  }
  console.log('\n   (opcionales según decisión):')
  for (const item of REVISAR) {
    console.log(`   ?. DELETE FROM ${item.table};   -- ${item.reason}`)
  }

  console.log('\n' + '═'.repeat(60))
  console.log('\n⛔ JAMÁS EJECUTAR:')
  console.log('   DELETE FROM usuarios;')
  console.log('   DELETE FROM configuracion;')
  console.log('   TRUNCATE auth.users;')
  console.log('   DROP TABLE ...;')

  console.log('\n📄 VER: docs/ai-recovery/DATA_RESET_PLAN.md')
  console.log('📄 VER: supabase/manual/data-reset-template.sql')
  console.log('\n' + '═'.repeat(60))

  if (tablasConDatos === 0) {
    console.log('\n✅ No hay datos operativos. La base está lista para recargar.')
  } else {
    console.log(`\n⚠️  Hay ${totalRegistros} registros en ${tablasConDatos} tablas.`)
    console.log('   Revisar el plan antes de ejecutar el borrado.')
  }
  console.log()
}

main().catch(err => {
  console.error('❌ Error inesperado:', err.message)
  process.exit(1)
})
