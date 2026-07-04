-- SEC-4B: Implementación de audit log en tabla `auditoria`
-- Fecha: 2026-07-03 (revisión endurecida 2026-07-03)
-- Propósito: Ampliar tabla `auditoria` + crear RPC `registrar_auditoria` SECURITY DEFINER
--            + ajustar policies para que INSERT solo sea posible via RPC.
-- ACCIÓN REQUERIDA: Solo aplicar con autorización explícita "APLICAR AUDIT LOG SEC-4B"
-- PREREQUISITO: Migración SEC-3E (20260703120000_sec3e_auditoria_baseline.sql) ya está APLICADA.
-- NO modifica datos existentes — solo agrega columnas y reemplaza policies.
-- NO toca tablas distintas a public.auditoria (excepto la RPC que lee public.usuarios).
--
-- REVISIÓN 2026-07-03: la versión anterior de este archivo afirmaba "sanitizar metadata"
-- solo en un comentario, sin control técnico real. Esta versión implementa controles
-- reales dentro de la RPC (whitelist de acciones/módulos, límites de longitud,
-- validación de tipo de metadata, tamaño máximo y rechazo de claves sensibles).

BEGIN;

-- ─── Paso 1: Ampliar la tabla auditoria con columnas faltantes ───────────────
-- Las columnas ya existentes (id, id_usuario, modulo, accion, descripcion,
-- registro_id, ip, fecha_hora) NO se modifican ni eliminan.

ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS actor_email    text,
  ADD COLUMN IF NOT EXISTS actor_rol      text,
  ADD COLUMN IF NOT EXISTS tabla_afectada text,
  ADD COLUMN IF NOT EXISTS metadata       jsonb,
  ADD COLUMN IF NOT EXISTS ip_hash        text;

-- Nota: el campo `ip` existente se mantiene por compatibilidad con registros históricos.
-- Los nuevos registros deben usar `ip_hash` (SHA-256 de la IP, nunca la IP en texto).
-- Nota: `ip_hash` queda disponible como columna; esta RPC no lo calcula automáticamente
-- (no hay forma segura de obtener la IP del cliente desde plpgsql sin exponerla al caller).

-- ─── Paso 2: Revocar INSERT directo a usuarios autenticados ─────────────────
-- La inserción se moverá a la RPC SECURITY DEFINER.
DROP POLICY IF EXISTS auditoria_insert ON public.auditoria;

-- ─── Paso 3: Policy SELECT granular por rol (admin + contabilidad) ───────────
-- No se crean policies de UPDATE/DELETE: sin policy para esos comandos, RLS los
-- deniega por defecto (comportamiento deseado — el audit log es de solo lectura/inserción).
DROP POLICY IF EXISTS auditoria_select ON public.auditoria;

CREATE POLICY auditoria_select
  ON public.auditoria
  FOR SELECT
  USING (
    get_user_rol() IN ('admin', 'contabilidad')
  );

-- ─── Paso 4: RPC registrar_auditoria SECURITY DEFINER (endurecida) ───────────
-- Solo vía esta RPC se puede insertar en auditoria (no hay INSERT policy directa).
-- Lee actor_user_id, actor_email, actor_rol desde public.usuarios usando auth.uid().
-- No acepta actor_user_id como parámetro (evita suplantación).
--
-- Controles técnicos reales (no solo convención):
--   A. Requiere sesión activa y usuario existente con rol en `usuarios` — si no, RETURN silencioso.
--   B. p_accion debe pertenecer a una whitelist fija de 14 acciones conocidas.
--   C. p_modulo debe pertenecer a una whitelist fija de 10 módulos conocidos.
--   D. Todos los campos de texto se truncan a un límite máximo (nunca se rechaza la
--      inserción completa por longitud — se trunca de forma segura con left(trim(...))).
--   E. p_metadata debe ser NULL o un objeto JSON (rechaza arrays/strings/números/booleanos,
--      se reemplaza silenciosamente por '{}' si no cumple).
--   F. Metadata serializada limitada a 4000 caracteres — si excede, se reemplaza por '{}'.
--   G. Se rechazan (metadata completa → '{}') si alguna CLAVE de primer nivel del objeto
--      coincide (substring, case-insensitive) con una lista de términos sensibles.
--      LIMITACIÓN DOCUMENTADA: esta validación solo inspecciona claves de primer nivel.
--      Si el caller anida objetos dentro de metadata, las claves internas no se
--      inspeccionan. Por diseño, los módulos deben enviar metadata plana (ver
--      AUDIT_LOG_IMPLEMENTATION_PLAN.md — "Cómo evitar metadata sensible").
--   metadata NUNCA debe contener snapshots completos del registro ni PII — esto es
--   responsabilidad del código llamador; los controles A-F son una red de seguridad
--   técnica adicional, no un sustituto de la disciplina de los módulos que integran SEC-4C.

CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_accion          text,
  p_modulo          text,
  p_tabla_afectada  text    DEFAULT NULL,
  p_registro_id     text    DEFAULT NULL,
  p_descripcion     text    DEFAULT NULL,
  p_metadata        jsonb   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_email         text;
  v_rol           text;
  v_accion        text;
  v_modulo        text;
  v_tabla         text;
  v_registro_id   text;
  v_descripcion   text;
  v_metadata      jsonb;
  v_key           text;
BEGIN
  -- A. Usuario autenticado con rol conocido
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email, rol::text
  INTO v_email, v_rol
  FROM public.usuarios
  WHERE id = v_user_id
  LIMIT 1;

  IF v_rol IS NULL THEN
    RETURN;
  END IF;

  -- B. Whitelist de acciones permitidas
  IF p_accion IS NULL OR p_accion NOT IN (
    'CREAR_SOCIO', 'EDITAR_SOCIO', 'EDITAR_BENEFICIARIOS',
    'CREAR_CREDITO', 'EDITAR_CREDITO', 'APLICAR_AMPLIACION',
    'REGISTRAR_PAGO', 'REGISTRAR_APORTE',
    'CREAR_EGRESO', 'ELIMINAR_EGRESO',
    'INVITAR_USUARIO', 'CAMBIAR_ESTADO_USUARIO',
    'EDITAR_CONFIGURACION', 'EXPORTAR_ANEXO6'
  ) THEN
    RETURN;
  END IF;

  -- C. Whitelist de módulos permitidos
  IF p_modulo IS NULL OR p_modulo NOT IN (
    'socios', 'creditos', 'beneficiarios', 'ampliaciones',
    'pagos', 'aportes', 'egresos', 'usuarios', 'configuracion', 'reportes'
  ) THEN
    RETURN;
  END IF;

  -- D. Límites de longitud (truncado seguro, nunca rechazo total por esto)
  v_accion      := left(trim(p_accion), 80);
  v_modulo      := left(trim(p_modulo), 80);
  v_tabla       := left(trim(coalesce(p_tabla_afectada, '')), 80);
  v_registro_id := left(trim(coalesce(p_registro_id, '')), 120);
  v_descripcion := left(trim(coalesce(p_descripcion, '')), 500);

  IF v_tabla = '' THEN v_tabla := NULL; END IF;
  IF v_registro_id = '' THEN v_registro_id := NULL; END IF;
  IF v_descripcion = '' THEN v_descripcion := NULL; END IF;

  -- E. Metadata debe ser NULL o un objeto JSON (no array/string/number/boolean)
  IF p_metadata IS NULL THEN
    v_metadata := '{}'::jsonb;
  ELSIF jsonb_typeof(p_metadata) = 'object' THEN
    v_metadata := p_metadata;
  ELSE
    v_metadata := '{}'::jsonb;
  END IF;

  -- F. Tamaño máximo de metadata serializada (4000 caracteres)
  IF length(v_metadata::text) > 4000 THEN
    v_metadata := '{}'::jsonb;
  END IF;

  -- G. Rechazar metadata si alguna clave de primer nivel coincide con un término sensible
  --    (substring, case-insensitive, sobre las claves del objeto — no sobre los valores)
  FOR v_key IN SELECT jsonb_object_keys(v_metadata) LOOP
    IF lower(v_key) ~ '(dni|documento|password|token|secret|key|email|telefono|direcci[oó]n|beneficiario|cuenta|tarjeta|auth|session|cookie|supabase)' THEN
      v_metadata := '{}'::jsonb;
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.auditoria (
    id_usuario,
    actor_email,
    actor_rol,
    modulo,
    accion,
    tabla_afectada,
    registro_id,
    descripcion,
    metadata,
    fecha_hora
  ) VALUES (
    v_user_id,
    v_email,
    v_rol,
    v_modulo,
    v_accion,
    v_tabla,
    v_registro_id,
    v_descripcion,
    v_metadata,
    now()
  );
END;
$$;

-- Revocar ejecución pública y conceder solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.registrar_auditoria(text, text, text, text, text, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, text, text, jsonb)
  TO authenticated;

-- Nota: Supabase configura ALTER DEFAULT PRIVILEGES para conceder EXECUTE a
-- anon/authenticated/service_role automáticamente en funciones nuevas del schema
-- public. Esto significa que `REVOKE ALL ... FROM PUBLIC` NO retira el privilegio
-- explícito de `anon` (no es la pseudo-role PUBLIC). Se revoca explícitamente aquí
-- para que solo `authenticated` (y `service_role`, que ya bypassa RLS) puedan
-- ejecutar la función — coincide con el diseño de la RPC (requiere sesión real).
REVOKE EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, text, text, jsonb)
  FROM anon;

COMMIT;

-- ─── ROLLBACK (solo para emergencias) ────────────────────────────────────────
-- BEGIN;
-- -- Restaurar INSERT directo (estado SEC-3E):
-- DROP POLICY IF EXISTS auditoria_select ON public.auditoria;
-- CREATE POLICY auditoria_select ON public.auditoria FOR SELECT USING (auth.uid() IS NOT NULL);
-- CREATE POLICY auditoria_insert ON public.auditoria FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- -- Eliminar RPC:
-- DROP FUNCTION IF EXISTS public.registrar_auditoria(text, text, text, text, text, jsonb);
-- -- Eliminar columnas agregadas (CUIDADO: perderá datos en esas columnas):
-- ALTER TABLE public.auditoria
--   DROP COLUMN IF EXISTS actor_email,
--   DROP COLUMN IF EXISTS actor_rol,
--   DROP COLUMN IF EXISTS tabla_afectada,
--   DROP COLUMN IF EXISTS metadata,
--   DROP COLUMN IF EXISTS ip_hash;
-- COMMIT;
