import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PantallaCargaLogo } from './PantallaCargaLogo';
import { rutaInicialDe } from '../utils/permisos';
import type { RolUsuario } from '../types/auth';

interface RutaProtegidaProps {
  children: ReactNode;
  rolesPermitidos?: RolUsuario[];
}

export function RutaProtegida({ children, rolesPermitidos }: RutaProtegidaProps) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    // Antes era un "flash" en blanco mientras se verificaba si ya existía un token guardado en
    // localStorage; ahora se ve el logo de la marca en vez de nada.
    return <PantallaCargaLogo variante="completa" />;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    // Cada rol vuelve a SU pantalla inicial (el de solo consulta no tiene Dashboard), así no
    // se produce un bucle de redirecciones.
    return <Navigate to={rutaInicialDe(usuario.rol)} replace />;
  }

  return <>{children}</>;
}
