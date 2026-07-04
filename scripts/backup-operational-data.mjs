/**
 * backup-operational-data.mjs
 * Fase 9C-1 — Backup de datos operativos antes de limpieza
 *
 * Este script NO borra nada. Solo exporta.
 * No imprime datos personales en consola — solo conteos y rutas.
 *
 * Uso: npm run backup:operational-data
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Cargar .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ No se encontró .env.local')
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
  console.error('❌ Faltan variables: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ── Tablas a exportar (orden FK-safe para referencia) ──────────────────────
const TABLAS_EXPORT = [
  'socios',
  'creditos',
  'pagos_recibos',
  'aportes',
  'cronograma_cuotas',
  'egresos',
  'convenios',
  'ampliaciones',  // puede no existir — se maneja con try/catch
]

// ── Timestamp para la carpeta ───────────────────────────────────────────────
function getTimestamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  )
}

// ── Exportar tabla con paginación ───────────────────────────────────────────
async function exportTable(tableName) {
  const PAGE_SIZE = 1000
  let allRows = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      if (error.code === '42P01') return { exists: false, count: 0, rows: [] }
      throw new Error(`Error exportando ${tableName}: ${error.message}`)
    }

    if (!data || data.length === 0) break
    allRows = allRows.concat(data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { exists: true, count: allRows.length, rows: allRows }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const timestamp = getTimestamp()
  const backupDir = join(ROOT, 'backups', 'data-reset', timestamp)
  mkdirSync(backupDir, { recursive: true })

  console.log('\n' + '═'.repeat(60))
  console.log('  CEJUASSA — Backup de Datos Operativos')
  console.log('  Fase 9C-1 — Solo exporta, NO borra nada.')
  console.log('═'.repeat(60))
  console.log(`\n📁 Carpeta: backups/data-reset/${timestamp}/\n`)

  const resultados = []
  let totalRegistros = 0

  for (const tabla of TABLAS_EXPORT) {
    process.stdout.write(`  Exportando ${tabla.padEnd(25)} ... `)
    const result = await exportTable(tabla)

    if (!result.exists) {
      console.log('(tabla no existe — omitida)')
      resultados.push({ tabla, existe: false, count: 0, archivo: null })
      continue
    }

    const archivo = join(backupDir, `${tabla}.json`)
    writeFileSync(archivo, JSON.stringify(result.rows, null, 2), 'utf8')
    totalRegistros += result.count
    console.log(`✅ ${result.count} registros → ${tabla}.json`)
    resultados.push({ tabla, existe: true, count: result.count, archivo: `${tabla}.json` })
  }

  // ── Crear BACKUP_MANIFEST.md ────────────────────────────────────────────
  const ahora = new Date().toISOString()
  const tablasMd = resultados
    .map(r =>
      `| \`${r.tabla}\` | ${r.existe ? '✅ exportada' : '⬜ no existe'} | ${r.count} |`
    )
    .join('\n')

  const manifest = `# BACKUP_MANIFEST.md
# Fase 9C-1 — Backup de Datos Operativos Pre-Reset
# Generado: ${ahora}
# Carpeta: backups/data-reset/${timestamp}/

> ⚠️ **Este backup NO incluye auth.users (administrado por Supabase).**
> Las tablas \`usuarios\` y \`configuracion\` NO fueron borradas y se conservan intactas.
> Este script NO ejecutó ningún DELETE ni TRUNCATE.

---

## Metadatos

| Campo | Valor |
|---|---|
| Fecha/hora | ${ahora} |
| Proyecto Supabase | ljdjbhsipgkxlgnprzhm |
| Total de registros exportados | ${totalRegistros} |
| Carpeta de backup | \`backups/data-reset/${timestamp}/\` |

---

## Tablas Exportadas

| Tabla | Estado | Registros |
|---|---|---|
${tablasMd}

---

## Tablas NO Incluidas (conservadas intactas)

| Tabla | Razón |
|---|---|
| \`auth.users\` | Administrado por Supabase Auth — NO exportable por API pública |
| \`usuarios\` | Conservada intacta — NO borrada en ningún paso |
| \`configuracion\` | Conservada intacta — NO borrada en ningún paso |

---

## Advertencias

- Este backup fue generado **ANTES** de cualquier borrado.
- Para restaurar: importar los JSON directamente en Supabase Table Editor o via SQL.
- El orden de recarga debe respetar FK: convenios → socios → creditos → cronograma_cuotas → pagos_recibos → aportes → egresos.
- **No ejecutar limpieza hasta verificar este backup con \`npm run check:operational-backup\`.**

---

*Backup Fase 9C-1. Ningún dato fue borrado al generar este backup.*
`

  const manifestPath = join(backupDir, 'BACKUP_MANIFEST.md')
  writeFileSync(manifestPath, manifest, 'utf8')

  // ── También guardar un BACKUP_MANIFEST.md en la raíz del proyecto ──────
  writeFileSync(join(ROOT, 'BACKUP_MANIFEST.md'), manifest, 'utf8')

  // ── Resumen ─────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log(`\n✅ Backup completado:`)
  console.log(`   📁 Ruta:     backups/data-reset/${timestamp}/`)
  console.log(`   📄 Manifest: backups/data-reset/${timestamp}/BACKUP_MANIFEST.md`)
  console.log(`   📦 Total:    ${totalRegistros} registros en ${resultados.filter(r => r.existe && r.count > 0).length} tablas con datos`)
  console.log('\n⚠️  NADA FUE BORRADO.')
  console.log('   Verificar con: npm run check:operational-backup\n')
  console.log('═'.repeat(60) + '\n')
}

main().catch(err => {
  console.error('\n❌ Error inesperado:', err.message)
  process.exit(1)
})
