// Debe mantenerse sincronizado manualmente con el DTO de configuración
// general del backend (StockManager.Application/DTOs/ConfiguracionDtos.cs).

export interface ConfiguracionGeneral {
  tarifaIvaPorDefecto: number;
}

export interface ActualizarConfiguracionRequest {
  tarifaIvaPorDefecto: number;
}
