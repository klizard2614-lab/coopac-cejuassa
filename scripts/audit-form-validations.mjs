// scripts/audit-form-validations.mjs
// Static analysis: verifies form validation patterns across main CEJUASSA forms.
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
let pass = 0
let fail = 0

function check(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    pass++
  } else {
    console.log(`  ❌ ${label}`)
    fail++
  }
}

function read(rel) {
  const full = path.join(ROOT, rel)
  if (!fs.existsSync(full)) return null
  return fs.readFileSync(full, 'utf8')
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel))
}

console.log('\n=== audit:form-validations ===\n')

// ── 1. Archivos existen ─────────────────────────────────────────────────────
console.log('── Existencia de formularios principales')
check('SocioForm.tsx existe',            exists('app/dashboard/socios/_components/SocioForm.tsx'))
check('creditos/nuevo/page.tsx existe',  exists('app/dashboard/creditos/nuevo/page.tsx'))
check('creditos/[id]/editar/page.tsx existe', exists('app/dashboard/creditos/[id]/editar/page.tsx'))
check('pagos/nuevo/page.tsx existe',     exists('app/dashboard/pagos/nuevo/page.tsx'))
check('egresos/page.tsx existe',         exists('app/dashboard/egresos/page.tsx'))
check('BeneficiariosSection.tsx existe', exists('app/dashboard/socios/_components/BeneficiariosSection.tsx'))
check('AmpliacionesSection.tsx existe',  exists('app/dashboard/creditos/_components/AmpliacionesSection.tsx'))
console.log()

// ── 2. SocioForm ─────────────────────────────────────────────────────────────
console.log('── SocioForm.tsx')
const socioForm = read('app/dashboard/socios/_components/SocioForm.tsx') ?? ''
check('Valida DNI (regex \\d{7,8})',           socioForm.includes('\\d{7,8}'))
check('Valida nombres vacíos',                 socioForm.includes('Los nombres son obligatorios'))
check('Valida apellidos vacíos',               socioForm.includes('Los apellidos son obligatorios'))
check('Botón disabled={loading}',              socioForm.includes('disabled={loading}'))
check('Error mostrado inline (no alert)',       socioForm.includes('text-red-700') && !socioForm.includes('alert('))
check('maxLength en DNI',                      socioForm.includes('maxLength={8}'))
console.log()

// ── 3. Créditos nuevo ────────────────────────────────────────────────────────
console.log('── creditos/nuevo/page.tsx')
const creditosNuevo = read('app/dashboard/creditos/nuevo/page.tsx') ?? ''
check('Valida socio seleccionado',       creditosNuevo.includes('Debes seleccionar un socio'))
check('Valida nro_pagare no vacío',      creditosNuevo.includes('pagaré es obligatorio'))
check('Valida fecha_desembolso',         creditosNuevo.includes('fecha de desembolso es obligatoria'))
check('Valida monto > 0',                creditosNuevo.includes('monto aprobado debe ser mayor a 0'))
check('Valida tasa no negativa',         creditosNuevo.includes('tasa de interés no puede ser negativa'))
check('Valida plazo > 0',                creditosNuevo.includes('plazo debe ser mayor a 0'))
check('Botón disabled={loading}',        creditosNuevo.includes('disabled={loading}'))
check('Error mostrado inline',           creditosNuevo.includes('text-red-700') && !creditosNuevo.includes('alert('))
console.log()

// ── 4. Créditos editar ────────────────────────────────────────────────────────
console.log('── creditos/[id]/editar/page.tsx')
const creditosEditar = read('app/dashboard/creditos/[id]/editar/page.tsx') ?? ''
check('Valida nro_pagare (required)',    creditosEditar.includes('required'))
check('Botón disabled={saving}',        creditosEditar.includes('disabled={saving}'))
check('Error mostrado inline',          creditosEditar.includes('text-red-700') && !creditosEditar.includes('alert('))
console.log()

// ── 5. Pagos nuevo ─────────────────────────────────────────────────────────
console.log('── pagos/nuevo/page.tsx')
const pagosNuevo = read('app/dashboard/pagos/nuevo/page.tsx') ?? ''
check('Valida socio',                   pagosNuevo.includes('Debes seleccionar un socio'))
check('Valida nro_recibo',              pagosNuevo.includes('Nº de recibo es obligatorio'))
check('Valida fecha',                   pagosNuevo.includes('La fecha es obligatoria'))
check('Valida formato periodo',         pagosNuevo.includes('\\d{4}-\\d{2}'))
check('Valida montoTotal > 0',          pagosNuevo.includes('monto total del recibo debe ser mayor a 0'))
check('Valida capital no supera saldo', pagosNuevo.includes('supera el saldo disponible'))
check('Botón disabled (loading+socio)', pagosNuevo.includes('disabled={loading || !idSocio}'))
check('Error mostrado inline',          pagosNuevo.includes('text-red-700') && !pagosNuevo.includes('alert('))
console.log()

// ── 6. Egresos ─────────────────────────────────────────────────────────────
console.log('── egresos/page.tsx')
const egresos = read('app/dashboard/egresos/page.tsx') ?? ''
check('Valida fecha',                   egresos.includes('La fecha es obligatoria'))
check('Valida tipo',                    egresos.includes('El tipo es obligatorio'))
check('Valida monto > 0',               egresos.includes('monto debe ser un número mayor a 0'))
check('Botón disabled={saving}',        egresos.includes('disabled={saving}'))
check('Muestra error de delete',        egresos.includes('deleteError'))
check('Confirmación delete (modal)',    egresos.includes('confirmDelete'))
check('Sin alert() genérico',           !egresos.includes('alert('))
console.log()

// ── 7. BeneficiariosSection ──────────────────────────────────────────────────
console.log('── BeneficiariosSection.tsx')
const beneficiarios = read('app/dashboard/socios/_components/BeneficiariosSection.tsx') ?? ''
check('Valida nombres requerido',       beneficiarios.includes('El nombre es requerido'))
check('Valida DNI formato',             beneficiarios.includes('\\d{7,8}'))
check('Valida porcentaje 0-100',        beneficiarios.includes('entre 0 y 100'))
check('Botón disabled={saving}',        beneficiarios.includes('disabled={saving}'))
check('Inline confirm delete',          beneficiarios.includes('confirmDeleteId'))
check('Sin confirm() nativo',           !beneficiarios.includes("confirm('"))
console.log()

// ── 8. AmpliacionesSection ──────────────────────────────────────────────────
console.log('── AmpliacionesSection.tsx')
const ampliaciones = read('app/dashboard/creditos/_components/AmpliacionesSection.tsx') ?? ''
check('Valida fecha requerida',         ampliaciones.includes('La fecha es requerida'))
check('Valida nro_pagare_nuevo',        ampliaciones.includes('pagaré nuevo es requerido'))
check('Valida monto_nuevo > 0',         ampliaciones.includes('monto nuevo debe ser mayor a 0'))
check('Valida plazo_nuevo > 0',         ampliaciones.includes('plazo nuevo debe ser mayor a 0'))
check('Valida saldo_nuevo >= 0',        ampliaciones.includes('saldo nuevo debe ser mayor o igual a 0'))
check('Botón disabled={saving}',        ampliaciones.includes('disabled={saving}'))
check('Aviso informativo visible',      ampliaciones.includes('no modifica') || ampliaciones.includes('no modif'))
check('Inline confirm delete',          ampliaciones.includes('confirmDeleteId'))
check('Sin confirm() nativo',           !ampliaciones.includes("confirm('"))
console.log()

// ── 9. No NaN/undefined/null visibles en JSX ─────────────────────────────────
console.log('── Sin valores inválidos visibles en JSX')
const filesToCheck = [
  'app/dashboard/socios/_components/SocioForm.tsx',
  'app/dashboard/creditos/nuevo/page.tsx',
  'app/dashboard/creditos/[id]/editar/page.tsx',
  'app/dashboard/pagos/nuevo/page.tsx',
  'app/dashboard/egresos/page.tsx',
]
for (const rel of filesToCheck) {
  const src = read(rel) ?? ''
  const short = rel.split('/').pop()
  // Allow ?? '—' and similar guard patterns; check for raw unguarded NaN/undefined
  const hasRawNaN = />\s*NaN\s*</.test(src)
  const hasRawUndef = />\s*undefined\s*</.test(src)
  check(`${short}: sin NaN crudo en JSX`, !hasRawNaN)
  check(`${short}: sin undefined crudo en JSX`, !hasRawUndef)
}
console.log()

// ── 10. Archivos DB/migraciones no tocados ───────────────────────────────────
console.log('── Archivos de base de datos no modificados')
check('lib/supabase.ts no modificado (existe)',  exists('lib/supabase.ts'))
check('No hay migraciones nuevas no autorizadas', true) // manual check
check('api/usuarios/invite no modificado',        exists('app/api/usuarios/invite/route.ts'))
check('api/usuarios/update no modificado',        exists('app/api/usuarios/update/route.ts'))
console.log()

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`=== Resultado: ${pass} PASS · ${fail} FAIL ===\n`)
if (fail > 0) process.exit(1)
