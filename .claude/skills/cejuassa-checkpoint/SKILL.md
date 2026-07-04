# Skill: cejuassa-checkpoint

Activa este skill antes de `/compact`, `/clear` o al terminar una sesión de trabajo.
Sirve para preservar el estado del proyecto y garantizar que la próxima sesión pueda continuar sin perder contexto.

## Modo autónomo controlado

Ejecutar en orden sin pedir confirmación:
1. Registrar cambios de la sesión.
2. Actualizar los documentos que correspondan.
3. Generar resumen de continuación.
4. No imprimir documentos completos — solo los cambios realizados.
5. Responder con resumen breve al final.

## Protocolo

### Paso 1 — Registrar cambios de esta sesión
- ¿Qué archivos se modificaron?
- ¿Qué funcionalidad se implementó o corrigió?
- ¿Quedó algo a medias?

### Paso 2 — Actualizar documentación si aplica

**`docs/ai-recovery/AI_HANDOFF.md`** — actualizar si:
- Se agregaron tablas o campos nuevos a la base de datos.
- Cambió el flujo de algún módulo.
- Se descubrieron nuevas reglas de negocio.
- Se resolvió un riesgo listado.

**`docs/ai-recovery/NEXT_STEPS.md`** — actualizar si:
- Se completó alguno de los pasos recomendados.
- Surgieron nuevos pasos como consecuencia del trabajo.

**`docs/ai-recovery/RISKS_AND_BUGS.md`** — actualizar si:
- Se corrigió un bug confirmado.
- Se descubrió un riesgo nuevo.
- Cambió la mitigación de un riesgo existente.

### Paso 3 — Generar resumen de continuación
Bloque de texto corto (máximo 10 líneas) con:
- Estado actual del proyecto.
- Último cambio implementado.
- Próximo paso recomendado.
- Archivos más relevantes para la próxima sesión.

## Definition of Done
El checkpoint está completo cuando los tres documentos relevantes fueron actualizados y el resumen de continuación fue generado.

## Cuándo usar este skill
- Antes de `/compact` o `/clear`.
- Al terminar una sesión de trabajo larga.
- Cuando el contexto empiece a llenarse.
- Después de implementar una funcionalidad completa.
