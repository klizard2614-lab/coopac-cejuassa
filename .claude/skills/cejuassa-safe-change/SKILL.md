# Skill: cejuassa-safe-change

Activa este skill antes de cualquier cambio de código en el proyecto CEJUASSA.

## Modo autónomo controlado

Dentro del alcance aprobado, Claude Code trabaja sin pedir confirmación en cada paso:

1. Leer solo los archivos necesarios para el cambio.
2. Hacer un plan breve (qué cambia, qué no cambia, riesgo de rotura).
3. Implementar el cambio.
4. Ejecutar verificación obligatoria según corresponda:
   - `npm run lint` — siempre
   - `npx tsc --noEmit` — si se tocaron tipos, interfaces o props
   - `npm run build` — si el cambio afecta rutas, layouts o lógica de servidor
5. Si aparecen errores causados por el cambio, corregirlos automáticamente y repetir verificación.
6. Repetir hasta que pase o hasta detectar un bloqueo real.
7. No dar la tarea por terminada si la verificación no pasó.
8. No imprimir archivos completos ni logs largos — solo errores relevantes.
9. Responder al final con resumen breve: qué cambió, qué verificó, qué resultado.

## Hard stops — pedir permiso antes de

- Crear o modificar SQL, RPC, triggers o migraciones.
- Tocar `SUPABASE_SERVICE_ROLE_KEY` o variables `.env`.
- Instalar paquetes.
- Borrar archivos.
- Hacer refactor global (renombrar variables, reorganizar módulos).
- Modificar lógica financiera fuera del alcance aprobado.
- Tocar reportes regulatorios SBS sin plan aprobado.

## Definition of Done

Una tarea solo puede marcarse como terminada si:
- El cambio fue implementado.
- Lint / typecheck / build fue ejecutado según corresponda.
- Los errores causados por el cambio fueron corregidos.
- No quedan errores nuevos conocidos.
- Se actualizó `docs/ai-recovery/` si cambió un riesgo, flujo o decisión.

---

## Protocolo de cambio (pasos en orden)

### Paso 1 — Leer contexto
Leer `docs/ai-recovery/AI_HANDOFF.md` antes de tocar cualquier archivo.
Si el cambio involucra pagos, créditos o reportes SBS, leer también `docs/ai-recovery/BUSINESS_RULES_FOUND.md`.

### Paso 2 — Identificar alcance mínimo
Listar únicamente los archivos que deben cambiar para cumplir el objetivo.
No incluir archivos "relacionados" que no sean estrictamente necesarios.

### Paso 3 — Declarar el plan
- ¿Qué archivo(s) se modifican?
- ¿Qué líneas o funciones se tocan?
- ¿Qué no se toca?
- ¿Hay riesgo de romper otro módulo?

### Paso 4 — Restricciones permanentes
- NO refactorizar código fuera del alcance del cambio.
- NO renombrar variables, funciones o tipos sin pedirlo explícitamente.
- NO modificar estos archivos críticos sin permiso explícito:
  - `lib/supabase.ts`
  - `app/api/usuarios/invite/route.ts`
  - `app/api/usuarios/update/route.ts`
  - `app/dashboard/reportes/anexo6/page.tsx`
  - `app/dashboard/pagos/utils/generarReciboPDF.ts`
- NO instalar paquetes.
- NO cambiar esquema de base de datos.
- NO ejecutar migraciones.

### Paso 5 — Verificar (obligatorio, no omitir)
Ejecutar verificación según la tabla del Modo autónomo controlado.
Si hay errores, corregir solo lo relacionado al cambio — no arreglar todo en cascada.

## Cuándo usar este skill
Antes de cualquier edición de archivo `.tsx`, `.ts`, `.css` o de configuración del proyecto.
