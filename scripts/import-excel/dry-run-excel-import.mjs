/**
 * dry-run-excel-import.mjs
 * Fase 9C-4A — Auditoría y dry-run de importación desde Excel.
 *
 * REGLAS ESTRICTAS:
 * - NO inserta datos en Supabase
 * - NO modifica _client_files/
 * - NO imprime datos personales completos
 * - NO usa backup JSON como fuente principal
 * - NO crea migraciones
 * - NO toca usuarios/configuracion/auth.users
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DOCS_DIR = resolve(ROOT, 'docs/ai-recovery');

// Dynamic import of xlsx to avoid ESM issues
const XLSX = await import('xlsx').then(m => m.default || m);

// ─── Configuración de archivos fuente ────────────────────────────────────────

const CLIENT_FILES_BASE = resolve(ROOT, '_client_files/raw/extracted/Archvos app');

const EXCEL_SOURCES = {
  creditos: {
    path: resolve(CLIENT_FILES_BASE, 'DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx'),
    label: 'DSCTO Y DESEMBOLSO ABR-2026',
    sheet: 'Hoja3',
    headerRow: 3, // 0-indexed
    type: 'B',
  },
  ingresos_caja: {
    path: resolve(CLIENT_FILES_BASE, 'INGRESO DETALLADO MARZO 2026 (1).xlsx'),
    label: 'INGRESO DETALLADO MARZO 2026 (caja)',
    sheet: 'Hoja1',
    headerRow: 4,
    type: 'C',
  },
  ingresos_convenio: {
    path: resolve(CLIENT_FILES_BASE, 'CONVENIO MES MARZO 2026 (1).xlsx'),
    label: 'CONVENIO MES MARZO 2026 (detalle)',
    sheet: 'DETALLE',
    headerRow: 4,
    type: 'C',
  },
};

// ─── Utilidades ──────────────────────────────────────────────────────────────

function mask(str) {
  if (!str) return '***';
  const s = String(str).trim();
  if (s.length <= 3) return '***';
  return s.substring(0, 2) + '*'.repeat(Math.min(s.length - 4, 6)) + s.slice(-2);
}

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

function parseSpanishDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function readSheet(filePath, sheetName, headerRow) {
  if (!existsSync(filePath)) {
    return { error: `Archivo no encontrado: ${filePath}`, rows: [] };
  }
  try {
    const wb = XLSX.readFile(filePath);
    if (!wb.SheetNames.includes(sheetName)) {
      return { error: `Hoja "${sheetName}" no encontrada. Hojas disponibles: ${wb.SheetNames.join(', ')}`, rows: [] };
    }
    const ws = wb.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const headers = allRows[headerRow];
    const dataRows = allRows.slice(headerRow + 1).filter(r => r.some(c => c !== ''));
    const objects = dataRows.map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[String(h).trim()] = r[i]; });
      return obj;
    });
    return { headers, rows: objects, rawRows: allRows };
  } catch (e) {
    return { error: e.message, rows: [] };
  }
}

// ─── Análisis: CREDITOS ──────────────────────────────────────────────────────

function analyzeCreditos(rows) {
  const issues = [];
  const warnings = [];
  let vigentes = 0;
  let cancelados = 0;
  let sinSocio = 0;
  let sinFecha = 0;
  let sinMonto = 0;
  let sinPlazo = 0;
  const expedientesVistos = new Set();
  const sociosVistos = new Set();
  let duplicadosExped = 0;

  for (const row of rows) {
    const idSocio = String(row['IdSocio'] || '').trim();
    const expediente = row['Exped.'];
    const fecha = row['Fecha'];
    const monto = parseFloat(row['Monto']) || 0;
    const saldoCapital = parseFloat(row['Saldo Capital']) || 0;
    const plazo = parseInt(row['Plazo']) || 0;

    if (!idSocio || idSocio === '') sinSocio++;
    if (!fecha) sinFecha++;
    if (monto <= 0) sinMonto++;
    if (plazo <= 0) sinPlazo++;

    if (expediente) {
      if (expedientesVistos.has(expediente)) duplicadosExped++;
      expedientesVistos.add(expediente);
    }

    if (idSocio) sociosVistos.add(idSocio);

    if (saldoCapital > 0) vigentes++;
    else cancelados++;
  }

  if (sinSocio > 0) issues.push(`${sinSocio} créditos sin IdSocio`);
  if (sinFecha > 0) issues.push(`${sinFecha} créditos sin Fecha`);
  if (sinMonto > 0) issues.push(`${sinMonto} créditos con Monto = 0`);
  if (sinPlazo > 0) warnings.push(`${sinPlazo} créditos sin Plazo definido`);
  if (duplicadosExped > 0) issues.push(`${duplicadosExped} expedientes duplicados detectados`);

  warnings.push(`Tasa de interés NO disponible en Excel — debe calcularse o asignarse manualmente`);
  warnings.push(`Tipo de crédito NO disponible en Excel — default: 'consumo'`);
  warnings.push(`Campos SBS (tipo_credito_sbs, subtipo_credito_sbs) ausentes — completar manualmente`);

  return {
    total: rows.length,
    vigentes,
    cancelados,
    sinSocio,
    sociosUnicos: sociosVistos.size,
    expedientesUnicos: expedientesVistos.size,
    duplicadosExped,
    issues,
    warnings,
  };
}

// ─── Análisis: PAGOS ─────────────────────────────────────────────────────────

function analyzePagos(rows, label) {
  const issues = [];
  const warnings = [];
  let sinSocio = 0;
  let sinRecibo = 0;
  let sinFecha = 0;
  let montoZero = 0;
  let montoDiscrepancia = 0;
  const recibosVistos = new Set();
  const sociosVistos = new Set();
  const conveniosVistos = new Set();
  let duplicadosRecibo = 0;
  let conAporte = 0;
  let conCapital = 0;
  let conInteres = 0;

  for (const row of rows) {
    const idSocio = String(row['IdSocio'] || '').trim();
    const recibo = row['N°Recibo'];
    const fecha = row['Fecha'];
    const ap = parseFloat(row['Ap']) || 0;
    const ptmo = parseFloat(row['Ptmo']) || 0;
    const intC = parseFloat(row['IntC']) || 0;
    const fps = parseFloat(row['FPS']) || 0;
    const fpsEx = parseFloat(row['FPSEx']) || 0;
    const otrosP = parseFloat(row['OtrosP']) || 0;
    const totalRec = parseFloat(row['TotalRec']) || 0;
    const usuario = String(row['Usuario'] || '').trim();

    if (!idSocio || idSocio === '') sinSocio++;
    if (!recibo) sinRecibo++;
    if (!fecha) sinFecha++;
    if (totalRec <= 0) montoZero++;

    const calculado = ap + ptmo + intC + fps + fpsEx + otrosP;
    if (Math.abs(calculado - totalRec) > 0.05) montoDiscrepancia++;

    if (recibo) {
      if (recibosVistos.has(recibo)) duplicadosRecibo++;
      recibosVistos.add(recibo);
    }

    if (idSocio) sociosVistos.add(idSocio);
    if (usuario && usuario !== 'USUCAJ') conveniosVistos.add(usuario);

    if (ap > 0) conAporte++;
    if (ptmo > 0) conCapital++;
    if (intC > 0) conInteres++;
  }

  if (sinSocio > 0) issues.push(`${sinSocio} pagos sin IdSocio`);
  if (sinRecibo > 0) issues.push(`${sinRecibo} pagos sin N°Recibo`);
  if (montoDiscrepancia > 0) warnings.push(`${montoDiscrepancia} pagos con discrepancia en monto total`);
  if (duplicadosRecibo > 0) issues.push(`${duplicadosRecibo} N°Recibo duplicados detectados`);

  warnings.push(`id_credito NO disponible en Excel — se inferirá por socio activo al cargar`);
  warnings.push(`${conveniosVistos.size} convenios únicos detectados — necesitan existir en tabla convenios`);

  return {
    label,
    total: rows.length,
    sinSocio,
    sinRecibo,
    sinFecha,
    montoZero,
    montoDiscrepancia,
    sociosUnicos: sociosVistos.size,
    conveniosUnicos: conveniosVistos.size,
    conveniosDetectados: [...conveniosVistos].sort(),
    duplicadosRecibo,
    conAporte,
    conCapital,
    conInteres,
    issues,
    warnings,
  };
}

// ─── Verificar relaciones cruzadas ───────────────────────────────────────────

function checkCrossRelations(creditosRows, cajasRows, conveniosRows) {
  const sociosEnCreditos = new Set(creditosRows.map(r => String(r['IdSocio'] || '').trim()).filter(Boolean));
  const sociosEnCaja = new Set(cajasRows.map(r => String(r['IdSocio'] || '').trim()).filter(Boolean));
  const sociosEnConvenio = new Set(conveniosRows.map(r => String(r['IdSocio'] || '').trim()).filter(Boolean));

  // Pagos caja de socios sin crédito en Excel
  const cajasSinCredito = [...sociosEnCaja].filter(s => !sociosEnCreditos.has(s));
  // Pagos convenio de socios sin crédito en Excel
  const conveniosSinCredito = [...sociosEnConvenio].filter(s => !sociosEnCreditos.has(s));

  return {
    sociosConCredito: sociosEnCreditos.size,
    sociosConPagoCaja: sociosEnCaja.size,
    sociosConPagoConvenio: sociosEnConvenio.size,
    cajasSinCreditoEnExcel: cajasSinCredito.length,
    conveniosSinCreditoEnExcel: conveniosSinCredito.length,
    // No mostrar IDs para no exponer datos personales
    notaCaja: cajasSinCredito.length > 0
      ? `${cajasSinCredito.length} socios con pago de caja no tienen crédito en el Excel de desembolsos (pueden ser pagos solo de aporte o créditos históricos no en el Excel)`
      : 'Todos los socios con pago de caja tienen crédito en Excel',
    notaConvenio: conveniosSinCredito.length > 0
      ? `${conveniosSinCredito.length} socios con pago de convenio no tienen crédito en el Excel de desembolsos (misma razón)`
      : 'Todos los socios con pago de convenio tienen crédito en Excel',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log('  CEJUASSA — Dry-run Excel Import (Fase 9C-4A)');
console.log('  MODO: Solo lectura. NO se inserta ningún dato.');
console.log('══════════════════════════════════════════════════════\n');

const results = {};

// 1. Leer créditos
console.log('📂 Leyendo Excel de créditos...');
const creditosData = readSheet(
  EXCEL_SOURCES.creditos.path,
  EXCEL_SOURCES.creditos.sheet,
  EXCEL_SOURCES.creditos.headerRow,
);
if (creditosData.error) {
  console.error('  ❌ ERROR:', creditosData.error);
  results.creditos = { error: creditosData.error };
} else {
  console.log(`  ✅ ${creditosData.rows.length} filas leídas`);
  results.creditos = analyzeCreditos(creditosData.rows);
}

// 2. Leer pagos caja
console.log('\n📂 Leyendo Excel de ingresos (caja)...');
const cajasData = readSheet(
  EXCEL_SOURCES.ingresos_caja.path,
  EXCEL_SOURCES.ingresos_caja.sheet,
  EXCEL_SOURCES.ingresos_caja.headerRow,
);
if (cajasData.error) {
  console.error('  ❌ ERROR:', cajasData.error);
  results.pagos_caja = { error: cajasData.error };
} else {
  console.log(`  ✅ ${cajasData.rows.length} filas leídas`);
  results.pagos_caja = analyzePagos(cajasData.rows, 'Ingresos Caja (USUCAJ)');
}

// 3. Leer pagos convenio
console.log('\n📂 Leyendo Excel de ingresos (convenios)...');
const convenioData = readSheet(
  EXCEL_SOURCES.ingresos_convenio.path,
  EXCEL_SOURCES.ingresos_convenio.sheet,
  EXCEL_SOURCES.ingresos_convenio.headerRow,
);
if (convenioData.error) {
  console.error('  ❌ ERROR:', convenioData.error);
  results.pagos_convenio = { error: convenioData.error };
} else {
  console.log(`  ✅ ${convenioData.rows.length} filas leídas`);
  results.pagos_convenio = analyzePagos(convenioData.rows, 'Ingresos Convenios (múltiples)');
}

// 4. Relaciones cruzadas
console.log('\n🔗 Verificando relaciones cruzadas...');
const crossCheck = (!creditosData.error && !cajasData.error && !convenioData.error)
  ? checkCrossRelations(creditosData.rows, cajasData.rows, convenioData.rows)
  : null;

// ─── Resumen de consola ────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log('  RESUMEN DRY-RUN');
console.log('══════════════════════════════════════════════════════');

if (results.creditos && !results.creditos.error) {
  const c = results.creditos;
  console.log(`\n📋 CRÉDITOS (DSCTO Y DESEMBOLSO):`);
  console.log(`   Total registros   : ${c.total}`);
  console.log(`   Vigentes (saldo>0): ${c.vigentes}`);
  console.log(`   Cancelados        : ${c.cancelados}`);
  console.log(`   Socios únicos     : ${c.sociosUnicos}`);
  console.log(`   Expedientes únicos: ${c.expedientesUnicos}`);
  if (c.duplicadosExped > 0) console.log(`   ⚠️  Exp. duplicados : ${c.duplicadosExped}`);
  if (c.issues.length) c.issues.forEach(i => console.log(`   ❌ ${i}`));
  if (c.warnings.length) c.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
}

if (results.pagos_caja && !results.pagos_caja.error) {
  const p = results.pagos_caja;
  console.log(`\n💵 PAGOS CAJA (INGRESO DETALLADO):`);
  console.log(`   Total registros: ${p.total}`);
  console.log(`   Socios únicos  : ${p.sociosUnicos}`);
  console.log(`   Con aporte     : ${p.conAporte}`);
  console.log(`   Con capital    : ${p.conCapital}`);
  console.log(`   Con interés    : ${p.conInteres}`);
  if (p.issues.length) p.issues.forEach(i => console.log(`   ❌ ${i}`));
  if (p.warnings.length) p.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
}

if (results.pagos_convenio && !results.pagos_convenio.error) {
  const p = results.pagos_convenio;
  console.log(`\n🏛️  PAGOS CONVENIO (CONVENIO MES MARZO):`);
  console.log(`   Total registros   : ${p.total}`);
  console.log(`   Socios únicos     : ${p.sociosUnicos}`);
  console.log(`   Convenios únicos  : ${p.conveniosUnicos}`);
  console.log(`   Convenios detectados: ${p.conveniosDetectados.join(', ')}`);
  console.log(`   Con aporte        : ${p.conAporte}`);
  console.log(`   Con capital       : ${p.conCapital}`);
  if (p.issues.length) p.issues.forEach(i => console.log(`   ❌ ${i}`));
  if (p.warnings.length) p.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
}

if (crossCheck) {
  console.log(`\n🔗 RELACIONES CRUZADAS:`);
  console.log(`   Socios con crédito en Excel        : ${crossCheck.sociosConCredito}`);
  console.log(`   Socios con pago en caja            : ${crossCheck.sociosConPagoCaja}`);
  console.log(`   Socios con pago en convenio        : ${crossCheck.sociosConPagoConvenio}`);
  console.log(`   ${crossCheck.notaCaja}`);
  console.log(`   ${crossCheck.notaConvenio}`);
}

console.log('\n❌ TABLAS SIN FUENTE EXCEL:');
console.log('   socios         → usar backup JSON (backups/data-reset/20260620-1327/socios.json)');
console.log('   egresos        → sin fuente disponible');
console.log('   cronograma_cuotas → generado automáticamente por RPC C');
console.log('   aportes           → generados automáticamente por RPC B');

console.log('\n✅ CONFIRMACIÓN: No se insertó ningún dato en Supabase.');
console.log('✅ Los archivos de _client_files/ no fueron modificados.');

// ─── Generar reporte Markdown ─────────────────────────────────────────────

const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
const totalPagos = (results.pagos_caja?.total || 0) + (results.pagos_convenio?.total || 0);
const totalIssues = [
  ...(results.creditos?.issues || []),
  ...(results.pagos_caja?.issues || []),
  ...(results.pagos_convenio?.issues || []),
].length;
const totalWarnings = [
  ...(results.creditos?.warnings || []),
  ...(results.pagos_caja?.warnings || []),
  ...(results.pagos_convenio?.warnings || []),
].length;

const report = `# EXCEL_IMPORT_DRY_RUN_REPORT.md
# Reporte Dry-Run de Importación Excel — CEJUASSA
# Generado: ${now}

> Fase 9C-4A — Solo lectura. NO se insertó ningún dato.

---

## Estado general

| Indicador | Valor |
|---|---|
| Archivos Excel procesados | 3 (solo lectura) |
| Issues críticos | ${totalIssues} |
| Warnings | ${totalWarnings} |
| Datos insertados | **0 — Ninguno** |
| Archivos modificados | **0 — Ninguno** |

---

## Resultados por fuente

### Créditos — DSCTO Y DESEMBOLSO ABR-2026

${results.creditos?.error ? `❌ Error: ${results.creditos.error}` : `
| Métrica | Valor |
|---|---|
| Total registros | ${results.creditos?.total || 0} |
| Vigentes (saldo > 0) | ${results.creditos?.vigentes || 0} |
| Cancelados (saldo = 0) | ${results.creditos?.cancelados || 0} |
| Socios únicos referenciados | ${results.creditos?.sociosUnicos || 0} |
| Expedientes únicos | ${results.creditos?.expedientesUnicos || 0} |
| Expedientes duplicados | ${results.creditos?.duplicadosExped || 0} |

**Issues:**
${results.creditos?.issues?.length ? results.creditos.issues.map(i => `- ❌ ${i}`).join('\n') : '- Ninguno'}

**Warnings:**
${results.creditos?.warnings?.length ? results.creditos.warnings.map(w => `- ⚠️ ${w}`).join('\n') : '- Ninguno'}
`}

---

### Pagos Caja — INGRESO DETALLADO MARZO 2026

${results.pagos_caja?.error ? `❌ Error: ${results.pagos_caja.error}` : `
| Métrica | Valor |
|---|---|
| Total registros | ${results.pagos_caja?.total || 0} |
| Socios únicos | ${results.pagos_caja?.sociosUnicos || 0} |
| Pagos con aporte | ${results.pagos_caja?.conAporte || 0} |
| Pagos con capital | ${results.pagos_caja?.conCapital || 0} |
| Pagos con interés | ${results.pagos_caja?.conInteres || 0} |
| Recibos duplicados | ${results.pagos_caja?.duplicadosRecibo || 0} |
| Discrepancias de monto | ${results.pagos_caja?.montoDiscrepancia || 0} |

**Issues:**
${results.pagos_caja?.issues?.length ? results.pagos_caja.issues.map(i => `- ❌ ${i}`).join('\n') : '- Ninguno'}

**Warnings:**
${results.pagos_caja?.warnings?.length ? results.pagos_caja.warnings.map(w => `- ⚠️ ${w}`).join('\n') : '- Ninguno'}
`}

---

### Pagos Convenio — CONVENIO MES MARZO 2026

${results.pagos_convenio?.error ? `❌ Error: ${results.pagos_convenio.error}` : `
| Métrica | Valor |
|---|---|
| Total registros | ${results.pagos_convenio?.total || 0} |
| Socios únicos | ${results.pagos_convenio?.sociosUnicos || 0} |
| Convenios únicos detectados | ${results.pagos_convenio?.conveniosUnicos || 0} |
| Pagos con aporte | ${results.pagos_convenio?.conAporte || 0} |
| Pagos con capital | ${results.pagos_convenio?.conCapital || 0} |
| Pagos con interés | ${results.pagos_convenio?.conInteres || 0} |
| Recibos duplicados | ${results.pagos_convenio?.duplicadosRecibo || 0} |

**Convenios detectados (campo Usuario):**
${results.pagos_convenio?.conveniosDetectados?.map(c => `- \`${c}\``).join('\n') || '- Ninguno'}

**Issues:**
${results.pagos_convenio?.issues?.length ? results.pagos_convenio.issues.map(i => `- ❌ ${i}`).join('\n') : '- Ninguno'}

**Warnings:**
${results.pagos_convenio?.warnings?.length ? results.pagos_convenio.warnings.map(w => `- ⚠️ ${w}`).join('\n') : '- Ninguno'}
`}

---

## Relaciones cruzadas

${crossCheck ? `
| Verificación | Resultado |
|---|---|
| Socios con crédito en Excel (DSCTO) | ${crossCheck.sociosConCredito} |
| Socios con pago en caja | ${crossCheck.sociosConPagoCaja} |
| Socios con pago en convenio | ${crossCheck.sociosConPagoConvenio} |
| Pagos caja sin crédito en Excel | ${crossCheck.cajasSinCreditoEnExcel} |
| Pagos convenio sin crédito en Excel | ${crossCheck.conveniosSinCreditoEnExcel} |

**Nota caja:** ${crossCheck.notaCaja}
**Nota convenio:** ${crossCheck.notaConvenio}
` : '❌ No disponible (error en lectura de algún archivo)'}

---

## Tablas sin fuente Excel disponible

| Tabla | Estado | Alternativa |
|---|---|---|
| \`socios\` | ❌ Sin Excel | Backup JSON (backups/data-reset/20260620-1327/socios.json — 434 socios) |
| \`egresos\` | ❌ Sin Excel | Ingresar manualmente |
| \`cronograma_cuotas\` | N/A | Generado automáticamente por RPC C al crear créditos |
| \`aportes\` | N/A | Generados automáticamente por RPC B al registrar pagos |

---

## Totales candidatos a importar

| Tabla | Registros candidatos | Condición |
|---|---|---|
| \`convenios\` | ~10 | Inferir de campo Usuario en CONVENIO |
| \`socios\` | 434 | Desde backup JSON (no desde Excel) |
| \`creditos\` vigentes | ${results.creditos?.vigentes || '?'} | saldo_capital > 0 |
| \`creditos\` cancelados | ${results.creditos?.cancelados || '?'} | saldo_capital = 0 |
| \`pagos_recibos\` | ${totalPagos} | ${results.pagos_caja?.total || 0} caja + ${results.pagos_convenio?.total || 0} convenios |

---

## Campos que DEBEN completarse manualmente post-carga

- \`socios.genero\` — No disponible en ningún Excel
- \`socios.estado_civil\` — No disponible en ningún Excel
- \`socios.beneficiario_nombre/dni/parentesco\` — No disponible en ningún Excel
- \`creditos.tasa_interes\` — No disponible en Excel (calcular o asignar)
- \`creditos.tipo_credito\` — No disponible en Excel
- \`creditos.tipo_credito_sbs\` — No disponible en Excel
- \`creditos.cuenta_contable_bd01\` — No disponible en Excel
- \`convenios.ruc\`, \`convenios.contacto\`, \`convenios.telefono\` — No disponible en Excel

---

## Confirmaciones de cumplimiento

- ✅ **NO se insertó ningún dato en Supabase**
- ✅ **NO se modificaron archivos en _client_files/**
- ✅ **NO se imprimieron datos personales completos**
- ✅ **NO se usó backup JSON como fuente principal** (mencionado solo como alternativa)
- ✅ **NO se tocaron tablas de sistema (usuarios/configuracion)**
- ✅ **NO se crearon migraciones**
- ✅ **NO se borró ningún dato**

---

*Reporte generado por scripts/import-excel/dry-run-excel-import.mjs — ${now}*
`;

if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
const reportPath = resolve(DOCS_DIR, 'EXCEL_IMPORT_DRY_RUN_REPORT.md');
writeFileSync(reportPath, report, 'utf8');
console.log(`\n📄 Reporte generado: docs/ai-recovery/EXCEL_IMPORT_DRY_RUN_REPORT.md`);
console.log('\n══════════════════════════════════════════════════════');
console.log(`  ${totalIssues === 0 ? '✅ DRY-RUN COMPLETADO — 0 issues críticos' : `⚠️  DRY-RUN COMPLETADO — ${totalIssues} issues, ${totalWarnings} warnings`}`);
console.log('══════════════════════════════════════════════════════\n');
