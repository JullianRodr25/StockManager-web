import type { MetodoPagoVenta, DetallePagoRequest } from '@/types/ventas';

// "Vencida" no se guarda en el servidor: es una cotización Vigente cuyo plazo ya pasó.
export type EstadoCotizacion = 'Vigente' | 'Vencida' | 'Convertida' | 'Anulada';

export interface LineaCotizacion {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  /** Precio ofrecido: es el que se respeta al convertir en venta. */
  precioUnitario: number;
  subtotal: number;
  /** Precio de lista de hoy, para mostrar si cambió desde que se cotizó. */
  precioActual: number;
  stockDisponible: number;
}

export interface Cotizacion {
  id: number;
  numero: string;
  empleadoId: number;
  empleadoNombre: string;
  clienteId: number | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  emailCliente: string | null;
  fecha: string;
  /** 'AAAA-MM-DD' (último día de validez, inclusive). */
  fechaVencimiento: string;
  estado: EstadoCotizacion;
  notas: string | null;
  total: number;
  ventaId: number | null;
  numeroFactura: string | null;
  fechaConversion: string | null;
  lineas: LineaCotizacion[];
}

export interface CotizacionResumen {
  id: number;
  numero: string;
  nombreCliente: string | null;
  empleadoNombre: string;
  fecha: string;
  fechaVencimiento: string;
  estado: EstadoCotizacion;
  total: number;
  cantidadLineas: number;
  ventaId: number | null;
}

export interface CotizacionesPaginadas {
  data: CotizacionResumen[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}

export interface GuardarCotizacionRequest {
  clienteId?: number | null;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  emailCliente?: string | null;
  fechaVencimiento: string;
  notas?: string | null;
  lineas: { productoId: number; cantidad: number; precioUnitario?: number | null }[];
}

export interface ConvertirCotizacionRequest {
  metodoPago: MetodoPagoVenta;
  montoRecibido?: number | null;
  detallesPago?: DetallePagoRequest[];
}

// ----- Reporte -----

export interface CotizacionesPorEstado {
  estado: EstadoCotizacion;
  cantidad: number;
  valor: number;
}

export interface CotizacionesPorEmpleado {
  empleadoId: number;
  empleado: string;
  cantidad: number;
  valor: number;
  convertidas: number;
  valorConvertido: number;
}

export interface ReporteCotizaciones {
  desde: string;
  hasta: string;
  cantidad: number;
  valorCotizado: number;
  valorConvertido: number;
  tasaConversionCantidad: number;
  tasaConversionValor: number;
  porEstado: CotizacionesPorEstado[];
  porEmpleado: CotizacionesPorEmpleado[];
  cotizaciones: CotizacionResumen[];
}
