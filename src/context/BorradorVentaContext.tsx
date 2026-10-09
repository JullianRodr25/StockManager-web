import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useAuth } from './AuthContext';

// Guarda en memoria lo que el cajero lleva armado en la pantalla de Ventas (carrito, comprador,
// método de pago...) para que no se pierda al navegar a otra pantalla —por ejemplo, para crear un
// producto que falta— y volver. Vive por encima de las rutas: la página Ventas se destruye al
// salir, pero este proveedor no.
//
// Decisiones:
// - Solo memoria (no localStorage): es un borrador de la sesión actual. Recargar la página o
//   cerrar la pestaña lo descarta, que es lo esperable para una venta a medio hacer y evita
//   resucitar un carrito viejo con precios o stock desactualizados.
// - Se descarta al cerrar sesión o cambiar de usuario, para que otro cajero no herede el carrito.
// - La API es la de useState (valor + setter con soporte de función), así la pantalla solo
//   cambia "useState" por "useBorradorVenta('clave', inicial)" en los campos que sí son borrador.

type Almacen = Record<string, unknown>;

interface BorradorVentaContextValue {
  leer: <T>(clave: string, inicial: T) => T;
  escribir: <T>(clave: string, valor: SetStateAction<T>, inicial: T) => void;
}

const BorradorVentaContext = createContext<BorradorVentaContextValue | undefined>(undefined);

export function BorradorVentaProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [almacen, setAlmacen] = useState<Almacen>({});

  // Sin sesión (o con otra sesión) no debe quedar nada del borrador anterior.
  const tokenPrevio = useRef(token);
  useEffect(() => {
    if (tokenPrevio.current !== token) {
      tokenPrevio.current = token;
      setAlmacen({});
    }
  }, [token]);

  const leer = useCallback(
    <T,>(clave: string, inicial: T): T => (clave in almacen ? (almacen[clave] as T) : inicial),
    [almacen]
  );

  const escribir = useCallback(<T,>(clave: string, valor: SetStateAction<T>, inicial: T) => {
    setAlmacen((previo) => {
      const actual = clave in previo ? (previo[clave] as T) : inicial;
      const siguiente = typeof valor === 'function' ? (valor as (anterior: T) => T)(actual) : valor;
      return Object.is(siguiente, actual) && clave in previo ? previo : { ...previo, [clave]: siguiente };
    });
  }, []);

  return <BorradorVentaContext.Provider value={{ leer, escribir }}>{children}</BorradorVentaContext.Provider>;
}

/** Igual que useState, pero el valor sobrevive a que la pantalla se cierre y se vuelva a abrir. */
export function useBorradorVenta<T>(clave: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const contexto = useContext(BorradorVentaContext);
  if (!contexto) {
    throw new Error('useBorradorVenta debe usarse dentro de un BorradorVentaProvider');
  }
  const { leer, escribir } = contexto;

  // "inicial" puede ser un objeto nuevo en cada render; se fija la primera vez para que el
  // setter conserve la misma identidad y no cambie en cada render.
  const inicialRef = useRef(inicial);
  const establecer = useCallback<Dispatch<SetStateAction<T>>>(
    (valor) => escribir(clave, valor, inicialRef.current),
    [clave, escribir]
  );

  return [leer(clave, inicialRef.current), establecer];
}
