import { apiRequest } from './api';
import type {
  ActualizarProductoRequest,
  Categoria,
  CrearProductoRequest,
  EtiquetasPendientesResponse,
  GenerarEtiquetasResponse,
  ImportarProductosResponse,
  Producto,
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

export async function importarProductos(
  archivo: File,
  token: string | null
): Promise<ImportarProductosResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return apiRequest<ImportarProductosResponse>('/api/productos/importar', {
    method: 'POST',
    body: formData,
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
