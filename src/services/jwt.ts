// Decodifica el payload de un JWT en el navegador.
// IMPORTANTE: esto NO verifica la firma del token — la verificación
// real y la única que importa para seguridad ocurre en el backend
// (Program.cs, AddJwtBearer). Esto es solo para leer los claims
// (nombre, rol) y mostrarlos en la UI, no para tomar decisiones
// de seguridad en el cliente.
export interface JwtPayload {
  sub: string; // Id del usuario
  unique_name: string; // NumeroIdentificacion
  given_name: string; // Nombre
  TipoUsuario: 'Empleado' | 'Cliente';
  role?: string; // Solo presente para Empleado
  // .NET (AddJwtBearer con ClaimTypes.Role) emite el claim de rol con
  // esta clave larga en lugar de "role"; se soportan ambas.
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string;
  exp: number;
  iss: string;
  aud: string;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadJson) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload) return true;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowInSeconds;
}
