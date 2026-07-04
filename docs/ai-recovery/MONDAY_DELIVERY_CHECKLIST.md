# MONDAY_DELIVERY_CHECKLIST.md

> Checklist de entrega para el lunes — COOPAC CEJUASSA App
> Última actualización: 2026-06-20

---

## A. Estado general de la app

### Módulos listos (100% operativos)

| Módulo | Ruta | Estado |
|---|---|---|
| Dashboard | `/dashboard` | ✅ Listo |
| Socios (CRUD + PDF + campos SBS) | `/dashboard/socios` | ✅ Listo |
| Créditos (CRUD + campos SBS/BDCC) | `/dashboard/creditos` | ✅ Listo |
| Pagos (lista + nuevo + PDF + tipo_pago) | `/dashboard/pagos` | ✅ Listo |
| Aportes (lista + detalle) | `/dashboard/aportes` | ✅ Listo |
| Egresos (CRUD en modal) | `/dashboard/egresos` | ✅ Listo |
| Cartera (clasificación SBS + provisiones desde config) | `/dashboard/cartera` | ✅ Listo |
| Mora (créditos vencidos) | `/dashboard/mora` | ✅ Listo |
| Convenios (resumen por período) | `/dashboard/convenios` | ✅ Listo |
| Reportes → Anexo 6 SBS (Provisiones Constituidas = Requeridas ✅) | `/dashboard/reportes/anexo6` | ✅ Listo |
| Reportes → BDCC SBS (BD01, BD02-A, BD03A, BD03B) | `/dashboard/reportes/bdcc` | ✅ MVP listo |
| Reportes → Aportes | `/dashboard/reportes/aportes` | ✅ Listo |
| Reportes → Caja | `/dashboard/reportes/caja` | ✅ Listo |
| Usuarios (admin) | `/dashboard/usuarios` | ✅ Listo |
| Configuración (tasas, código COOPAC 01270) | `/dashboard/configuracion` | ✅ Listo |

### Validaciones automáticas que pasan

```
npm run smoke:bdcc                 # 51/51 PASS
npm run check:bdcc:mvp-exporters   # 38/38 PASS
npm run check:bdcc:ui-fields       # 26/26 PASS
npm run check:bdcc:min-fields      # 16/16 PASS
npm run verify:cejuassa            # tsc OK + build 35/35 rutas
npm run check:provision:constituida # 10/10 PASS
npm run audit:service-role         # OK
```

### Seguridad activa

- Rutas `/dashboard/*` protegidas por middleware (`proxy.ts` — Next.js 16)
- Roles: admin / tesorería / créditos / contabilidad con acceso diferenciado
- Service role key confinada a API routes únicamente

---

## B. Checklist de prueba manual para lunes

### Antes de la demo

- [ ] Ejecutar `npm run dev` — confirmar que arranca en `http://localhost:3000`
- [ ] Ingresar con usuario admin (`klizard2614@gmail.com` u otro con rol `admin`)
- [ ] Confirmar que el dashboard carga sin errores

### Módulo Socios

- [ ] Ir a `/dashboard/socios`
- [ ] Seleccionar un socio existente → "Editar"
- [ ] Verificar que aparecen los campos **Género** (M/F/Otro) y **Estado Civil** (soltero/casado/etc.)
- [ ] Guardar un cambio menor → confirmar que se guarda sin error

### Módulo Créditos

- [ ] Ir a `/dashboard/creditos`
- [ ] Seleccionar un crédito existente → "Editar"
- [ ] Verificar que aparecen los campos SBS: N° Expediente, Tipo Crédito SBS, Subtipo, Cuenta Contable BD01, Aporte Descontado, Trámite
- [ ] Verificar que se pueden editar y guardar

### Módulo Pagos

- [ ] Ir a `/dashboard/pagos/nuevo`
- [ ] Buscar un socio con crédito vigente
- [ ] Verificar que aparece el campo **Tipo de Pago** con opciones (A = amortización normal, K = cancelación)
- [ ] Confirmar que el valor por defecto es "A"

### Reportes → Anexo 6

- [ ] Ir a `/dashboard/reportes/anexo6`
- [ ] Hacer clic en "Generar"
- [ ] Verificar que aparece la nota azul "Provisiones Constituidas calculadas igual a Provisiones Requeridas según criterio confirmado por Contabilidad"
- [ ] Descargar el Excel — confirmar que tiene datos

### Reportes → BDCC SBS

- [ ] Ir a `/dashboard/reportes` → clic en "Generar →" de la tarjeta **BDCC SBS**
- [ ] Confirmar que carga `/dashboard/reportes/bdcc`
- [ ] Verificar que aparece:
  - [ ] Código COOPAC: **01270**
  - [ ] Selector de Mes y Año
  - [ ] Aviso "Borrador revisable"
  - [ ] Lista de 6 archivos con estados (MVP / Solo encabezado / Pendiente)
  - [ ] Bloque "BD02-B y BD04 — Pendiente de información de Créditos"
  - [ ] Sección de advertencias permanentes (TPINT, CCVE/CCJU, TIPCRED, género, histórico)

- [ ] Seleccionar el período **Junio 2026** (o el mes que corresponda probar)

- [ ] Descargar **BD01.txt**
  - [ ] Confirmar que el archivo se llama `01270_BD01_202606.txt`
  - [ ] Abrir en editor de texto — verificar primera línea con mnemónicos separados por tabulador
  - [ ] Verificar que hay filas de datos (una por crédito vigente)
  - [ ] Leer las advertencias que aparecen en pantalla después de descargar

- [ ] Descargar **BD02-A.txt**
  - [ ] Confirmar que el archivo se llama `01270_BD02A_202606.txt`
  - [ ] Verificar primera línea con mnemónicos (NUMDOC, NUMCRED, NCUOTA…)
  - [ ] Si no hay cuotas pagadas en el período, el archivo tendrá solo encabezado (normal)

- [ ] Descargar **BD03A.txt**
  - [ ] Confirmar que el archivo se llama `01270_BD03A_202606.txt`
  - [ ] Verificar que tiene **solo una línea** (encabezado) — correcto: CEJUASSA no tiene garantías preferidas

- [ ] Descargar **BD03B.txt**
  - [ ] Confirmar que el archivo se llama `01270_BD03B_202606.txt`
  - [ ] Verificar que tiene **solo una línea** (encabezado) — correcto

- [ ] Verificar que **BD02-B** y **BD04** muestran el badge "Pendiente" (gris) sin botón de descarga activo

---

## C. Archivos que ya genera la app

| Archivo | Contenido | Estado |
|---|---|---|
| `01270_BD01_YYYYMM.txt` | Créditos vigentes con clasificación, días mora, provisiones | ✅ Generable MVP |
| `01270_BD02A_YYYYMM.txt` | Cuotas pagadas en el período seleccionado | ✅ Generable MVP |
| `01270_BD03A_YYYYMM.txt` | Solo encabezado — CEJUASSA sin garantías preferidas vigentes | ✅ Solo encabezado |
| `01270_BD03B_YYYYMM.txt` | Solo encabezado — CEJUASSA sin garantías preferidas canceladas | ✅ Solo encabezado |
| `01270_BD02B_YYYYMM.txt` | Cuotas pagadas de créditos cancelados | ⏳ Pendiente |
| `01270_BD04_YYYYMM.txt` | Créditos cancelados | ⏳ Pendiente |

Formato: tabulador como separador de campos, UTF-8, extensión `.txt`.

---

## D. Pendientes explícitos (antes de envío oficial a SBS)

### Datos pendientes de confirmación con el equipo

| Campo en archivo | Pendiente | Área responsable |
|---|---|---|
| TPINT (tasa de interés) | ¿Es tasa nominal anual o TEA? Actualmente usa `tasa_interes` del crédito | Créditos |
| TIPCRED / SUBTIPCRED | Códigos SBS exactos (actualmente se ingresan manualmente en formulario) | Créditos |
| CCVE (cuenta capital vencido) | Usar cuenta separada de CCVI — confirmar con Contabilidad | Contabilidad |
| CCJU (cuenta capital judicial) | Usar cuenta separada de CCVI — confirmar con Contabilidad | Contabilidad |
| SEXO / ESTCIV (BD01) | Género y estado civil de socios — deben ingresarse en módulo Socios | Tesorería |
| TIPPAGO = K (BD02-A) | Tipo K (cancelación) pendiente de uso real | Créditos |

### Módulos pendientes de implementar

| Módulo | Impacto |
|---|---|
| Créditos cancelados | Necesario para BD02-B y BD04 |
| BD02-B | Bloqueado hasta módulo créditos cancelados |
| BD04 | Bloqueado hasta módulo créditos cancelados |

### Fuera de alcance actual

- **Histórico BDCC 2024/2025** — proyecto futuro separado, no implementar en esta fase
- La SBS pidió trimestres marzo y junio 2026 — el sistema puede generar ambos períodos con datos actuales

---

## E. Mensaje recomendado para Gerencia / Contabilidad

> **Estado de la app — BDCC SBS — Lunes [fecha]**
>
> La aplicación CEJUASSA ya cuenta con un módulo de generación de archivos BDCC. Puede generar los archivos BD01, BD02-A, BD03A y BD03B en formato TXT tabulado, listos para revisar internamente.
>
> **Qué ya funciona:**
> - Generación de BD01 (créditos vigentes con clasificación, mora y provisiones)
> - Generación de BD02-A (cuotas pagadas en el período)
> - BD03A y BD03B generados con solo encabezado (confirmado: CEJUASSA no tiene garantías preferidas)
>
> **Lo que queda por validar antes del envío a SBS:**
> - La tasa de interés (TPINT): necesitamos confirmar si el sistema registra tasa nominal o TEA
> - Los códigos de tipo y subtipo de crédito según el catálogo SBS
> - Las cuentas contables para capital vencido (CCVE) y judicial (CCJU)
> - El equipo de Tesorería debe ingresar el género y estado civil de los socios en el sistema
>
> **Los archivos generados son para revisión interna.** No deben enviarse a la SBS sin que el área de Contabilidad los haya revisado y confirmado que los datos son correctos.
>
> **Fecha límite SBS:** 20/07/2026 — hay tiempo para revisar y corregir.

---

## Comandos útiles para el lunes

```bash
npm run dev                      # Iniciar servidor de desarrollo
npm run smoke:bdcc               # Smoke test BDCC: 51/51 PASS
npm run check:bdcc:mvp-exporters # Verificar exportadores: 38/38 PASS
npm run verify:cejuassa          # Lint + tsc + build completo
npm run check:monday-readiness   # Verificar estado de entrega del lunes
```
