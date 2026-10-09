// Estos tipos deben mantenerse sincronizados manualmente con los DTOs
// de StockManager.Application/DTOs/ProductoDtos.cs y CategoriaDtos.cs
// en el backend.

export interface Categoria {
  id: number;
  nombre: string;
  // Productos ligados a la categoría (la API lo calcula; ver CategoriaResponse en el backend).
  cantidadProductos: number;
}

export interface ProductoFoto {
  id: number;
  url: string;
  orden: number;
}

export interface Producto {
  id: number;
  nombre: string;
  categoriaId: number;
  precio: number;
  stockActual: number;
  stockMinimo: number;
  codigoBarras: string | null;
  activo: boolean;
  aplicaIva: boolean;
  tarifaIva: number;
  // Costo de adquisición, para métricas de rentabilidad. Nunca se muestra al cliente.
  costo: number;
  proveedorId: number | null;
  // Galería de fotos del producto (carrusel), ordenadas. Ver StockManager.Domain.Entities.Producto.MaxFotos.
  fotos: ProductoFoto[];
}

// Máximo de fotos por producto — debe coincidir con Producto.MaxFotos en el backend.
export const MAX_FOTOS_PRODUCTO = 6;

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
  aplicaIva: boolean;
  tarifaIva?: number;
  costo: number;
  proveedorId?: number | null;
}

// Igual que CrearProductoRequest pero sin stockInicial: el stock actual
// no se edita desde este formulario, solo desde ventas/movimientos.
export interface ActualizarProductoRequest {
  nombre: string;
  categoriaId: number;
  precio: number;
  stockMinimo: number;
  codigoBarras?: string;
  aplicaIva: boolean;
  tarifaIva?: number;
  costo: number;
  proveedorId?: number | null;
}

export interface ImportarProductoError {
  fila: number;
  mensaje: string;
}

export interface ImportarProductosErrorResponse {
  errores: ImportarProductoError[];
}

export interface ImportarProductosResponse {
  totalFilas: number;
  creados: number;
  modificados: number;
  sinCambios: number;
  /** true solo si los cambios se guardaron; false en la vista previa o si hubo errores. */
  aplicado: boolean;
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
