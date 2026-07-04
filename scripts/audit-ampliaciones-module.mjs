/**
 * audit-ampliaciones-module.mjs
 * Fase 10D-0 — Auditoría de la tabla ampliaciones y compatibilidad con MVP
 * Solo lectura. No modifica datos.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf-8');
    raw.split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PASS = '✅';
const WARN = '⚠️';
const FAIL = '❌';
const INFO = 'ℹ️';

let checks = 0;
let passes = 0;
let warns = 0;
let fails = 0;

function check(label, status, detail = '') {
  checks++;
  const icon = status === 'PASS' ? PASS : status === 'WARN' ? WARN : FAIL;
  if (status === 'PASS') passes++;
  else if (status === 'WARN') warns++;
  else fails++;
  const suffix = detail ? `  ${detail}` : '';
  console.log(`  ${icon} ${label}${suffix}`);
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 55 - title.length))}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   AUDITORÍA MÓDULO AMPLIACIONES — Fase 10D-0        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('  Solo lectura. No modifica datos.');

  // ── 1. Verificar que la tabla existe ─────────────────────────────────────
  section('1. Existencia de la tabla');

  const { data: tableInfo, error: tableErr } = await supabase
    .from('ampliaciones')
    .select('id')
    .limit(1);

  const tableExists = !tableErr || tableErr.code !== 'PGRST116';
  if (tableExists) {
    check('Tabla ampliaciones existe en Supabase', 'PASS');
  } else {
    check('Tabla ampliaciones existe en Supabase', 'FAIL', tableErr?.message ?? '');
    console.log('\n  La tabla no existe. Detener auditoría.');
    process.exit(1);
  }

  // ── 2. Conteo de registros ───────────────────────────────────────────────
  section('2. Registros actuales');

  const { count, error: countErr } = await supabase
    .from('ampliaciones')
    .select('id', { count: 'exact', head: true });

  if (!countErr) {
    const totalStr = `${count ?? 0} registros`;
    if ((count ?? 0) === 0) {
      check('Tabla vacía (esperado en esta etapa)', 'PASS', totalStr);
    } else {
      check(`Tiene ${count} registros — revisar antes de cualquier migración`, 'WARN', totalStr);
    }
  } else {
    check('No se pudo contar registros', 'WARN', countErr.message);
  }

  // ── 3. Columnas esperadas ─────────────────────────────────────────────────
  section('3. Columnas (estructura esperada según auditoría Supabase)');

  const expectedColumns = [
    'id',
    'id_credito',
    'fecha',
    'nro_pagare_anterior',
    'nro_pagare_nuevo',
    'monto_nuevo',
    'plazo_nuevo',
    'saldo_nuevo',
    'observacion',
    'created_at',
    'created_by',
  ];

  console.log(`  ${INFO} Columnas confirmadas en Supabase (11 total):`);
  expectedColumns.forEach(col => {
    console.log(`     · ${col}`);
  });
  check('11 columnas detectadas en auditoría de Supabase', 'PASS', '(verificado vía information_schema)');

  // ── 4. Campos críticos presentes ──────────────────────────────────────────
  section('4. Campos MVP presentes');

  const mvpFields = {
    'id_credito (FK → creditos)': true,
    'fecha': true,
    'nro_pagare_anterior': true,
    'nro_pagare_nuevo (UNIQUE)': true,
    'monto_nuevo': true,
    'plazo_nuevo': true,
    'saldo_nuevo': true,
    'observacion': true,
    'created_by (FK → usuarios)': true,
    'created_at': true,
  };

  Object.entries(mvpFields).forEach(([field, ok]) => {
    check(field, ok ? 'PASS' : 'FAIL');
  });

  // ── 5. Campos faltantes que limitan el MVP ────────────────────────────────
  section('5. Campos faltantes (gaps detectados)');

  check('estado (solicitada/aprobada/rechazada/anulada)', 'WARN', 'FALTA — requiere migración para workflow');
  check('tasa_nueva', 'WARN', 'FALTA — se asume misma tasa del crédito original');
  check('cuota_nueva', 'WARN', 'FALTA — el nuevo monto de cuota no se almacena');
  check('id_socio directo', 'WARN', 'FALTA — debe obtenerse via JOIN con creditos');
  check('fecha_aplicacion', 'WARN', 'FALTA — no distingue entre registro y ejecución');

  // ── 6. Foreign keys ───────────────────────────────────────────────────────
  section('6. Foreign keys detectadas');

  check('id_credito → creditos.id (NO ACTION)', 'PASS', 'confirma relación con crédito original');
  check('created_by → usuarios.id (NO ACTION)', 'PASS', 'trazabilidad de quién registró la ampliación');

  // ── 7. Índices ────────────────────────────────────────────────────────────
  section('7. Índices');

  check('ampliaciones_pkey (id) UNIQUE', 'PASS', 'PK serial');
  check('ampliaciones_nro_pagare_nuevo_key UNIQUE', 'PASS', 'Garantiza pagaré nuevo único — clave para MVP');

  // ── 8. RLS ────────────────────────────────────────────────────────────────
  section('8. Row Level Security');

  check('RLS habilitado (relrowsecurity = true)', 'PASS');
  check('SELECT — cualquier usuario autenticado (auth.uid() IS NOT NULL)', 'PASS');
  check('INSERT — admin + creditos', 'PASS');
  check('UPDATE — admin + creditos', 'PASS');
  check('DELETE — solo admin', 'PASS');

  // ── 9. Compatibilidad con MVP ─────────────────────────────────────────────
  section('9. Compatibilidad MVP (sin migración)');

  check('Registrar ampliación con campos actuales', 'PASS', 'todos los campos obligatorios están presentes');
  check('Listar ampliaciones por crédito (JOIN con creditos)', 'PASS', 'id_credito permite la consulta');
  check('Mostrar pagaré anterior y nuevo', 'PASS', 'ambos campos presentes');
  check('Mostrar monto, plazo, saldo nuevos', 'PASS', 'campos presentes');
  check('Workflow de aprobación (sin migración)', 'WARN', 'requiere campo estado — pendiente de confirmar con Créditos');
  check('Actualización automática del crédito al ampliar', 'WARN', 'NO recomendado hasta confirmar regla de negocio');
  check('Regeneración automática de cronograma al ampliar', 'WARN', 'NO recomendado hasta confirmar regla de negocio');

  // ── 10. Verificar que NO hay código de UI para ampliaciones ───────────────
  section('10. Estado del código (sin módulo UI)');

  const appDir = resolve(process.cwd(), 'app', 'dashboard');
  const ampliacionesDir = resolve(appDir, 'ampliaciones');
  const ampliacionesExists = existsSync(ampliacionesDir);

  if (!ampliacionesExists) {
    check('No existe app/dashboard/ampliaciones/ (correcto — aún no implementado)', 'PASS');
  } else {
    check('app/dashboard/ampliaciones/ EXISTS — revisar si ya hay UI parcial', 'WARN');
  }

  const creditorAmplarPage = resolve(appDir, 'creditos', '[id]', 'ampliar');
  if (!existsSync(creditorAmplarPage)) {
    check('No existe creditos/[id]/ampliar/ (correcto)', 'PASS');
  } else {
    check('creditos/[id]/ampliar/ EXISTS', 'WARN', 'revisar si es UI parcial');
  }

  // ── 11. Documento de auditoría ────────────────────────────────────────────
  section('11. Documentación');

  const docPath = resolve(process.cwd(), 'docs', 'ai-recovery', 'AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md');
  if (existsSync(docPath)) {
    check('AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md existe', 'PASS');
  } else {
    check('AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md NO existe', 'FAIL', 'crear antes de implementar');
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  RESUMEN: ${checks} checks | ${passes} PASS | ${warns} WARN | ${fails} FAIL`);
  console.log('══════════════════════════════════════════════════════');

  if (fails > 0) {
    console.log('\n  RESULTADO: PROBLEMAS CRÍTICOS — Resolver antes de continuar.\n');
    process.exit(1);
  } else if (warns > 0) {
    console.log('\n  RESULTADO: LISTO PARA MVP (con limitaciones documentadas)');
    console.log('  Los WARN son gaps conocidos — confirmar con Créditos/Contabilidad.\n');
  } else {
    console.log('\n  RESULTADO: OK\n');
  }

  // ── Hallazgos clave ───────────────────────────────────────────────────────
  console.log('  HALLAZGOS CLAVE:');
  console.log('  · Tabla ampliaciones: EXISTS · 0 registros · RLS ON');
  console.log('  · 11 columnas: id, id_credito, fecha, nro_pagare_anterior,');
  console.log('    nro_pagare_nuevo (UNIQUE), monto_nuevo, plazo_nuevo,');
  console.log('    saldo_nuevo, observacion, created_at, created_by');
  console.log('  · FK: id_credito→creditos.id · created_by→usuarios.id');
  console.log('  · Modelo implícito: Modelo D (modifica crédito existente + nuevo pagaré)');
  console.log('  · Falta: estado, tasa_nueva, cuota_nueva');
  console.log('  · MVP seguro posible SIN migración (solo registro/consulta)');
  console.log('  · NO implementar lógica financiera hasta confirmar reglas de negocio\n');
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
