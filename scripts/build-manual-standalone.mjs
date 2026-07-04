#!/usr/bin/env node
/**
 * build-manual-standalone.mjs
 * Lee el manual HTML y embebe todas las imágenes como base64.
 * Genera manual_usuario_cejuassa_standalone.html — completamente autocontenido.
 */

import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const MANUAL_DIR = path.join(ROOT, 'exports/qa-ops/manual')
const SCREENSHOTS_DIR = path.join(MANUAL_DIR, 'screenshots')
const INPUT = path.join(MANUAL_DIR, 'manual_usuario_cejuassa.html')
const OUTPUT = path.join(MANUAL_DIR, 'manual_usuario_cejuassa_standalone.html')

if (!fs.existsSync(INPUT)) {
  console.error(`❌ No se encontró: ${INPUT}`)
  process.exit(1)
}

let html = fs.readFileSync(INPUT, 'utf8')

// Reemplazar cada src="screenshots/filename.jpg" con base64
const imgPattern = /src="screenshots\/([^"]+\.jpg)"/g
let match
let replaced = 0
let missing = 0

html = html.replace(imgPattern, (full, filename) => {
  const imgPath = path.join(SCREENSHOTS_DIR, filename)
  if (!fs.existsSync(imgPath)) {
    console.warn(`  ⚠️  No encontrado: ${filename}`)
    missing++
    return full
  }
  const data = fs.readFileSync(imgPath)
  const b64 = data.toString('base64')
  replaced++
  return `src="data:image/jpeg;base64,${b64}"`
})

fs.writeFileSync(OUTPUT, html, 'utf8')

const sizeKB = Math.round(fs.statSync(OUTPUT).size / 1024)
console.log(`\n✅ Manual standalone generado:`)
console.log(`   ${OUTPUT}`)
console.log(`   Imágenes embebidas: ${replaced}`)
console.log(`   Imágenes faltantes: ${missing}`)
console.log(`   Tamaño total: ${sizeKB} KB\n`)
