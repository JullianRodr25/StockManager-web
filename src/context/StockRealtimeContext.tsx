// Conexión en vivo (SignalR) al Hub de stock del backend: cuando cualquier usuario hace algo
// que cambia el stock de un producto (una venta, cerrar una cuenta fiada, un pedido, etc.),
// este contexto recibe el aviso y lo reparte a quien esté suscrito (ver useSincronizacionStock),
// para que la pantalla se actualice sola sin que el usuario tenga que recargar.
//
// Es "mejor esfuerzo" a propósito: si el Hub no está disponible (red restringida, API vieja
// sin este endpoint desplegada todavía, etc.) el resto de la app sigue funcionando exactamente
// igual que antes de que existiera esta funcionalidad — solo no hay actualización en vivo.
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '@/services/api';

export interface CambioStock {
  productoId: number;
  stockActual: number;
}

type Escucha = (cambios: CambioStock[]) => void;

interface StockRealtimeContextValue {
  /** Registra una función a llamar cada vez que llega un aviso de stock. Devuelve cómo darse de baja. */
  suscribir: (escucha: Escucha) => () => void;
}

const StockRealtimeContext = createContext<StockRealtimeContextValue | undefined>(undefined);

export function StockRealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const escuchasRef = useRef<Set<Escucha>>(new Set());

  useEffect(() => {
    if (!token) return;

    const conexion = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/stock`, {
        accessTokenFactory: () => token,
        // No se usan cookies de sesión (la API es JWT Bearer puro), así que no hace falta
        // pedir credenciales entre orígenes: esto evita tener que abrir CORS con
        // AllowCredentials en el backend solo para esta conexión.
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .build();

    conexion.on('StockActualizado', (cambios: CambioStock[]) => {
      escuchasRef.current.forEach((escucha) => escucha(cambios));
    });

    conexion.start().catch(() => {
      // Sin conexión en vivo, cada pantalla sigue mostrando el stock tal como lo cargó al
      // entrar — el comportamiento anterior a esta funcionalidad, no un error visible.
    });

    return () => {
      conexion.stop();
    };
  }, [token]);

  const suscribir = useCallback((escucha: Escucha) => {
    escuchasRef.current.add(escucha);
    return () => {
      escuchasRef.current.delete(escucha);
    };
  }, []);

  return (
    <StockRealtimeContext.Provider value={{ suscribir }}>{children}</StockRealtimeContext.Provider>
  );
}

export function useStockRealtime(): StockRealtimeContextValue {
  const context = useContext(StockRealtimeContext);
  if (!context) {
    throw new Error('useStockRealtime debe usarse dentro de un StockRealtimeProvider');
  }
  return context;
}
