import type { SupabaseClient } from '@supabase/supabase-js'

// Fase 10K-3C — helper tipado para llamar la RPC transaccional
// `registrar_pago_con_aplicacion` (aplicada en Supabase en Fase 10K-3B).
// Reemplaza el flujo viejo de pagos/nuevo/page.tsx (insert directo +
// decrementar_saldo_capital + update manual de 1 cuota).

export type RegistrarPagoPayload = {
  nroRecibo: string
  idSocio: number
  idCredito: number | null
  idConvenio: number | null
  fecha: string
  periodo: string
  canalPago: string
  tipoPago: string | null
  montoAporte: number
  montoCapital: number
  montoInteres: number
  montoFps: number
  montoFpsExtra: number
  montoOtros: number
  interesAmortizadoPagado: number
  observacion: string | null
}

export type CuotaAfectada = {
  id_cuota: number
  capital_aplicado: number
  interes_aplicado: number
  estado_resultante: 'pagada' | 'parcial'
}

export type RegistrarPagoResultado = {
  id_pago: number
  id_credito: number | null
  monto_credito_aplicado: number
  cuotas_afectadas: CuotaAfectada[]
  cuotas_pagadas: number
  cuotas_parciales: number
  excedente: number
  aplicaciones_insertadas: number
  advertencias: string[]
}

const CODIGOS_CONOCIDOS = [
  'sin_sesion',
  'rol_no_autorizado',
  'nro_recibo_requerido',
  'socio_requerido',
  'socio_no_encontrado',
  'fecha_requerida',
  'periodo_invalido',
  'monto_invalido',
  'recibo_duplicado',
  'monto_credito_sin_credito',
  'credito_no_encontrado',
  'credito_cancelado_no_admite_pagos',
] as const

export type RegistrarPagoErrorCodigo = typeof CODIGOS_CONOCIDOS[number] | 'desconocido'

export class RegistrarPagoError extends Error {
  codigo: RegistrarPagoErrorCodigo

  constructor(codigo: RegistrarPagoErrorCodigo, message: string) {
    super(message)
    this.codigo = codigo
  }
}

function parseCodigo(mensaje: string): RegistrarPagoErrorCodigo {
  const match = mensaje.match(/^([a-z_]+):/)
  const codigo = match?.[1]
  return (CODIGOS_CONOCIDOS as readonly string[]).includes(codigo ?? '')
    ? (codigo as RegistrarPagoErrorCodigo)
    : 'desconocido'
}

export async function registrarPagoConAplicacion(
  supabase: SupabaseClient,
  payload: RegistrarPagoPayload
): Promise<RegistrarPagoResultado> {
  const { data, error } = await supabase.rpc('registrar_pago_con_aplicacion', {
    p_nro_recibo: payload.nroRecibo,
    p_id_socio: payload.idSocio,
    p_id_credito: payload.idCredito,
    p_id_convenio: payload.idConvenio,
    p_fecha: payload.fecha,
    p_periodo: payload.periodo,
    p_canal_pago: payload.canalPago,
    p_tipo_pago: payload.tipoPago,
    p_monto_aporte: payload.montoAporte,
    p_monto_capital: payload.montoCapital,
    p_monto_interes: payload.montoInteres,
    p_monto_fps: payload.montoFps,
    p_monto_fps_extra: payload.montoFpsExtra,
    p_monto_otros: payload.montoOtros,
    p_interes_amortizado_pagado: payload.interesAmortizadoPagado,
    p_observacion: payload.observacion,
  })

  if (error) {
    throw new RegistrarPagoError(parseCodigo(error.message), error.message)
  }

  return data as RegistrarPagoResultado
}

export function mensajeErrorAmigable(err: RegistrarPagoError): string {
  switch (err.codigo) {
    case 'recibo_duplicado':
      return 'Ya existe un pago registrado con este número de recibo.'
    case 'credito_cancelado_no_admite_pagos':
      return 'Este crédito está cancelado y no admite pagos nuevos de capital/interés.'
    case 'credito_no_encontrado':
      return 'El crédito seleccionado no existe.'
    case 'monto_credito_sin_credito':
      return 'Para registrar capital o interés debes tener un crédito seleccionado.'
    case 'rol_no_autorizado':
      return 'Tu rol no tiene permiso para registrar pagos.'
    case 'sin_sesion':
      return 'Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.'
    case 'nro_recibo_requerido':
      return 'El número de recibo es obligatorio.'
    case 'socio_no_encontrado':
      return 'El socio seleccionado no existe.'
    case 'periodo_invalido':
      return 'El periodo debe tener el formato YYYY-MM.'
    case 'monto_invalido':
      return 'El monto total del recibo debe ser mayor a 0.'
    default:
      return err.message
  }
}
