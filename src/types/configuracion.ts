// Debe mantenerse sincronizado manualmente con el DTO de configuración
// general del backend (StockManager.Application/DTOs/ConfiguracionDtos.cs).

export interface ConfiguracionGeneral {
  tarifaIvaPorDefecto: number;
  /** Teléfono de WhatsApp (E.164) que recibe las alertas administrativas. null si está desactivado. */
  telefonoNotificacionesAdmin: string | null;
  /** Nombre de la impresora térmica de tiquetes (tal como la ve QZ Tray). null si no está configurada. */
  nombreImpresoraTickets: string | null;
  /** Razón social que se imprime en el encabezado de la factura/tiquete. null si no se ha configurado. */
  nombreEmpresa: string | null;
  nitEmpresa: string | null;
  direccionEmpresa: string | null;
  telefonoEmpresa: string | null;
  emailEmpresa: string | null;
  /** Datos de facturación (todos opcionales; Gold los crea/edita en Configuración). */
  ciudadEmpresa: string | null;
  barrioEmpresa: string | null;
  responsabilidadIvaEmpresa: string | null;
  actividadEconomicaEmpresa: string | null;
  resolucionDianNumero: string | null;
  /** Fecha ISO (yyyy-MM-dd…) de la resolución DIAN. */
  resolucionDianFecha: string | null;
  resolucionDianPrefijo: string | null;
  resolucionDianRangoDesde: number | null;
  resolucionDianRangoHasta: number | null;
  resolucionDianVigenciaMeses: number | null;
  textoLegalFactura: string | null;
  politicaCambiosFactura: string | null;
}

// El backend actualiza la fila de Configuracion completa en un solo PUT (no hay PATCH parcial),
// así que quien arma este objeto debe incluir siempre todos los campos (los no editados se envían
// con su valor actual, tomado de ConfiguracionGeneral) para no pisarlos con un default.
export interface ActualizarConfiguracionRequest {
  tarifaIvaPorDefecto: number;
  telefonoNotificacionesAdmin: string | null;
  nombreImpresoraTickets: string | null;
  nombreEmpresa: string | null;
  nitEmpresa: string | null;
  direccionEmpresa: string | null;
  telefonoEmpresa: string | null;
  emailEmpresa: string | null;
  /** Datos de facturación (todos opcionales; Gold los crea/edita en Configuración). */
  ciudadEmpresa: string | null;
  barrioEmpresa: string | null;
  responsabilidadIvaEmpresa: string | null;
  actividadEconomicaEmpresa: string | null;
  resolucionDianNumero: string | null;
  /** Fecha ISO (yyyy-MM-dd…) de la resolución DIAN. */
  resolucionDianFecha: string | null;
  resolucionDianPrefijo: string | null;
  resolucionDianRangoDesde: number | null;
  resolucionDianRangoHasta: number | null;
  resolucionDianVigenciaMeses: number | null;
  textoLegalFactura: string | null;
  politicaCambiosFactura: string | null;
}
