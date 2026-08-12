// Estos tipos deben mantenerse sincronizados manualmente con
// StockManager.Application/DTOs/VentaDtos.cs en el backend.

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia';

export interface LineaVentaRequest {
  productoId: number;
  cantidad: number;
}

export interface RegistrarVentaRequest {
  clienteId?: number | null;
  nombreComprador?: string | null;
  telefonoComprador?: string | null;
  emailComprador?: string | null;
  metodoPago: MetodoPago;
  lineas: LineaVentaRequest[];
}

export interface DetalleVentaResponse {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotalSinIva: number;
  iva: number;
  subtotalConIva: number;
}

export interface VentaResponse {
  id: number;
  clienteId: number | null;
  nombreComprador: string | null;
  telefonoComprador: string | null;
  emailComprador: string | null;
  metodoPago: string;
  empleadoId: number;
  fecha: string;
  estado: string;
  total: number;
  detalles: DetalleVentaResponse[];
}
