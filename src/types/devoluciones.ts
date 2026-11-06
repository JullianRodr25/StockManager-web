import type { MetodoPago } from './ventas';

export interface LineaDevolucionRequest {
  detalleVentaId: number;
  cantidad: number;
  /** false cuando el producto vuelve dañado y no debe sumarse al inventario. */
  reintegrarAlStock: boolean;
}

export interface LineaCambioRequest {
  productoId: number;
  cantidad: number;
}

export interface RegistrarDevolucionRequest {
  motivo: string;
  devueltas: LineaDevolucionRequest[];
  /** Lo que el cliente se lleva a cambio; vacío o ausente = devolución pura. */
  cambio?: LineaCambioRequest[];
  /** Con qué se paga o reembolsa la diferencia; se ignora si la diferencia es cero. */
  metodoPago?: MetodoPago;
}

export interface DetalleDevolucionResponse {
  id: number;
  sentido: 'Devuelto' | 'Entregado';
  detalleVentaId: number | null;
  productoId: number;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  reintegradoAlStock: boolean;
}

export interface DevolucionResponse {
  id: number;
  ventaId: number;
  empleadoId: number;
  nombreEmpleado: string | null;
  fecha: string;
  motivo: string;
  totalDevuelto: number;
  totalCambio: number;
  /** Positivo: el cliente pagó la diferencia. Negativo: se le reembolsó. Cero: sin movimiento de dinero. */
  diferencia: number;
  metodoPago: string | null;
  requiereNotaCredito: boolean;
  detalles: DetalleDevolucionResponse[];
}
