import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function readFileSafe(p) {
  try { return readFileSync(p, 'utf-8') } catch { return '' }
}

const socioForm       = readFileSafe(join(ROOT, 'app', 'dashboard', 'socios', '_components', 'SocioForm.tsx'))
const socioEditar     = readFileSafe(join(ROOT, 'app', 'dashboard', 'socios', '[id]', 'editar', 'page.tsx'))
const creditoNuevo    = readFileSafe(join(ROOT, 'app', 'dashboard', 'creditos', 'nuevo', 'page.tsx'))
const creditoEditar   = readFileSafe(join(ROOT, 'app', 'dashboard', 'creditos', '[id]', 'editar', 'page.tsx'))
const pagoNuevo       = readFileSafe(join(ROOT, 'app', 'dashboard', 'pagos', 'nuevo', 'page.tsx'))

const checks = [
  // ── Socios ──────────────────────────────────────────────────────────────────
  {
    id: 'socio-form-type-genero',
    desc: 'SocioForm: genero en SocioFormData',
    pass: /genero\s*:\s*string/.test(socioForm),
  },
  {
    id: 'socio-form-type-estado-civil',
    desc: 'SocioForm: estado_civil en SocioFormData',
    pass: /estado_civil\s*:\s*string/.test(socioForm),
  },
  {
    id: 'socio-form-payload-genero',
    desc: 'SocioForm: genero en payload de submit',
    pass: /genero\s*:/.test(socioForm),
  },
  {
    id: 'socio-form-payload-estado-civil',
    desc: 'SocioForm: estado_civil en payload de submit',
    pass: /estado_civil\s*:/.test(socioForm),
  },
  {
    id: 'socio-form-select-genero',
    desc: 'SocioForm: select de genero en UI',
    pass: /name="genero"/.test(socioForm),
  },
  {
    id: 'socio-form-select-estado-civil',
    desc: 'SocioForm: select de estado_civil en UI',
    pass: /name="estado_civil"/.test(socioForm),
  },
  {
    id: 'socio-editar-genero',
    desc: 'Editar socio: genero en initialData',
    pass: /genero\s*:/.test(socioEditar),
  },
  {
    id: 'socio-editar-estado-civil',
    desc: 'Editar socio: estado_civil en initialData',
    pass: /estado_civil\s*:/.test(socioEditar),
  },

  // ── Créditos nuevo ─────────────────────────────────────────────────────────
  {
    id: 'credito-nuevo-type-nro-expediente',
    desc: 'Crédito nuevo: nro_expediente en FormState',
    pass: /nro_expediente\s*:\s*string/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-type-tipo-credito-sbs',
    desc: 'Crédito nuevo: tipo_credito_sbs en FormState',
    pass: /tipo_credito_sbs\s*:\s*string/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-type-cuenta-contable',
    desc: 'Crédito nuevo: cuenta_contable_bd01 en FormState',
    pass: /cuenta_contable_bd01\s*:\s*string/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-type-aporte-descontado',
    desc: 'Crédito nuevo: aporte_descontado en FormState',
    pass: /aporte_descontado\s*:\s*string/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-type-tramite',
    desc: 'Crédito nuevo: tramite en FormState',
    pass: /tramite\s*:\s*string/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-ui-nro-expediente',
    desc: 'Crédito nuevo: campo nro_expediente en UI',
    pass: /name="nro_expediente"/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-ui-tipo-credito-sbs',
    desc: 'Crédito nuevo: campo tipo_credito_sbs en UI',
    pass: /name="tipo_credito_sbs"/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-ui-cuenta-contable',
    desc: 'Crédito nuevo: campo cuenta_contable_bd01 en UI',
    pass: /name="cuenta_contable_bd01"/.test(creditoNuevo),
  },
  {
    id: 'credito-nuevo-update-sbs',
    desc: 'Crédito nuevo: update SBS post-RPC',
    pass: /tipo_credito_sbs\s*:/.test(creditoNuevo) && /\.update\(/.test(creditoNuevo),
  },

  // ── Créditos editar ─────────────────────────────────────────────────────────
  {
    id: 'credito-editar-type-nro-expediente',
    desc: 'Editar crédito: nro_expediente en FormData',
    pass: /nro_expediente\s*:\s*string/.test(creditoEditar),
  },
  {
    id: 'credito-editar-select-sbs',
    desc: 'Editar crédito: campo tipo_credito_sbs en UI',
    pass: /name="tipo_credito_sbs"/.test(creditoEditar),
  },
  {
    id: 'credito-editar-update-sbs',
    desc: 'Editar crédito: campos SBS en update payload',
    pass: /tipo_credito_sbs\s*:/.test(creditoEditar) && /cuenta_contable_bd01\s*:/.test(creditoEditar),
  },

  // ── Pagos ───────────────────────────────────────────────────────────────────
  {
    id: 'pago-type-tipo-pago',
    desc: 'Pagos: tipo_pago en FormState',
    pass: /tipo_pago\s*:\s*string/.test(pagoNuevo),
  },
  {
    id: 'pago-default-a',
    desc: 'Pagos: default tipo_pago = A en EMPTY',
    pass: /tipo_pago\s*:\s*['"]A['"]/.test(pagoNuevo),
  },
  {
    id: 'pago-ui-select',
    desc: 'Pagos: select tipo_pago en UI',
    pass: /name="tipo_pago"/.test(pagoNuevo),
  },
  {
    id: 'pago-insert-tipo-pago',
    desc: 'Pagos: tipo_pago en insert payload',
    pass: /tipo_pago\s*:/.test(pagoNuevo),
  },

  // ── Seguridad ───────────────────────────────────────────────────────────────
  {
    id: 'no-bdcc-exporters',
    desc: 'Sin exportadores BDCC en scripts/',
    pass: (() => {
      try {
        return !readdirSync(join(ROOT, 'scripts')).some(f =>
          /export.*bd0[1-4]|bd0[1-4].*export|generate.*bd0[1-4]/i.test(f)
        )
      } catch { return true }
    })(),
  },
  {
    id: 'no-historico',
    desc: 'Sin lógica de histórico 2024/2025 en formularios (placeholders OK)',
    pass: ![socioForm, creditoNuevo, creditoEditar, pagoNuevo].some(f =>
      /periodo.*2024|periodo.*2025|historico.*2024|historico.*2025|WHERE.*2024|WHERE.*2025/i.test(f)
    ),
  },
]

let passed = 0
let failed = 0

console.log('\ncheck:bdcc:ui-fields — Fase 8A-3 (UI mínima para campos SBS/BDCC)\n')

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
  console.log(`\n⚠ ${failed} check(s) fallaron. Revisar formularios antes de continuar.`)
  process.exit(1)
} else {
  console.log('\n✓ Fase 8A-3: UI lista. Formularios capturan campos mínimos para SBS/BDCC.')
  process.exit(0)
}
