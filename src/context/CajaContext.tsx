import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { obtenerTurnoActual } from '@/services/cajaService';
import { esOperativo } from '@/utils/permisos';
import type { TurnoCaja } from '@/types/caja';

interface CajaContextValue {
  /** Turno abierto del usuario, o null si no tiene (o todavía no se sabe: ver `cargando`). */
  turno: TurnoCaja | null;
  cargando: boolean;
  hayTurnoAbierto: boolean;
  /** Vuelve a consultar el turno al servidor (ej. después de registrar ventas, para ver totales). */
  refrescar: () => Promise<void>;
  /** Fija el turno sin consultar: se usa tras abrir/cerrar, cuando la respuesta ya lo trae. */
  establecerTurno: (turno: TurnoCaja | null) => void;
}

const CajaContext = createContext<CajaContextValue | undefined>(undefined);

/**
 * Comparte el turno de caja abierto con toda la app: la pantalla de Caja lo gestiona, y Ventas
 * lo consulta para no ofrecer cobros en efectivo si no hay caja abierta. Un solo estado
 * compartido evita que cada pantalla lo pida por su cuenta y se desincronicen.
 */
export function CajaProvider({ children }: { children: ReactNode }) {
  const { usuario, token } = useAuth();
  const [turno, setTurno] = useState<TurnoCaja | null>(null);
  const [cargando, setCargando] = useState(false);

  const operativo = esOperativo(usuario?.rol);

  const refrescar = useCallback(async () => {
    if (!token || !operativo) {
      setTurno(null);
      return;
    }
    try {
      setTurno(await obtenerTurnoActual(token));
    } catch {
      // Si falla la consulta no se bloquea la app: la pantalla de Caja vuelve a intentarlo y
      // el backend sigue siendo quien rechaza un cobro en efectivo sin turno.
    }
  }, [token, operativo]);

  useEffect(() => {
    if (!token || !operativo) {
      setTurno(null);
      return;
    }
    setCargando(true);
    refrescar().finally(() => setCargando(false));
  }, [token, operativo, refrescar]);

  const valor = useMemo<CajaContextValue>(
    () => ({ turno, cargando, hayTurnoAbierto: turno !== null, refrescar, establecerTurno: setTurno }),
    [turno, cargando, refrescar]
  );

  return <CajaContext.Provider value={valor}>{children}</CajaContext.Provider>;
}

export function useCaja(): CajaContextValue {
  const context = useContext(CajaContext);
  if (!context) {
    throw new Error('useCaja debe usarse dentro de un CajaProvider');
  }
  return context;
}
