# MISSING_REQUIREMENTS_AUDIT.md
# Fase 9D-0 — Auditoría de Requisitos Faltantes
# Fecha: 2026-06-20

> **Regla**: este documento es SOLO auditoría. No modificar app, no tocar DB, no crear migraciones.

---

## 1. Nombres Separados del Socio

| Atributo | Detalle |
|---|---|
| **Estado actual** | **Parcial — ya separados en DB y formularios, problema es visual en listados** |
| **Archivos revisados** | `socios/_components/SocioForm.tsx`, `socios/page.tsx`, `socios/[id]/page.tsx`, `socios/[id]/editar/page.tsx`, `DATABASE_AND_AUTH.md` |

**Hallazgos:**
- La tabla `socios` YA tiene `apellidos` (texto libre, completo) y `nombres` (texto libre, completo) como campos separados.
- El formulario de crear/editar socio (`SocioForm.tsx`) tiene dos campos: "Apellidos" y "Nombres".
- La lista (`socios/page.tsx` línea 127) muestra `{s.apellidos}, {s.nombres}` — correctamente separados por coma.
- La lista de créditos (`creditos/page.tsx` línea 169) muestra `${c.socios.apellidos}, ${c.socios.nombres}` — idem.
- **No existe** `apellido_paterno` / `apellido_materno` / `primer_nombre` / `segundo_nombre` separados.

**Riesgo:**
- Riesgo **bajo** de migración: los campos `apellidos` y `nombres` ya existen. Si la queja es que "el nombre junto se ve mal", puede ser un problema de datos ingresados, no de estructura.
- Si se desea separar `apellido_paterno` + `apellido_materno` (para Perú, formato APEPAT APEM NOMBRES), sería una migración con transformación de datos existentes → riesgo de pérdida o error en datos ya cargados.

**Recomendación:**
- Verificar con el cliente si `apellidos` contiene ambos apellidos juntos y si eso es suficiente, o si realmente necesitan campos separados por apellido.
- Si los datos actuales son `apellidos = "García López"` y `nombres = "Juan Carlos"`, la estructura actual es correcta y el display `{s.apellidos}, {s.nombres}` ya es legible.
- **No crear campos nuevos** hasta confirmar la queja real.

| Requiere migración | Sí, si se separan apellido_paterno / apellido_materno |
| Requiere decisión negocio | Sí — confirmar qué campo va en qué posición con datos reales |
| **Fase sugerida** | 9E (baja prioridad — solo si hay queja concreta de UI) |

---

## 2. Beneficiarios Múltiples por Socio

| Atributo | Detalle |
|---|---|
| **Estado actual** | **Parcial — existe 1 beneficiario por socio (campos en tabla socios), no hay tabla separada** |
| **Archivos revisados** | `SocioForm.tsx`, `socios/[id]/page.tsx`, `socios/[id]/editar/page.tsx`, `DATABASE_AND_AUTH.md`, `AI_HANDOFF.md` |

**Hallazgos:**
- La tabla `socios` tiene 3 campos de beneficiario: `beneficiario_nombre`, `beneficiario_dni`, `beneficiario_parentesco`.
- La sección se llama "Beneficiario FPS" — es el fondo de protección al socio (beneficiario en caso de fallecimiento).
- El formulario permite exactamente **1 beneficiario** por socio.
- No existe tabla `socio_beneficiarios` ni ninguna estructura para múltiples.
- No existe campo de porcentaje (`%`) ni teléfono del beneficiario.

**Riesgo:**
- Riesgo **medio-alto** si hay socios con múltiples beneficiarios ya cargados como texto libre en `beneficiario_nombre` (ej: "Juan y María Pérez").
- Migrar de 3 columnas en `socios` a tabla relacional `socio_beneficiarios` requiere mover datos y limpiar los campos inline.

**Modelo recomendado para Fase 9F:**
```sql
CREATE TABLE socio_beneficiarios (
  id              BIGSERIAL PRIMARY KEY,
  id_socio        BIGINT NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  nombres         TEXT NOT NULL,
  apellidos       TEXT NOT NULL,
  dni             TEXT,
  parentesco      TEXT,         -- Cónyuge, Hijo/a, Padre/Madre, etc.
  porcentaje      NUMERIC(5,2) DEFAULT 100, -- % del beneficio
  telefono        TEXT,
  observacion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```
- Los campos actuales `beneficiario_nombre/dni/parentesco` en `socios` deben quedar como campos de compatibilidad hasta que se migre.

| Requiere migración | Sí — nueva tabla + mover datos existentes |
| Requiere decisión negocio | Sí — ¿cuántos beneficiarios máximo? ¿los % suman 100%? ¿el FPS aplica a todos? |
| **Fase sugerida** | 9F |

---

## 3. Ampliaciones de Crédito

| Atributo | Detalle |
|---|---|
| **Estado actual** | **Parcial — tabla existe en Supabase, pero NO hay módulo en la app** |
| **Archivos revisados** | `PENDIENTES.md`, `CAMBIOS_REALIZADOS.md`, `creditos/nuevo/page.tsx`, `DATABASE_AND_AUTH.md` |

**Hallazgos:**
- `PENDIENTES.md` línea 64 confirma: **"Tabla `ampliaciones` ya existe en Supabase."**
- `CAMBIOS_REALIZADOS.md` línea 257 lista `ampliaciones` entre las tablas con RLS: `admin` + `creditos`.
- **No existe** ninguna página o formulario en `app/dashboard/` para ampliaciones.
- No existe ningún componente, link o botón que lleve a un flujo de ampliación.
- El formulario `creditos/nuevo/page.tsx` no tiene ningún campo `credito_origen_id` o similar.
- **No se conocen los campos exactos de la tabla `ampliaciones`** — no se pudo leer el schema SQL directamente (no hay migración local que la cree).

**Lo que se desconoce (requiere verificar en Supabase Dashboard):**
- Campos exactos de la tabla `ampliaciones` (¿tiene `id_credito_original`, `id_credito_nuevo`, `monto_adicional`, `fecha`?)
- Si la tabla tiene datos reales o está vacía.

**Regla de negocio pendiente de definir:**
- ¿Una ampliación crea un **nuevo crédito** que reemplaza al original (que pasa a estado "refinanciado")?
- ¿O la ampliación modifica el crédito existente sumando monto y recalculando el cronograma?
- ¿O es una operación híbrida (cancela el saldo restante + otorga crédito nuevo por saldo + monto adicional)?

| Requiere migración | Probablemente no — tabla ya existe. Puede requerir campos adicionales. |
| Requiere decisión negocio | **Sí — crítico.** El flujo no está definido. |
| **Fase sugerida** | 9G (después de 9F — depende de definición de negocio) |

---

## 4. Número de Pagaré en Ampliaciones

| Atributo | Detalle |
|---|---|
| **Estado actual** | **No existe** — no hay flujo de ampliación, por lo tanto tampoco hay lógica de pagaré |
| **Archivos revisados** | `creditos/nuevo/page.tsx`, `creditos/page.tsx`, `DATABASE_AND_AUTH.md` |

**Hallazgos:**
- La tabla `creditos` tiene campo `nro_pagare` (texto libre, obligatorio al crear).
- El campo se ingresa manualmente por el operador en el formulario de nuevo crédito.
- No existe ninguna lógica automática de generación de número de pagaré.
- No existe ningún mecanismo que asigne un nuevo número de pagaré al ampliar.

**Regla de negocio pendiente de definir:**
- ¿Al ampliar, el número de pagaré cambia (se genera uno nuevo)?
- ¿O el pagaré es el mismo documento físico con una adenda?
- ¿El número de pagaré es correlativo automático o lo asigna Créditos manualmente?

| Requiere migración | No — el campo ya existe. Solo lógica de formulario. |
| Requiere decisión negocio | **Sí — pregunta clave para el proceso legal/operativo.** |
| **Fase sugerida** | 9G (incluida dentro del módulo de ampliaciones) |

---

## 5. Manual HTML — Análisis de Cobertura

| Tema | Estado en manual |
|---|---|
| Ampliaciones de crédito | **NO MENCIONADO** |
| Número de pagaré (cómo asignarlo, si es automático) | Mencionado solo como campo a llenar, sin guía |
| Múltiples beneficiarios | **NO MENCIONADO** — solo un beneficiario FPS |
| Nombres separados del socio | Mencionado correctamente (dos campos: Apellidos y Nombres) |
| Flujo de pagaré en ampliación | **NO MENCIONADO** |

**Archivos revisados:** `docs/ai-recovery/manuals/CEJUASSA_MANUAL_USUARIO.html` (secciones Socios, Créditos, Permisos)

---

## Resumen de Estado

| Requisito | Estado | Requiere Migración | Requiere Decisión Negocio | Fase |
|---|---|---|---|---|
| Nombres separados (apellido_paterno/materno) | Parcial — ya hay 2 campos separados | Solo si se quieren más campos | Sí — confirmar si alcanza con apellidos + nombres | 9E |
| Beneficiario único FPS | Existe — 3 campos en socios | No aplica | No | — |
| Múltiples beneficiarios (tabla relacional) | No existe | Sí — nueva tabla | Sí — reglas FPS, % | 9F |
| Tabla `ampliaciones` en DB | Existe (confirmado) | No (ya existe) | — | — |
| Módulo de ampliaciones en app | No existe | No | **Sí — flujo crítico** | 9G |
| Pagaré en ampliaciones | No existe | No | **Sí — proceso legal** | 9G |
| Manual: ampliaciones | No existe | — | — | 9D-1 |
| Manual: múltiples beneficiarios | No existe | — | — | 9D-1 |

---

## Plan por Fases Recomendado

### Fase 9D-1 — Actualizar manual con estado real (siguiente inmediato)
- Agregar sección "Módulos pendientes" al manual.
- Documentar que ampliaciones están en roadmap (tabla existe, módulo en desarrollo).
- Aclarar que el beneficiario actual es el Beneficiario FPS (1 solo).
- No requiere cambios de código ni DB.
- Tiempo estimado: 1-2 horas.

### Fase 9E — Nombres separados (baja prioridad)
- **Primero confirmar con el cliente**: ¿cuál es la queja exacta? ¿Los datos en `apellidos` son "García López" o es todo junto "GARCÍA LÓPEZ Juan Carlos"?
- Si la queja es de datos mal ingresados: guía de carga correcta en manual, no hay cambio de código.
- Si se necesitan `apellido_paterno` + `apellido_materno`: migración con transformación de datos (riesgosa si hay datos mal cargados).
- Tiempo estimado: 2-4 horas de código + validación de datos.

### Fase 9F — Múltiples beneficiarios (media prioridad)
- Confirmar reglas de negocio: ¿cuántos beneficiarios máximo? ¿porcentaje requerido? ¿teléfono obligatorio?
- Crear tabla `socio_beneficiarios`.
- Actualizar formulario de socio: sección de beneficiarios con CRUD inline (añadir/eliminar beneficiarios).
- Migrar datos de `beneficiario_nombre/dni/parentesco` existentes a la nueva tabla.
- Tiempo estimado: 4-6 horas de código + migración + pruebas.

### Fase 9G — Ampliaciones de crédito y pagaré (alta prioridad para operaciones)
- **Primero usar Claude Chat para definir flujo**: ¿crea crédito nuevo? ¿modifica existente? ¿pagaré nuevo?
- Auditar campos reales de la tabla `ampliaciones` en Supabase Dashboard.
- Diseñar flujo con `/cejuassa-db-plan`.
- Crear módulo: lista de ampliaciones por crédito, formulario de nueva ampliación, actualización de cronograma.
- Tiempo estimado: 8-12 horas (el más complejo).

---

## Riesgos Identificados

| Riesgo | Probabilidad | Impacto |
|---|---|---|
| Datos mal cargados en `apellidos` (todo junto) hacen inútil la separación posterior | Media | Alto |
| Tabla `ampliaciones` tiene campos incompatibles con el flujo real deseado | Media | Alto |
| Definición de ampliación cambia a mitad de implementación | Alta | Muy alto |
| Migrar beneficiario único a tabla relacional rompe datos existentes si no se hace en orden | Baja | Alto |

---

*Auditoría completada 2026-06-20. No se modificó ningún archivo de código ni DB.*
