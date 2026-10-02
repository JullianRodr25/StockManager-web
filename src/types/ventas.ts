// Estos tipos deben mantenerse sincronizados manualmente con
// StockManager.Application/DTOs/VentaDtos.cs en el backend.

import type { TipoDocumentoFiscal } from './clientes';

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia';

// Estado de la solicitud de factura electrónica de una venta (ver Venta.cs / DIAN DEE POS).
// "NoAplica" = no se solicitó; "Pendiente" = solicitada pero aún no transmitida a un proveedor
// certificado; "Transmitida"/"Error" quedan reservados para cuando se integre un proveedor real.
export type EstadoFacturaElectronica = 'NoAplica' | 'Pendiente' | 'Transmitida' | 'Error';

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
  // Si es true, la venta queda marcada para factura electrónica (estado "Pendiente"). Los
  // campos fiscales de abajo son opcionales: si se omiten, el backend los toma del Cliente
  // (cuando hay clienteId); solo son obligatorios cuando no hay cliente con esos datos ya
  // guardados (p. ej. un comprador sin registrar).
  requiereFacturaElectronica?: boolean;
  tipoDocumentoFiscal?: TipoDocumentoFiscal | null;
  numeroDocumentoFiscal?: string | null;
  razonSocialFiscal?: string | null;
  direccionFiscal?: string | null;
  emailFacturacion?: string | null;
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
  requiereFacturaElectronica: boolean;
  estadoFacturaElectronica: EstadoFacturaElectronica;
  tipoDocumentoFacturado: TipoDocumentoFiscal | null;
  numeroDocumentoFacturado: string | null;
  razonSocialFacturada: string | null;
  direccionFacturada: string | null;
  emailFacturacion: string | null;
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

// Solo trae id y nombre: el resto de los datos para agregarlo al carrito (precio, stock, IVA)
// ya están en la lista de productos que Ventas carga aparte, así que acá solo hace falta saber
// cuáles son y en qué orden (más reciente primero).
export interface ProductoVentaReciente {
  productoId: number;
  nombre: string;
}
