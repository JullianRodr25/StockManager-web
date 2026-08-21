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
