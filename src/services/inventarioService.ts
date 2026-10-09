import { apiDescargarArchivo, apiRequest } from './api';
import type {
  ActualizarProductoRequest,
  Categoria,
  CrearProductoRequest,
  EtiquetasPendientesResponse,
  GenerarEtiquetasResponse,
  ImportarProductosResponse,
  Producto,
  ProductoFoto,
  ProductosPaginados,
} from '../types/inventario';

export async function obtenerCategorias(token: string | null): Promise<Categoria[]> {
  return apiRequest<Categoria[]>('/api/categorias', { token });
}

export async function crearCategoria(nombre: string, token: string | null): Promise<Categoria> {
  return apiRequest<Categoria>('/api/categorias', {
    method: 'POST',
    body: { nombre },
    token,
  });
}

export async function obtenerProductos(
  pagina: number,
  tamanoPagina: number,
  token: string | null,
  categoriaId?: number
): Promise<ProductosPaginados> {
  const params = new URLSearchParams({
    pagina: String(pagina),
    tamanoPagina: String(tamanoPagina),
  });
  if (categoriaId !== undefined) {
    params.set('categoriaId', String(categoriaId));
  }
  return apiRequest<ProductosPaginados>(`/api/productos?${params.toString()}`, { token });
}

/** Productos activos con stock igual o por debajo del mínimo (agotados primero). */
export async function obtenerAlertasStock(token: string | null): Promise<Producto[]> {
  return apiRequest<Producto[]>('/api/productos/alertas-stock', { token });
}

export async function obtenerProductoPorId(id: number, token: string | null): Promise<Producto> {
  return apiRequest<Producto>(`/api/productos/${id}`, { token });
}

export async function buscarProductoPorCodigoBarras(
  codigo: string,
  token: string | null
): Promise<Producto> {
  return apiRequest<Producto>(`/api/productos/buscar-codigo-barras/${codigo}`, { token });
}

export async function crearProducto(
  data: CrearProductoRequest,
  token: string | null
): Promise<Producto> {
  return apiRequest<Producto>('/api/productos', {
    method: 'POST',
    body: data,
    token,
  });
}

export async function actualizarProducto(
  id: number,
  data: ActualizarProductoRequest,
  token: string | null
): Promise<Producto> {
  return apiRequest<Producto>(`/api/productos/${id}`, {
    method: 'PUT',
    body: data,
    token,
  });
}

export async function desactivarProducto(id: number, token: string | null): Promise<void> {
  return apiRequest<void>(`/api/productos/${id}`, {
    method: 'DELETE',
    token,
  });
}

export async function reactivarProducto(id: number, token: string | null): Promise<void> {
  return apiRequest<void>(`/api/productos/${id}/reactivar`, {
    method: 'PATCH',
    token,
  });
}

// delta puede ser positivo (sumar, ej. llegó mercancía) o negativo (restar, ej. corregir un
// conteo físico); el backend valida que el resultado no quede negativo.
export async function ajustarStock(id: number, delta: number, token: string | null): Promise<Producto> {
  return apiRequest<Producto>(`/api/productos/${id}/ajustar-stock`, {
    method: 'PATCH',
    body: { delta },
    token,
  });
}

/**
 * Importa el Excel. Con `soloValidar` el backend devuelve la vista previa sin guardar nada;
 * sin él aplica los cambios, pero solo si todas las filas son válidas (todo o nada).
 */
export async function importarProductos(
  archivo: File,
  token: string | null,
  soloValidar = false
): Promise<ImportarProductosResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return apiRequest<ImportarProductosResponse>(`/api/productos/importar?soloValidar=${soloValidar}`, {
    method: 'POST',
    body: formData,
    token,
  });
}

// Galería de fotos del producto (api/productos/{id}/fotos). Depende de que el backend tenga
// configurado Azure Blob Storage — ver ProductoFotosController en el backend.
export async function agregarFotoProducto(
  productoId: number,
  archivo: File,
  token: string | null
): Promise<ProductoFoto> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return apiRequest<ProductoFoto>(`/api/productos/${productoId}/fotos`, {
    method: 'POST',
    body: formData,
    token,
  });
}

export async function eliminarFotoProducto(
  productoId: number,
  fotoId: number,
  token: string | null
): Promise<void> {
  return apiRequest<void>(`/api/productos/${productoId}/fotos/${fotoId}`, {
    method: 'DELETE',
    token,
  });
}

export async function obtenerEtiquetasPendientes(
  token: string | null
): Promise<EtiquetasPendientesResponse> {
  return apiRequest<EtiquetasPendientesResponse>('/api/productos/etiquetas-pendientes', { token });
}

export async function generarEtiquetas(
  productoIds: number[],
  token: string | null
): Promise<GenerarEtiquetasResponse> {
  return apiRequest<GenerarEtiquetasResponse>('/api/productos/generar-etiquetas', {
    method: 'POST',
    body: productoIds,
    token,
  });
}

// Excel de productos. Se piden con fetch + token (no con un enlace directo) porque los endpoints
// exigen el header Authorization; el nombre del archivo lo decide quien llama (ver Inventario.tsx).
export async function descargarPlantillaProductos(token: string | null): Promise<Blob> {
  return apiDescargarArchivo('/api/productos/plantilla-excel', token);
}

export async function exportarInventario(token: string | null): Promise<Blob> {
  return apiDescargarArchivo('/api/productos/exportar', token);
}
