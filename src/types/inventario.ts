// Estos tipos deben mantenerse sincronizados manualmente con los DTOs
// de StockManager.Application/DTOs/ProductoDtos.cs y CategoriaDtos.cs
// en el backend.

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  nombre: string;
  categoriaId: number;
  precio: number;
  stockActual: number;
  stockMinimo: number;
  codigoBarras: string | null;
}

export interface ProductosPaginados {
  data: Producto[];
  pagina: number;
  tamanoPagina: number;
  total: number;
  totalPaginas: number;
}

export interface CrearProductoRequest {
  nombre: string;
  categoriaId: number;
  precio: number;
  stockInicial: number;
  stockMinimo: number;
  codigoBarras?: string;
}

export interface ImportarProductoError {
  fila: number;
  mensaje: string;
}

export interface ImportarProductosResponse {
  totalFilas: number;
  creados: number;
  errores: ImportarProductoError[];
}

export interface EtiquetaPendiente {
  productoId: number;
  nombre: string;
  codigoBarras: string;
}

export interface EtiquetasPendientesResponse {
  total: number;
  etiquetas: EtiquetaPendiente[];
}

export interface EtiquetaGenerada {
  productoId: number;
  codigoBarras: string;
  imagenBase64: string;
}

export interface GenerarEtiquetasResponse {
  total: number;
  etiquetas: EtiquetaGenerada[];
}
