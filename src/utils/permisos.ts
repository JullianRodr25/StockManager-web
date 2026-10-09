import type { RolUsuario } from '@/types/auth';

// Reglas de acceso de la interfaz en un solo lugar. Son solo comodidad de navegación: la
// seguridad real la aplica el backend con [Authorize(Roles = ...)], que es quien decide qué
// datos se devuelven.

/** Roles que operan el negocio: ventas, pedidos, clientes, proveedores y reportes. */
export const ROLES_OPERATIVOS: RolUsuario[] = ['Admin', 'Empleado'];

/** Todos los roles que pueden ver el inventario. */
export const ROLES_CON_INVENTARIO: RolUsuario[] = ['Admin', 'Empleado', 'Inventario'];

export function esOperativo(rol: RolUsuario | undefined): boolean {
  return rol === 'Admin' || rol === 'Empleado';
}

/** Pantalla a la que va cada rol al entrar o al intentar abrir algo que no le corresponde. */
export function rutaInicialDe(rol: RolUsuario | undefined): string {
  return rol === 'Inventario' ? '/inventario' : '/';
}

/** Dar de alta productos y sumar stock: Admin e Inventario. Los empleados solo consultan. */
export function puedeCrearProductos(rol: RolUsuario | undefined): boolean {
  return rol === 'Admin' || rol === 'Inventario';
}

const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  Admin: 'Administrador',
  Empleado: 'Empleado',
  Inventario: 'Inventario',
};

export function etiquetaDeRol(rol: RolUsuario | undefined): string {
  return rol ? ETIQUETAS_ROL[rol] : '';
}

/** Roles que un administrador puede asignar al crear un usuario, con qué puede hacer cada uno. */
export const ROLES_ASIGNABLES: { valor: RolUsuario; descripcion: string }[] = [
  { valor: 'Empleado', descripcion: 'Vende y opera el negocio: ventas, pedidos, clientes y proveedores.' },
  { valor: 'Inventario', descripcion: 'Consulta el inventario, crea productos nuevos y suma stock. No edita ni resta, no vende ni entra a otros módulos.' },
  { valor: 'Admin', descripcion: 'Acceso completo, incluida la configuración y la edición del inventario.' },
];
