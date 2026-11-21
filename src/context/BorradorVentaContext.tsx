import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useAuth } from './AuthContext';

// Guarda lo que el cajero lleva armado en la pantalla de Ventas (carrito, comprador, método de
// pago...) para que no se pierda al navegar a otra pantalla —por ejemplo, para crear un producto
// que falta— ni al dejar la venta quieta un rato. Vive por encima de las rutas: la página Ventas
// se destruye al salir, pero este proveedor no.
//
// Por qué también se guarda en localStorage (antes era solo memoria):
// - El JWT dura 60 minutos. Con la venta quieta más que eso, la siguiente llamada recibe un 401,
//   api.ts cierra la sesión y el token cambia; el borrador en memoria se descartaba justo ahí.
// - Recargar la página o que el navegador descarte una pestaña inactiva (ahorro de memoria) también
//   lo borraba. Ambas cosas pasan en un mostrador, donde la venta puede esperar al cliente.
//
// Decisiones:
// - El borrador se guarda POR USUARIO (clave con su id) y con caducidad (12 h sin cambios): otro
//   cajero en el mismo equipo nunca ve el carrito ajeno, y un carrito de ayer no resucita.
// - Perder la sesión por vencimiento NO borra el borrador: al volver a entrar el mismo usuario,
//   lo recupera. Solo se descarta al reiniciar la venta o por caducidad.
// - Es seguro restaurarlo: el carrito guarda ids y cantidades; precios y stock se leen frescos
//   de la lista de productos, y el servidor revalida el stock al confirmar.
// - La API es la de useState (valor + setter con soporte de función), así la pantalla solo
//   cambia "useState" por "useBorradorVenta('clave', inicial)" en los campos que sí son borrador.

type Almacen = Record<string, unknown>;

interface BorradorVentaContextValue {
  leer: <T>(clave: string, inicial: T) => T;
  escribir: <T>(clave: string, valor: SetStateAction<T>, inicial: T) => void;
}

const BorradorVentaContext = createContext<BorradorVentaContextValue | undefined>(undefined);

const PREFIJO_STORAGE = 'stockmanager_borrador_venta:';
const CADUCIDAD_MS = 12 * 60 * 60 * 1000;
const ESPERA_GUARDADO_MS = 300;

// Todo acceso a localStorage va protegido: puede estar bloqueado (modo privado) o lleno, y el
// borrador es una comodidad, nunca debe romper la pantalla.
function cargarBorrador(usuarioId: string | null): Almacen {
  if (!usuarioId) return {};
  try {
    const crudo = localStorage.getItem(PREFIJO_STORAGE + usuarioId);
    if (!crudo) return {};
    const { guardadoEn, datos } = JSON.parse(crudo) as { guardadoEn: number; datos: Almacen };
    if (typeof guardadoEn !== 'number' || Date.now() - guardadoEn > CADUCIDAD_MS) {
      localStorage.removeItem(PREFIJO_STORAGE + usuarioId);
      return {};
    }
    return datos && typeof datos === 'object' ? datos : {};
  } catch {
    return {};
  }
}

function guardarBorrador(usuarioId: string, almacen: Almacen) {
  try {
    if (Object.keys(almacen).length === 0) {
      localStorage.removeItem(PREFIJO_STORAGE + usuarioId);
      return;
    }
    localStorage.setItem(PREFIJO_STORAGE + usuarioId, JSON.stringify({ guardadoEn: Date.now(), datos: almacen }));
  } catch {
    // Sin espacio o sin acceso: el borrador sigue funcionando en memoria.
  }
}

export function BorradorVentaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const usuarioId = usuario ? String(usuario.id) : null;
  const [almacen, setAlmacen] = useState<Almacen>({});
  const [idCargado, setIdCargado] = useState<string | null>(null);

  // Al cambiar de usuario (o al iniciar sesión) se carga SU borrador, durante el render, para que
  // la pantalla nunca llegue a pintar un instante con el borrador de otro. Sin sesión queda vacío
  // en memoria, pero lo guardado en disco se conserva para cuando vuelva el mismo usuario.
  if (usuarioId !== idCargado) {
    setIdCargado(usuarioId);
    setAlmacen(cargarBorrador(usuarioId));
  }

  // Guarda con un pequeño retraso para no escribir en disco en cada tecla.
  useEffect(() => {
    if (!usuarioId || usuarioId !== idCargado) return;
    const temporizador = setTimeout(() => guardarBorrador(usuarioId, almacen), ESPERA_GUARDADO_MS);
    return () => clearTimeout(temporizador);
  }, [almacen, usuarioId, idCargado]);

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
