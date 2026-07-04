import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

const EXCLUDED_DIRS = new Set([
  'node_modules', '.next', '.git', 'supabase', 'docs',
])

const EXCLUDED_FILE_PATTERNS = [
  /^\.env/,
  /\.md$/,
]

// Split token strings to avoid self-match when this script is scanned
const TOKENS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_' + 'SUPABASE_SERVICE_ROLE_KEY',
]

const ALLOWED_PATHS = [
  /^lib[/\\]api[/\\]/,
  /^scripts[/\\]/,
  /^app[/\\]api[/\\]/,
]

const FORBIDDEN_PATHS = [
  /^app[/\\]dashboard[/\\]/,
  /^components[/\\]/,
  /^lib[/\\]supabase\.ts$/,
  /^lib[/\\]useRol\.ts$/,
]

async function walk(dir) {
  const files = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      files.push(...await walk(join(dir, entry.name)))
    } else if (entry.isFile()) {
      const ext = extname(entry.name)
      if (!SCAN_EXTENSIONS.has(ext)) continue
      if (EXCLUDED_FILE_PATTERNS.some(p => p.test(entry.name))) continue
      files.push(join(dir, entry.name))
    }
  }
  return files
}

async function audit() {
  const files = await walk(ROOT)
  const findings = []

  for (const filePath of files) {
    const rel = relative(ROOT, filePath)
    let content
    try {
      content = await readFile(filePath, 'utf8')
    } catch {
      continue
    }
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const token of TOKENS) {
        if (lines[i].includes(token)) {
          findings.push({ rel, line: i + 1, token })
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log('OK — service role key confinado a servidor/scripts locales')
    process.exit(0)
  }

  let hasWarning = false

  for (const { rel, line, token } of findings) {
    const relNorm = rel.replace(/\\/g, '/')
    const isForbidden = FORBIDDEN_PATHS.some(p => p.test(relNorm))
    const isAllowed = ALLOWED_PATHS.some(p => p.test(relNorm))
    const isUnexpected = token === ('NEXT_PUBLIC_' + 'SUPABASE_SERVICE_ROLE_KEY')

    if (isForbidden || isUnexpected || (!isAllowed)) {
      console.log(`WARNING: ${rel}:${line} — "${token}" en zona no permitida`)
      hasWarning = true
    } else {
      console.log(`OK:      ${rel}:${line} — "${token}"`)
    }
  }

  if (hasWarning) {
    console.log('\nAuditoría fallida — service role key fuera de zonas permitidas.')
    process.exit(1)
  } else {
    console.log('\nOK — service role key confinado a servidor/scripts locales')
    process.exit(0)
  }
}

audit().catch(err => {
  console.error('Error en auditoría:', err.message)
  process.exit(1)
})
