// Debe mantenerse sincronizado manualmente con el DTO de configuración
// general del backend (StockManager.Application/DTOs/ConfiguracionDtos.cs).

export interface ConfiguracionGeneral {
  tarifaIvaPorDefecto: number;
  /** Teléfono de WhatsApp (E.164) que recibe las alertas administrativas. null si está desactivado. */
  telefonoNotificacionesAdmin: string | null;
}

// El backend actualiza la fila de Configuracion completa en un solo PUT (no hay PATCH parcial),
// así que quien arma este objeto debe incluir siempre ambos campos (los no editados se envían
// con su valor actual, tomado de ConfiguracionGeneral) para no pisarlos con un default.
export interface ActualizarConfiguracionRequest {
  tarifaIvaPorDefecto: number;
  telefonoNotificacionesAdmin: string | null;
}
