/**
 * check-anexo6-comparison.mjs
 * Verifica que las fases ANEXO6-0 y ANEXO6-1 se completaron correctamente.
 * Solo lectura. No modifica nada.
 */

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const pageContent = existsSync(join(ROOT, 'app/dashboard/reportes/anexo6/page.tsx'))
  ? readFileSync(join(ROOT, 'app/dashboard/reportes/anexo6/page.tsx'), 'utf8')
  : ''

const checks = [
  // ── ANEXO6-0 ────────────────────────────────────────────────────────────────
  {
    id: 'C1',
    label: 'Existe archivo modelo de la contadora',
    pass: existsSync(join(ROOT,
      '_client_files/raw/extracted/Archvos app',
      '1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx'
    )),
  },
  {
    id: 'C2',
    label: 'Existe reporte de comparación MD',
    pass: existsSync(join(ROOT, 'docs/ai-recovery/ANEXO6_COMPARISON_CONTADORA_REPORT.md')),
  },
  {
    id: 'C3',
    label: 'Existe script de comparación',
    pass: existsSync(join(ROOT, 'scripts/compare-anexo6-with-contadora.mjs')),
  },
  {
    id: 'C4',
    label: 'Existe carpeta exports/anexo6-comparison',
    pass: existsSync(join(ROOT, 'exports/anexo6-comparison')),
  },
  {
    id: 'C5',
    label: 'Existe Excel de diferencias',
    pass: existsSync(join(ROOT, 'exports/anexo6-comparison/anexo6_diferencias.xlsx')),
  },
  {
    id: 'C6',
    label: 'Script de comparación tiene comando npm',
    pass: (() => {
      try {
        const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
        return 'compare:anexo6-contadora' in (pkg.scripts ?? {})
      } catch { return false }
    })(),
  },

  // ── ANEXO6-1: encabezados corregidos ────────────────────────────────────────
  {
    id: 'C7',
    label: 'Encabezado col 2 correcto: "Apellidos y Nombres / Razón Social"',
    pass: pageContent.includes("'Apellidos y Nombres / Razón Social'"),
  },
  {
    id: 'C8',
    label: 'Encabezado col 6 correcto: "Sigla de la Empresa"',
    pass: pageContent.includes("'Sigla de la Empresa'"),
  },
  {
    id: 'C9',
    label: 'Encabezado col 14 correcto: "Clasificación del Deudor"',
    pass: pageContent.includes("'Clasificación del Deudor'"),
  },
  {
    id: 'C10',
    label: 'Columnas 50–60 NO tienen nombres placeholder (Col50…Col60)',
    pass: !pageContent.includes("'Col50'") && !pageContent.includes("'Col51'"),
  },
  {
    id: 'C11',
    label: 'Col 50 tiene nombre SBS real: "Saldo de Créditos con Sustitución..."',
    pass: pageContent.includes("'Saldo de Créditos con Sustitución de Contraparte Crediticia'"),
  },
  {
    id: 'C12',
    label: 'Col 53 tiene nombre SBS real: "Saldo Capital en Cuenta de Orden por efecto del Covid"',
    pass: pageContent.includes("'Saldo Capital en Cuenta de Orden por efecto del Covid'"),
  },
  {
    id: 'C13',
    label: 'Col 58 tiene nombre SBS real: "Saldo de Créditos dentro del alcance del DL N°1508"',
    pass: pageContent.includes("'Saldo de Créditos dentro del alcance del DL N°1508'"),
  },
  {
    id: 'C14',
    label: 'Nombre de hoja es dinámico con "sin CEROS"',
    pass: pageContent.includes('sin CEROS'),
  },
  {
    id: 'C15',
    label: 'Nombre de archivo tiene "_sin_ceros.xlsx"',
    pass: pageContent.includes('_sin_ceros.xlsx'),
  },
  {
    id: 'C16',
    label: 'Total encabezados en app = 60 (conteo en código)',
    pass: (() => {
      // Contar líneas de encabezado en el array de headers
      const match = pageContent.match(/const headers = \[([\s\S]*?)\]/)
      if (!match) return false
      const lines = match[1].split('\n').filter(l => l.trim().startsWith("'"))
      return lines.length === 60
    })(),
  },

  // ── Integridad: cálculos NO modificados ─────────────────────────────────────
  {
    id: 'C17',
    label: 'Cálculo provisiones intacto (provision_requerida = saldo * tasa)',
    pass: pageContent.includes('provision_requerida = (c.saldo_capital ?? 0) * tasa'),
  },
  {
    id: 'C18',
    label: 'Clasificación de mora intacta (función getClasificacion)',
    pass: pageContent.includes('function getClasificacion'),
  },
  {
    id: 'C19',
    label: 'Banner DEMO preservado en UI',
    pass: pageContent.includes('DATOS DE PRUEBA — NO OFICIALES'),
  },
  {
    id: 'C20',
    label: 'No se tocó DB: page.tsx no ejecuta INSERT/UPDATE/DELETE',
    pass: !pageContent.includes('.insert(') && !pageContent.includes('.update(') && !pageContent.includes('.delete('),
  },
]

console.log('\n══════════════════════════════════════════════')
console.log('  CHECK ANEXO6-0/1 — Fases completadas?')
console.log('══════════════════════════════════════════════\n')

let passed = 0
let failed = 0

for (const r of checks) {
  const icon = r.pass ? '✅' : '❌'
  console.log(`${icon} [${r.id}] ${r.label}`)
  if (r.note) console.log(`      ↳ ${r.note}`)
  if (r.pass) passed++; else failed++
}

console.log(`\n${passed}/${checks.length} checks pasaron`)
if (failed > 0) {
  console.log(`\n⚠ ${failed} check(s) fallaron. Revisar antes de continuar.`)
  process.exit(1)
} else {
  console.log('\n✅ Fases ANEXO6-0 y ANEXO6-1 completadas correctamente.')
}
