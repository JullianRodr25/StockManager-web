// Debe mantenerse sincronizado manualmente con
// StockManager.Application/DTOs/DashboardDtos.cs en el backend.

export interface ActividadReciente {
  descripcion: string;
  fecha: string;
}

export interface DashboardResumen {
  ventasHoyTotal: number;
  ventasHoyCantidad: number;
  productosStockBajo: number;
  pedidosActivos: number;
  cuentasPorPagarPorVencer: number;
  totalPorPagarProveedores: number;
  totalPorCobrarFiado: number;
  clientesConFiadoAbierto: number;
  clientesActivos: number;
  actividadReciente: ActividadReciente[];
}
