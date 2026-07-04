import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from '../node_modules/xlsx/xlsx.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(ROOT, 'exports/security')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

const { utils, write } = XLSX

const headers = [
  'ID', 'Área', 'Hallazgo', 'Severidad', 'Probabilidad',
  'Impacto', 'Archivo / Ruta', 'Recomendación', 'Fase sugerida', 'Estado'
]

const rows = [
  ['SEC-A01','Configuración web','Sin headers HTTP de seguridad (no X-Frame-Options, no CSP, no HSTS)','Alto','Media','Alto','next.config.ts','Agregar función headers() con X-Frame-Options DENY, CSP, Referrer-Policy, Permissions-Policy','SEC-1','Pendiente'],
  ['SEC-A02','Dependencias','xlsx con vulnerabilidad HIGH (Prototype Pollution + ReDoS) sin fix disponible','Alto','Baja-Media','Alto','package.json — xlsx ^0.18.5','Evaluar migración a exceljs','SEC-2','Pendiente'],
  ['SEC-A03','Supabase RLS','Policy FOR ALL TO authenticated USING (true) en socio_beneficiarios y pagos_cuotas_aplicaciones','Alto','Media','Alto','supabase/migrations/20260702000003 y 20260623000001','Refinar policies con get_current_user_role() por operación','SEC-3','Pendiente — requiere autorización DB'],
  ['SEC-A04','Autorización','Roles solo aplicados en frontend — usuario autenticado puede saltear restricciones via Supabase API directa','Alto','Media','Alto','lib/useRol.ts + app/dashboard/* guards','Complementar con RLS por rol en Supabase','SEC-3','Pendiente — requiere autorización DB'],
  ['SEC-B01','API/backend','id en update/route.ts no valida formato UUID antes de query DB','Medio','Baja','Medio','app/api/usuarios/update/route.ts línea 11','Agregar validación UUID regex antes de la query','SEC-2','Pendiente'],
  ['SEC-B02','API/backend','Mensajes de error internos de Supabase/PostgreSQL expuestos al cliente','Medio','Media','Medio','app/api/usuarios/invite/route.ts y update/route.ts','Mapear errores a mensajes genéricos; loguear internamente en servidor','SEC-2','Pendiente'],
  ['SEC-B03','Variables de entorno','Sin .env.example — nuevos desarrolladores no tienen plantilla de variables requeridas','Bajo','Baja','Bajo','(archivo inexistente)','Crear .env.example con claves y sin valores reales','SEC-1','Pendiente'],
  ['SEC-B04','Autorización','usuarios/page.tsx usa patrón guard diferente (rolActual local vs useRol hook estándar)','Bajo','Baja','Bajo','app/dashboard/usuarios/page.tsx','Unificar al patrón useRol + AccesoDenegado','SEC-6','Pendiente'],
  ['SEC-B05','Dependencias','postcss <8.5.10 via next — XSS en CSS stringify (fix requiere downgrade de Next.js)','Medio','Baja','Medio','node_modules/next/node_modules/postcss','Monitorear actualizaciones de Next.js que actualicen postcss','SEC-1 (monitoreo)','Sin fix seguro disponible'],
  ['SEC-B06','Dependencias','dompurify <=3.4.10 — Trusted Types bypass (fix disponible via npm audit fix)','Medio','Baja','Bajo','node_modules/dompurify','Ejecutar npm audit fix (sin --force)','SEC-1','Pendiente'],
  ['SEC-B07','Autorización','Páginas de reportes (Anexo 6, Caja, Aportes) y cartera/mora accesibles para todos los roles','Medio','Media','Bajo','app/dashboard/reportes/anexo6, mora, cartera, aportes, caja','Documentar política o agregar guard por rol según decisión de negocio','SEC-6','Decisión de negocio pendiente'],
  ['SEC-B08','API/backend','Sin rate limiting en API routes de invitación y actualización de usuarios','Medio','Baja','Medio','app/api/usuarios/invite/route.ts y update/route.ts','Agregar @upstash/ratelimit o middleware Next.js','SEC-2','Pendiente'],
  ['SEC-C01','Backend/Datos','Sin paginación server-side — toda la data carga client-side (782 socios, 832 pagos, 911 cuotas)','Bajo','Alta','Bajo','app/dashboard/** — todos los módulos con useEffect','Implementar paginación server-side o cursor-based para tablas con >500 registros','SEC-6','Deuda técnica conocida'],
  ['SEC-C02','Backups/Operación','Sin automatización de backups — solo backups manuales puntuales existen','Bajo','Media','Alto','scripts/backup-operational-data.mjs','Crear tarea automatizada de backup periódico (npx supabase db dump)','SEC-5','Pendiente'],
  ['SEC-C03','Auditoría','Sin audit log de acciones financieras — no hay trazabilidad de quién registró pagos o modificó créditos','Bajo','Alta','Medio','(tabla audit_log inexistente)','Crear tabla audit_log con triggers en tablas financieras críticas','SEC-4','Requiere autorización DB'],
  ['SEC-C04','Configuración','URL hardcodeada al Dashboard de Supabase en configuracion/page.tsx','Bajo','Baja','Bajo','app/dashboard/configuracion/page.tsx','Usar variable de entorno o eliminar enlace hardcodeado','SEC-1','Pendiente'],
]

const wb = utils.book_new()
const wsData = [headers, ...rows]
const ws = utils.aoa_to_sheet(wsData)

ws['!cols'] = [
  { wch: 10 }, { wch: 18 }, { wch: 55 }, { wch: 10 },
  { wch: 12 }, { wch: 10 }, { wch: 42 }, { wch: 55 },
  { wch: 16 }, { wch: 30 }
]

utils.book_append_sheet(wb, ws, 'Matriz Riesgos SEC-0')

const outPath = resolve(outDir, 'security_risk_matrix.xlsx')
const buf = write(wb, { type: 'buffer', bookType: 'xlsx' })
writeFileSync(outPath, buf)
console.log('OK — exports/security/security_risk_matrix.xlsx creado')
