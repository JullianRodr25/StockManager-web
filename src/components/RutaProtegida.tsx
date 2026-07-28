import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RutaProtegidaProps {
  children: ReactNode;
  rolesPermitidos?: Array<'Admin' | 'Empleado'>;
}

export function RutaProtegida({ children, rolesPermitidos }: RutaProtegidaProps) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    // Evita un "flash" a la pantalla de login mientras se verifica
    // si ya existía un token guardado en localStorage.
    return null;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
