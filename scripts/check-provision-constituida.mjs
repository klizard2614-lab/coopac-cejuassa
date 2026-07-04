import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TARGET = join(__dirname, '..', 'app', 'dashboard', 'reportes', 'anexo6', 'page.tsx')

const src = readFileSync(TARGET, 'utf-8')

const checks = [
  {
    id: 'type-provision-constituida',
    desc: 'FilaReporte tiene campo provision_constituida',
    pass: /provision_constituida\s*:\s*number/.test(src),
  },
  {
    id: 'type-provision-fuente',
    desc: 'FilaReporte tiene campo provision_constituida_fuente',
    pass: /provision_constituida_fuente\??\s*:/.test(src),
  },
  {
    id: 'assign-provision-constituida',
    desc: 'Existe asignación explícita de provision_constituida en el map de filas',
    pass: /provision_constituida\s*:\s*provision_requerida/.test(src),
  },
  {
    id: 'assign-fuente-criterio-confirmado',
    desc: 'Existe asignación de provision_constituida_fuente = criterio_contable_confirmado (B3 cerrado)',
    pass: /provision_constituida_fuente\s*:\s*['"]criterio_contable_confirmado['"]/.test(src),
  },
  {
    id: 'no-sin-fuente-contable',
    desc: 'No existe referencia a sin_fuente_contable en el código',
    pass: !/sin_fuente_contable/.test(src),
  },
  {
    id: 'html-uses-provision-constituida',
    desc: 'La celda HTML "Provisión Const." usa f.provision_constituida',
    pass: /fmt\(f\.provision_constituida\)/.test(src),
  },
  {
    id: 'html-no-direct-requerida-for-constituida',
    desc: 'La celda HTML no usa f.provision_requerida directamente para Provisión Const. (no dos celdas consecutivas con provision_requerida)',
    pass: !/>S\/ \{fmt\(f\.provision_requerida\)\}<\/td>[\s\S]{0,200}>S\/ \{fmt\(f\.provision_requerida\)\}<\/td>/.test(src),
  },
  {
    id: 'excel-uses-provision-constituida',
    desc: 'El export Excel usa f.provision_constituida para la columna Provisiones Constituidas',
    pass: /f\.provision_requerida,\s*\n\s*f\.provision_constituida,/.test(src),
  },
  {
    id: 'excel-no-double-requerida',
    desc: 'El export Excel no usa f.provision_requerida dos veces consecutivas',
    pass: !/f\.provision_requerida,\s*\n\s*f\.provision_requerida,/.test(src),
  },
  {
    id: 'nota-criterio-confirmado',
    desc: 'Existe nota de criterio contable confirmado en la UI',
    pass: /criterio confirmado por Contabilidad/i.test(src),
  },
]

let passed = 0
let failed = 0

console.log('\ncheck:provision:constituida — Anexo 6 B3 Resolución formal\n')

for (const c of checks) {
  if (c.pass) {
    console.log(`  ✓ ${c.desc}`)
    passed++
  } else {
    console.log(`  ✗ FAIL: ${c.desc}`)
    failed++
  }
}

console.log(`\n${passed}/${checks.length} checks passed`)

if (failed > 0) {
  console.log(`\n⚠ ${failed} check(s) fallaron. B3 no está cerrado correctamente.`)
  process.exit(1)
} else {
  console.log('\n✓ B3 RESUELTO: Provisiones Constituidas = Provisiones Requeridas por criterio contable confirmado. Sin placeholder, sin advertencia de falta de fuente, sin confirmación innecesaria.')
  process.exit(0)
}
