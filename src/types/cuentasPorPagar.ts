// Debe mantenerse sincronizado manualmente con StockManager.Application/DTOs/CuentaPorPagarDtos.cs
// en el backend.

import type { MetodoPago } from './ventas';

// "Vencida" NO es un valor posible de este campo: es un estado derivado (ver campo `vencida`
// en CuentaPorPagarResponse/ResumenResponse), calculado por el backend a partir de Estado +
// FechaVencimiento en vez de persistirse aparte.
export type EstadoCuentaPorPagar = 'Pendiente' | 'Pagada' | 'Cancelada';

export interface CrearCuentaPorPagarRequest {
  proveedorId: number;
  concepto: string;
  montoTotal: number;
  fechaVencimiento: string;
}

export interface RegistrarAbonoCuentaPorPagarRequest {
  monto: number;
  metodoPago: MetodoPago;
}

export interface AbonoCuentaPorPagarResponse {
  id: number;
  monto: number;
  metodoPago: string;
  fecha: string;
  empleadoId: number;
}

export interface CuentaPorPagarResponse {
  id: number;
  proveedorId: number;
  proveedorNombre: string;
  concepto: string;
  montoTotal: number;
  saldoPendiente: number;
  fechaCompra: string;
  fechaVencimiento: string;
  estado: string;
  vencida: boolean;
  abonos: AbonoCuentaPorPagarResponse[];
}

export interface CuentaPorPagarResumenResponse {
  id: number;
  proveedorId: number;
  proveedorNombre: string;
  concepto: string;
  montoTotal: number;
  saldoPendiente: number;
  fechaVencimiento: string;
  estado: string;
  vencida: boolean;
}

export interface CuentasPorPagarPaginadasResponse {
  data: CuentaPorPagarResumenResponse[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}
