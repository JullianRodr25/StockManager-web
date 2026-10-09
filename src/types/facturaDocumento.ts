// Debe mantenerse sincronizado con StockManager.Application/DTOs/FacturaDocumentoDtos.cs.
// Es el modelo único de lo que se imprime en la factura (tiquete térmico y vista digital).

export interface FacturaEmisor {
  nombre: string | null;
  nit: string | null;
  direccion: string | null;
  barrio: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  responsabilidadIva: string | null;
  actividadEconomica: string | null;
  /** Frase ya armada de la resolución DIAN; null si no está configurada. */
  resolucionDianTexto: string | null;
}

export interface FacturaComprador {
  clienteId: number | null;
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  direccion: string | null;
  telefono: string | null;
  direccionEntrega: string | null;
  /** Comprador sin registrar: se muestra "CLIENTE FINAL" y no se guarda nada. */
  esClienteFinal: boolean;
  faltaDocumento: boolean;
  faltaDireccion: boolean;
}

export interface FacturaLinea {
  producto: string;
  cantidad: number;
  precioUnitario: number;
  tarifaIva: number;
  total: number;
}

export interface FacturaResumenIva {
  tarifa: number;
  base: number;
  iva: number;
}

export interface FacturaDocumento {
  numero: string;
  fecha: string;
  vendedor: string | null;
  emisor: FacturaEmisor;
  comprador: FacturaComprador;
  lineas: FacturaLinea[];
  resumenIva: FacturaResumenIva[];
  subtotalBase: number;
  totalIva: number;
  total: number;
  pagos: { metodoPago: string; monto: number }[];
  montoRecibido: number | null;
  cambio: number | null;
  textoLegal: string | null;
  politicaCambios: string | null;
}
