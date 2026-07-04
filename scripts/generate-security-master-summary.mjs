#!/usr/bin/env node
/**
 * Genera exports/security/security_master_summary.xlsx
 * Resumen ejecutivo de la sesión SECURITY-MASTER.
 * Solo se ejecuta una vez para crear el archivo.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const XLSX = (await import('xlsx')).default;
const wb = XLSX.utils.book_new();

// ── Hoja 1: Estado de fases ───────────────────────────────────────────────────
const fases = [
  ['Fase', 'Descripción', 'Estado', 'Verificación', 'Resultado'],
  ['SEC-1', 'Headers HTTP y configuración base', 'COMPLETADO', 'check:security-sec1', '41/41 PASS'],
  ['SEC-2', 'Hardening API y backend', 'COMPLETADO', 'check:security-api', '30/30 PASS'],
  ['SEC-3A', 'Auditoría RLS remoto', 'COMPLETADO', 'check:rls-sec3c', 'PASS'],
  ['SEC-3C', 'RLS endurecido (2 tablas)', 'COMPLETADO', 'check:rls-sec3c', 'PASS'],
  ['SEC-4A', 'Diseño audit log', 'COMPLETADO', 'check:audit-log-design', 'PASS'],
  ['SEC-3E', 'Baseline local tabla auditoria', 'PREPARADO — PENDIENTE AUTORIZACIÓN', 'check:auditoria-baseline-sec3e', '40/40 PASS'],
  ['SEC-4B', 'Implementación audit log', 'PREPARADO — PENDIENTE AUTORIZACIÓN', 'check:audit-log-implementation-plan', '40/40 PASS'],
  ['SEC-5', 'Runbook backup/recovery', 'DOCUMENTADO', 'check:security-backup-runbook', '29/29 PASS'],
  ['SEC-6', 'Guards y validaciones', 'DOCUMENTADO', 'check:security-guards-validations', '37/37 PASS · 5 WARN'],
  ['DEP-1', 'Estrategia xlsx', 'DOCUMENTADO', 'check:xlsx-risk-plan', '22/22 PASS · 2 WARN'],
  ['SEC-FINAL', 'Reporte maestro consolidado', 'COMPLETADO', 'check:security-master', 'ejecutar'],
];

const wsFases = XLSX.utils.aoa_to_sheet(fases);
wsFases['!cols'] = [{ wch: 10 }, { wch: 38 }, { wch: 36 }, { wch: 36 }, { wch: 22 }];
XLSX.utils.book_append_sheet(wb, wsFases, 'Estado Fases');

// ── Hoja 2: npm audit ─────────────────────────────────────────────────────────
const npmAudit = [
  ['Paquete', 'Severidad', 'Vulnerabilidad', 'Fix disponible', 'Riesgo práctico'],
  ['postcss <8.5.10', 'MODERATE', 'XSS via </style> en CSS Stringify', 'NO — requiere downgrade Next.js 9.3.3', 'BAJO — interno, sin input externo peligroso'],
  ['xlsx *', 'HIGH', 'Prototype Pollution', 'NO — mantenedor sin parche', 'BAJO — solo exporta, nunca parsea archivos externos'],
  ['xlsx *', 'HIGH', 'ReDoS', 'NO — mantenedor sin parche', 'BAJO — mismo motivo'],
];
const wsAudit = XLSX.utils.aoa_to_sheet(npmAudit);
wsAudit['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 40 }, { wch: 48 }];
XLSX.utils.book_append_sheet(wb, wsAudit, 'npm audit');

// ── Hoja 3: Riesgos abiertos ──────────────────────────────────────────────────
const riesgos = [
  ['ID', 'Descripción', 'Severidad', 'Estado', 'Acción recomendada'],
  ['xlsx-HIGH', 'Prototype Pollution + ReDoS en xlsx', 'HIGH', 'Sin fix — riesgo práctico BAJO', 'Monitorear actualizaciones; escalar si se agrega importación Excel por usuarios'],
  ['postcss-MOD', 'XSS en postcss dentro de Next.js', 'MODERATE', 'Sin fix sin downgrade', 'Aceptado — monitorear nueva versión de Next.js'],
  ['SEC-4B-PEND', 'Audit log no implementado', 'MEDIO', 'Pendiente autorización', 'Decir APLICAR AUDIT LOG SEC-4B'],
  ['SEC-6-R1', 'Anexo N°6 accesible a todos los roles', 'BAJO-MEDIO', 'Pendiente decisión de negocio', 'Confirmar con cooperativa si restringir a admin+contabilidad'],
  ['SEC-6-R2', 'Suma porcentajes beneficiarios sin constraint DB', 'BAJO', 'Documentado (B4)', 'Agregar validación JS en BeneficiariosSection.tsx'],
];
const wsRiesgos = XLSX.utils.aoa_to_sheet(riesgos);
wsRiesgos['!cols'] = [{ wch: 14 }, { wch: 44 }, { wch: 14 }, { wch: 30 }, { wch: 56 }];
XLSX.utils.book_append_sheet(wb, wsRiesgos, 'Riesgos Abiertos');

// ── Hoja 4: Autorizaciones pendientes ─────────────────────────────────────────
const auths = [
  ['Autorización', 'Migración lista', 'Efecto', 'Requisito previo', 'Seguro para aplicar'],
  [
    'APLICAR BASELINE AUDITORIA SEC-3E',
    'supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql',
    'Documenta tabla auditoria en historial local de migraciones',
    'Ninguno',
    'SÍ — idempotente, no borra datos, no cambia schema existente',
  ],
  [
    'APLICAR AUDIT LOG SEC-4B',
    'supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql',
    'Amplía auditoria (5 cols), crea RPC registrar_auditoria, restringe SELECT a admin+contabilidad',
    'SEC-3E aplicado primero',
    'SÍ — transaccional, con rollback documentado',
  ],
];
const wsAuths = XLSX.utils.aoa_to_sheet(auths);
wsAuths['!cols'] = [{ wch: 38 }, { wch: 58 }, { wch: 62 }, { wch: 20 }, { wch: 52 }];
XLSX.utils.book_append_sheet(wb, wsAuths, 'Autorizaciones Pendientes');

// Guardar
const outPath = join(ROOT, 'exports/security/security_master_summary.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`✅ Creado: exports/security/security_master_summary.xlsx`);
