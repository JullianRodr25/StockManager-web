import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PantallaCargaLogo } from './PantallaCargaLogo';

interface RutaProtegidaProps {
  children: ReactNode;
  rolesPermitidos?: Array<'Admin' | 'Empleado'>;
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
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
