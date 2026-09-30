// Debe mantenerse sincronizado manualmente con
// StockManager.Application/DTOs/NotificacionInternaDtos.cs en el backend.

export type TipoNotificacionInterna = 'StockBajo' | 'PedidoNuevo' | 'CuentaPorPagarProximaAVencer';

// Debe coincidir con los valores de EntidadTipo que usa el backend al crear cada
// NotificacionInterna (ver GenerarNotificacionInternaSiAplicaAsync y
// NotificacionesStockBajoCheckService).
export type EntidadNotificacion = 'Producto' | 'Pedido' | 'CuentaPorPagar';

export interface NotificacionInterna {
  id: number;
  tipo: TipoNotificacionInterna;
  titulo: string;
  mensaje: string;
  entidadTipo: EntidadNotificacion;
  entidadId: number;
  fechaCreacion: string;
  leida: boolean;
}
