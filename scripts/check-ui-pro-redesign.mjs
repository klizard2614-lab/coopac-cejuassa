#!/usr/bin/env node
/**
 * check-ui-pro-redesign.mjs
 * Verifica que todas las pantallas de Fase UI-PRO-1 fueron migradas
 * al sistema de componentes nuevo (PageFrame, DetailHero, FormPanel, etc.).
 *
 * Run: node scripts/check-ui-pro-redesign.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Color helpers ──────────────────────────────────────────────────────────────
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`
const RED    = (s) => `\x1b[31m${s}\x1b[0m`
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`
const DIM    = (s) => `\x1b[2m${s}\x1b[0m`

// ── Helpers ────────────────────────────────────────────────────────────────────
function read(rel) {
  const abs = path.join(ROOT, rel)
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
}

function checkFile(rel, requirements) {
  const content = read(rel)
  if (!content) return { file: rel, status: 'MISSING', details: [] }

  const details = requirements.map(({ token, desc, required = true }) => ({
    token, desc, found: content.includes(token), required,
  }))

  const failures = details.filter(d => d.required && !d.found)
  return { file: rel, status: failures.length === 0 ? 'OK' : 'FAIL', details }
}

// ── Rules ─────────────────────────────────────────────────────────────────────

const listRules = (extra = []) => [
  { token: 'PageFrame',       desc: 'PageFrame wrapper' },
  { token: 'PageToolbar',     desc: 'PageToolbar header' },
  { token: 'DataTableShell',  desc: 'DataTableShell' },
  { token: 'DataTableHeader', desc: 'DataTableHeader' },
  { token: 'DataTableEmpty',  desc: 'DataTableEmpty' },
  { token: 'TableSkeleton',   desc: 'TableSkeleton loader' },
  ...extra,
]

const detailRules = (extra = []) => [
  { token: 'PageFrame',     desc: 'PageFrame wrapper' },
  { token: 'DetailHero',    desc: 'DetailHero header' },
  { token: 'DetailSection', desc: 'DetailSection' },
  { token: 'FieldGrid',     desc: 'FieldGrid' },
  { token: 'FieldItem',     desc: 'FieldItem' },
  ...extra,
]

const formPageRules = (extra = []) => [
  { token: 'PageFrame', desc: 'PageFrame wrapper' },
  { token: 'FormPanel', desc: 'FormPanel container' },
  ...extra,
]

const formComponentRules = () => [
  { token: 'FormPanel',   desc: 'FormPanel container' },
  { token: 'FormSection', desc: 'FormSection' },
  { token: 'ActionStrip', desc: 'ActionStrip' },
  { token: 'InlineAlert', desc: 'InlineAlert (replaces inline error divs)' },
  { token: 'btnPrimary',  desc: 'btnPrimary submit button' },
  { token: 'btnGhost',    desc: 'btnGhost cancel button' },
]

// ── All checks ─────────────────────────────────────────────────────────────────

const CHECKS = [
  // ui.tsx library
  checkFile('app/dashboard/_components/ui.tsx', [
    { token: 'export function PageFrame',       desc: 'PageFrame exported' },
    { token: 'export function PageToolbar',     desc: 'PageToolbar exported' },
    { token: 'export function FilterBar',       desc: 'FilterBar exported' },
    { token: 'export function DataTableShell',  desc: 'DataTableShell exported' },
    { token: 'export function DataTableHeader', desc: 'DataTableHeader exported' },
    { token: 'export function DataTableEmpty',  desc: 'DataTableEmpty exported' },
    { token: 'export function DetailHero',      desc: 'DetailHero exported' },
    { token: 'export function DetailSection',   desc: 'DetailSection exported' },
    { token: 'export function FieldGrid',       desc: 'FieldGrid exported' },
    { token: 'export function FieldItem',       desc: 'FieldItem exported' },
    { token: 'export function FormPanel',       desc: 'FormPanel exported' },
    { token: 'export function FormSection',     desc: 'FormSection exported' },
    { token: 'export function ActionStrip',     desc: 'ActionStrip exported' },
    { token: 'export function InlineAlert',     desc: 'InlineAlert exported' },
    { token: 'export function StatusBadge',     desc: 'StatusBadge exported' },
    { token: 'export function RecordMeta',      desc: 'RecordMeta exported' },
    { token: 'export const btnPrimary',         desc: 'btnPrimary constant' },
    { token: 'export const btnGhost',           desc: 'btnGhost constant' },
    { token: 'export const inputCls',           desc: 'inputCls constant' },
    { token: 'export const selectCls',          desc: 'selectCls constant' },
  ]),

  // List screens (Tarea 2)
  checkFile('app/dashboard/socios/page.tsx',       listRules([{ token: 'StatusBadge', desc: 'StatusBadge' }])),
  checkFile('app/dashboard/creditos/page.tsx',     listRules([{ token: 'StatusBadge', desc: 'StatusBadge' }])),
  checkFile('app/dashboard/pagos/page.tsx',        listRules([{ token: 'StatusBadge', desc: 'StatusBadge' }])),
  checkFile('app/dashboard/aportes/page.tsx',      listRules()),
  checkFile('app/dashboard/egresos/page.tsx',      listRules()),
  checkFile('app/dashboard/cartera/page.tsx',      listRules()),
  checkFile('app/dashboard/mora/page.tsx',         listRules()),
  checkFile('app/dashboard/convenios/page.tsx', [
    { token: 'PageFrame',       desc: 'PageFrame wrapper' },
    { token: 'PageToolbar',     desc: 'PageToolbar header' },
    { token: 'DataTableShell',  desc: 'DataTableShell' },
    { token: 'DataTableHeader', desc: 'DataTableHeader' },
    { token: 'DataTableEmpty',  desc: 'DataTableEmpty' },
    // TableSkeleton not needed: convenios uses card view, not table for loading state
  ]),
  checkFile('app/dashboard/ampliaciones/page.tsx', listRules()),

  // Detail screens (Tarea 3)
  checkFile('app/dashboard/socios/[id]/page.tsx',     detailRules()),
  checkFile('app/dashboard/creditos/[id]/page.tsx',   detailRules()),
  checkFile('app/dashboard/cartera/[id]/page.tsx',    detailRules()),
  // convenios/[id] is a list-style detail (table of pagos), no FieldGrid needed
  checkFile('app/dashboard/convenios/[id]/page.tsx', [
    { token: 'PageFrame',      desc: 'PageFrame wrapper' },
    { token: 'DetailHero',     desc: 'DetailHero header' },
    { token: 'DataTableShell', desc: 'DataTableShell for pagos table' },
  ]),
  checkFile('app/dashboard/aportes/[id]/page.tsx',    detailRules()),

  // Form pages (Tarea 4)
  // socios/nuevo delegates form rendering to SocioForm component (which has FormPanel)
  checkFile('app/dashboard/socios/nuevo/page.tsx', [
    { token: 'PageFrame',   desc: 'PageFrame wrapper' },
    { token: 'PageToolbar', desc: 'PageToolbar header' },
    { token: 'SocioForm',   desc: 'SocioForm component (contains FormPanel)' },
  ]),
  checkFile('app/dashboard/socios/[id]/editar/page.tsx',   formPageRules()),
  checkFile('app/dashboard/creditos/nuevo/page.tsx',       formPageRules()),
  checkFile('app/dashboard/creditos/[id]/editar/page.tsx', formPageRules()),
  checkFile('app/dashboard/pagos/nuevo/page.tsx',          formPageRules()),

  // SocioForm component
  checkFile('app/dashboard/socios/_components/SocioForm.tsx', formComponentRules()),

  // Reportes (Tarea 5)
  checkFile('app/dashboard/reportes/page.tsx', [
    { token: 'PageFrame',   desc: 'PageFrame wrapper' },
    { token: 'PageToolbar', desc: 'PageToolbar header' },
    { token: 'btnPrimary',  desc: 'btnPrimary links' },
  ]),

  // Usuarios / Configuración (Tarea 6)
  checkFile('app/dashboard/usuarios/page.tsx', [
    { token: 'PageFrame',      desc: 'PageFrame wrapper' },
    { token: 'PageToolbar',    desc: 'PageToolbar header' },
    { token: 'DataTableShell', desc: 'DataTableShell' },
    { token: 'StatusBadge',    desc: 'StatusBadge for rol/estado' },
  ]),
  checkFile('app/dashboard/configuracion/page.tsx', [
    { token: 'PageFrame',   desc: 'PageFrame wrapper' },
    { token: 'PageToolbar', desc: 'PageToolbar header' },
    { token: 'InlineAlert', desc: 'InlineAlert for save feedback' },
    { token: 'btnPrimary',  desc: 'btnPrimary save button' },
  ]),

  // Regulatory report should NOT be touched
  // (we only warn, not fail, because it was always excluded)
]

// ── Run ────────────────────────────────────────────────────────────────────────

let totalOk = 0
let totalFail = 0
let totalMissing = 0

console.log()
console.log(BOLD('── UI-PRO-1 Redesign Check ──────────────────────────────────'))
console.log()

for (const result of CHECKS) {
  if (result.status === 'MISSING') {
    totalMissing++
    console.log(`${YELLOW('MISSING')}  ${DIM(result.file)}`)
    continue
  }

  const failures = result.details.filter(d => d.required && !d.found)
  if (failures.length === 0) {
    totalOk++
    console.log(`${GREEN('  OK  ')}  ${result.file}`)
  } else {
    totalFail++
    console.log(`${RED(' FAIL ')}  ${result.file}`)
    for (const f of failures) {
      console.log(`         ${RED('x')} ${f.desc} ${DIM('(' + f.token + ')')}`)
    }
  }
}

console.log()
console.log(BOLD(`Results: ${GREEN(totalOk + ' OK')}  ${RED(totalFail + ' FAIL')}  ${YELLOW(totalMissing + ' MISSING')}`))
console.log()

if (totalFail > 0 || totalMissing > 0) {
  process.exit(1)
}
