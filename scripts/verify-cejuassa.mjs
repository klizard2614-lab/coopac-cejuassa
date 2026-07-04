#!/usr/bin/env node
// Verificación local CEJUASSA: lint (no bloqueante) → typecheck → build (bloqueantes)
import { execSync } from 'child_process'

const STEPS = [
  { label: 'LINT',      cmd: 'npm run lint',      blocking: false },
  { label: 'TYPECHECK', cmd: 'npx tsc --noEmit',  blocking: true  },
  { label: 'BUILD',     cmd: 'npm run build',      blocking: true  },
]

const SEP = '─'.repeat(52)

console.log(`\nCEJUASSA verify — ${new Date().toLocaleTimeString('es-PE')}\n${SEP}`)

for (const { label, cmd, blocking } of STEPS) {
  console.log(`\n[${label}] ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit' })
    console.log(`\n✓  ${label} OK`)
  } catch {
    if (blocking) {
      console.error(`\n✗  ${label} FALLÓ — bloqueante. Corrige antes de continuar.`)
      process.exit(1)
    }
    console.warn(`\n⚠  ${label} tiene errores preexistentes — continuando (no bloqueante)`)
  }
}

console.log(`\n${SEP}\n✓  Verificación completa.\n`)
