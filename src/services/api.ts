// Cliente HTTP centralizado. Toda llamada a la API pasa por aquí,
// para tener en un solo lugar: la URL base, el header de
// autorización, y el manejo de errores.

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'https://localhost:7009';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
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
    try {
      const errorData = await response.json();
      message = errorData.message ?? message;
    } catch {
      // La respuesta no tenía JSON (ej. error 500 sin body), se
      // usa el mensaje genérico.
    }
    throw new ApiError(message, response.status);
  }

  // Algunos endpoints (ej. futuros DELETE) pueden no devolver body.
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<TResponse>;
  }
  return undefined as TResponse;
}
