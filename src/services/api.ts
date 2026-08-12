// Cliente HTTP centralizado. Toda llamada a la API pasa por aquí,
// para tener en un solo lugar: la URL base, el header de
// autorización, y el manejo de errores.

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'https://localhost:7009';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

function obtenerMensajeError(data: unknown, mensajePredeterminado: string): string {
  if (!data || typeof data !== 'object') return mensajePredeterminado;

  if ('message' in data && typeof data.message === 'string') {
    return data.message;
  }

  if ('errors' in data && typeof data.errors === 'object' && data.errors !== null) {
    const mensajes = Object.values(data.errors).flatMap((errores) =>
      Array.isArray(errores) ? errores.filter((error): error is string => typeof error === 'string') : []
    );
    if (mensajes.length > 0) return mensajes[0];
  }

  if ('detail' in data && typeof data.detail === 'string' && data.detail) {
    return data.detail;
  }

  if ('title' in data && typeof data.title === 'string' && data.title) {
    return data.title;
  }

  return mensajePredeterminado;
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {}
): Promise<TResponse> {
  const { method = 'GET', body, token } = options;
  const esFormData = body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!esFormData) {
    // Para FormData (subida de archivos) el navegador debe fijar el
    // Content-Type con el boundary correcto; no se debe sobreescribir.
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: esFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // El backend devuelve { message: "..." } en errores 400/401,
    // según lo definido en AuthController.
    let message = 'Ocurrió un error inesperado.';
    let data: unknown;
    try {
      data = await response.json();
      message = obtenerMensajeError(data, message);
    } catch {
      // La respuesta no tenía JSON (ej. error 500 sin body), se
      // usa el mensaje genérico.
    }
    throw new ApiError(message, response.status, data);
  }

  // Algunos endpoints (ej. futuros DELETE) pueden no devolver body.
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<TResponse>;
  }
  return undefined as TResponse;
}
