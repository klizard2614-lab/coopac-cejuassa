// Script temporal: genera el Excel de revisión de match_medio
// Ejecutar una sola vez: node scripts/generate-match-medio-excel.mjs
// No toca la base de datos.

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const casos = [
  {
    pago_id: '412****',
    fecha_pago: '04/03/2026',
    socio_id: '3336****',
    dni_enmascarado: '(*****)',
    socio_enmascarado: '(*****)',
    monto_total: 500.00,
    monto_credito_detectado: 500.00,
    tipo_pago: 'capital_interes',
    credito_propuesto_id: '1147****',
    nro_pagare: '(consultar DB)',
    fecha_desembolso: '(consultar DB)',
    estado_credito: 'vigente',
    razon_match_medio: 'único crédito del socio (fuera de rango fecha, estado: vigente)',
    decision_creditos: '',
    observacion_creditos: '',
  },
  {
    pago_id: '413****',
    fecha_pago: '04/03/2026',
    socio_id: '3336****',
    dni_enmascarado: '(*****)',
    socio_enmascarado: '(*****)',
    monto_total: 150.00,
    monto_credito_detectado: 150.00,
    tipo_pago: 'capital_solo',
    credito_propuesto_id: '1147****',
    nro_pagare: '(consultar DB)',
    fecha_desembolso: '(consultar DB)',
    estado_credito: 'vigente',
    razon_match_medio: 'único crédito del socio (fuera de rango fecha, estado: vigente)',
    decision_creditos: '',
    observacion_creditos: '',
  },
  {
    pago_id: '422****',
    fecha_pago: '25/03/2026',
    socio_id: '3344****',
    dni_enmascarado: '(*****)',
    socio_enmascarado: '(*****)',
    monto_total: 100.00,
    monto_credito_detectado: 100.00,
    tipo_pago: 'interes_solo',
    credito_propuesto_id: '1159****',
    nro_pagare: '(consultar DB)',
    fecha_desembolso: '(consultar DB)',
    estado_credito: 'vigente',
    razon_match_medio: 'único crédito del socio (fuera de rango fecha, estado: vigente)',
    decision_creditos: '',
    observacion_creditos: '',
  },
];

const outDir = path.join(ROOT, 'exports', 'data-corrections');
fs.mkdirSync(outDir, { recursive: true });

const ws = XLSX.utils.json_to_sheet(casos, {
  header: [
    'pago_id',
    'fecha_pago',
    'socio_id',
    'dni_enmascarado',
    'socio_enmascarado',
    'monto_total',
    'monto_credito_detectado',
    'tipo_pago',
    'credito_propuesto_id',
    'nro_pagare',
    'fecha_desembolso',
    'estado_credito',
    'razon_match_medio',
    'decision_creditos',
    'observacion_creditos',
  ],
});

// Ancho de columnas
ws['!cols'] = [
  { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
  { wch: 13 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 16 },
  { wch: 16 }, { wch: 14 }, { wch: 52 }, { wch: 30 }, { wch: 30 },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'match_medio');

const outPath = path.join(outDir, 'revision_pagos_match_medio.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`✅ Excel generado: ${outPath}`);
console.log(`   ${casos.length} casos match_medio exportados.`);
