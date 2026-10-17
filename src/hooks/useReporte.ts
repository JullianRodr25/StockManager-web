import { useEffect, useState } from 'react';
import { ApiError } from '@/services/api';

interface EstadoReporte<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
}

/**
 * Carga un reporte cada vez que cambian sus parámetros. Ignora respuestas de consultas
 * anteriores (si el usuario cambia el rango rápido, gana la última).
 */
export function useReporte<T>(cargar: () => Promise<T>, dependencias: unknown[]): EstadoReporte<T> {
  const [estado, setEstado] = useState<EstadoReporte<T>>({ datos: null, cargando: true, error: null });

  useEffect(() => {
    let vigente = true;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    cargar()
      .then((datos) => vigente && setEstado({ datos, cargando: false, error: null }))
      .catch((err) => {
        if (!vigente) return;
        const mensaje = err instanceof ApiError ? err.message : 'No se pudo cargar el reporte.';
        setEstado({ datos: null, cargando: false, error: mensaje });
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return estado;
}
