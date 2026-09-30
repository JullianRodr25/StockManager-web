// Suscribe una lista de productos en memoria a los avisos de stock en vivo: cuando llega un
// cambio de un producto que está en la lista, actualiza su stockActual in place, sin volver a
// pedirle nada al backend ni recargar la pantalla.
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useStockRealtime } from '@/context/StockRealtimeContext';

interface ConStock {
  id: number;
  stockActual: number;
}

export function useSincronizacionStock<T extends ConStock>(setProductos: Dispatch<SetStateAction<T[]>>) {
  const { suscribir } = useStockRealtime();

  useEffect(() => {
    return suscribir((cambios) => {
      if (cambios.length === 0) return;

      const nuevoStockPorId = new Map(cambios.map((cambio) => [cambio.productoId, cambio.stockActual]));

      setProductos((actuales) =>
        actuales.map((producto) =>
          nuevoStockPorId.has(producto.id)
            ? { ...producto, stockActual: nuevoStockPorId.get(producto.id)! }
            : producto
        )
      );
    });
  }, [suscribir, setProductos]);
}
