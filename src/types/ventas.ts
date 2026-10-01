// Estos tipos deben mantenerse sincronizados manualmente con
// StockManager.Application/DTOs/VentaDtos.cs en el backend.

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia';

// Método de pago de una venta de mostrador: igual a MetodoPago, más "Mixto" cuando el total
// se reparte entre varios métodos (ver DetallePagoRequest). "Mixto" nunca es válido como
// método de una línea individual del desglose — por eso se mantiene separado de MetodoPago.
export type MetodoPagoVenta = MetodoPago | 'Mixto';

export interface LineaVentaRequest {
  productoId: number;
  cantidad: number;
}

// Una línea del desglose de un pago "Mixto": cuánto de la venta se pagó con este método
// individual. Solo se envía cuando metodoPago es "Mixto"; la suma de todas las líneas debe
// ser exactamente igual al total de la venta (el backend lo valida sin tolerancia).
export interface DetallePagoRequest {
  metodoPago: MetodoPago;
  monto: number;
}

export interface DetallePagoResponse {
  metodoPago: string;
  monto: number;
}

export interface RegistrarVentaRequest {
  clienteId?: number | null;
  nombreComprador?: string | null;
  telefonoComprador?: string | null;
  emailComprador?: string | null;
  metodoPago: MetodoPagoVenta;
  lineas: LineaVentaRequest[];
  // Obligatorio (y validado contra el total) cuando metodoPago es "Efectivo"; en cualquier
  // otro método el backend lo ignora y siempre queda null.
  montoRecibido?: number | null;
  // Obligatorio (al menos dos líneas, suma exacta al total) cuando metodoPago es "Mixto"; en
  // cualquier otro método no debe enviarse.
  detallesPago?: DetallePagoRequest[];
}

export interface DetalleVentaResponse {
  id: number;
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
  numeroFactura: string;
  detalles: DetalleVentaResponse[];
  montoRecibido: number | null;
  cambio: number | null;
  // Solo tiene elementos cuando metodoPago es "Mixto"; en cualquier otro método viene vacío.
  detallesPago?: DetallePagoResponse[];
}

export interface VentaResumenResponse {
  id: number;
  nombreComprador: string | null;
  clienteId: number | null;
  fecha: string;
  estado: string;
  total: number;
  metodoPago: string;
  numeroFactura: string;
}

export interface VentasPaginadasResponse {
  data: VentaResumenResponse[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}

export interface FiltrosVentas {
  desde?: string;
  hasta?: string;
  estado?: string;
}

export interface RegistrarAbonoRequest {
  monto: number;
  metodoPago: MetodoPago;
}

export interface AbonoResponse {
  id: number;
  ventaId: number;
  monto: number;
  metodoPago: string;
  fecha: string;
  empleadoId: number;
}

export interface EditarCantidadLineaRequest {
  cantidad: number;
}
