import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Barcode } from 'lucide-react';
import { ApiError } from '@/services/api';
import { buscarProductoPorCodigoBarras, obtenerProductos } from '@/services/inventarioService';
import type { Producto } from '@/types/inventario';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MAX_RESULTADOS_BUSQUEDA = 8;
const MAX_RESULTADOS_SIN_FILTRO = 20;
const MIN_LETRAS_BUSQUEDA_SERVIDOR = 2;
const DEBOUNCE_BUSQUEDA_MS = 250;
// Se piden más de los que se muestran porque el servidor también devuelve inactivos y sin stock,
// que aquí se descartan.
const TAMANO_BUSQUEDA_SERVIDOR = 40;

interface BuscadorProductosProps {
  productos: Producto[];
  cargandoProductos: boolean;
  errorProductos: string | null;
  token: string | null;
  onSeleccionarProducto: (producto: Producto) => void;
  disabled?: boolean;
  titulo?: string;
  descripcion?: string;
  // Accesos directos a los últimos productos vendidos (más reciente primero), para agregarlos
  // al carrito con un clic sin tener que escribir nada. Opcional: si no se pasa, esta sección
  // simplemente no aparece (así FiadoPage, que reutiliza este mismo buscador, no se ve afectado).
  productosRecientes?: Producto[];
}

export function BuscadorProductos({
  productos,
  cargandoProductos,
  errorProductos,
  token,
  onSeleccionarProducto,
  disabled = false,
  titulo = 'Buscar producto',
  descripcion = 'Escanea el código de barras o escribe el nombre.',
  productosRecientes = [],
}: BuscadorProductosProps) {
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  // Posición resaltada con las flechas del teclado (-1 = ninguna).
  const [resaltado, setResaltado] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const estabaBloqueadoRef = useRef(false);

  // El campo se deshabilita mientras se consulta el código o se recarga el catálogo, y un input
  // deshabilitado pierde el foco. Al volver a habilitarse se lo devolvemos para que el cajero
  // pueda escanear el siguiente producto sin tocar el mouse.
  const bloqueado = disabled || buscandoCodigo || cargandoProductos;
  useEffect(() => {
    // Solo si el foco se perdió por el bloqueo (queda en <body>): si el usuario ya está
    // escribiendo en otro campo (ej. una cantidad), no se le quita.
    const foco = document.activeElement;
    if (estabaBloqueadoRef.current && !bloqueado && (!foco || foco === document.body)) {
      enfocarCampo();
    }
    estabaBloqueadoRef.current = bloqueado;
  }, [bloqueado]);

  const termino = terminoBusqueda.trim().toLowerCase();
  const buscaEnServidor = termino.length >= MIN_LETRAS_BUSQUEDA_SERVIDOR;

  // La lista que llega por props es solo una carga inicial (los primeros productos del
  // inventario): no contiene todo el catálogo ni los productos creados después. Por eso, al
  // escribir se consulta al servidor, que busca por nombre en TODO el inventario.
  const [resultadosServidor, setResultadosServidor] = useState<Producto[] | null>(null);
  const [buscandoNombre, setBuscandoNombre] = useState(false);

  useEffect(() => {
    if (!buscaEnServidor) {
      setResultadosServidor(null);
      setBuscandoNombre(false);
      return;
    }

    let cancelado = false;
    setBuscandoNombre(true);
    const temporizador = setTimeout(async () => {
      try {
        const respuesta = await obtenerProductos(1, TAMANO_BUSQUEDA_SERVIDOR, token, undefined, termino);
        if (!cancelado) setResultadosServidor(respuesta.data);
      } catch {
        // Si falla la consulta, se usa el filtrado local de la lista ya cargada.
        if (!cancelado) setResultadosServidor(null);
      } finally {
        if (!cancelado) setBuscandoNombre(false);
      }
    }, DEBOUNCE_BUSQUEDA_MS);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [termino, buscaEnServidor, token]);

  // Un producto sin stock (o inactivo) no se puede vender, así que ni se ofrece en el buscador:
  // evita que el cajero lo seleccione para encontrarse con el error de "sin stock" después.
  const vendible = (producto: Producto) => producto.activo && producto.stockActual > 0;

  let resultadosBusqueda: Producto[];
  if (buscaEnServidor && resultadosServidor) {
    // El servidor ya los ordena (los que empiezan por el texto primero): se respeta ese orden.
    resultadosBusqueda = resultadosServidor.filter(vendible).slice(0, MAX_RESULTADOS_BUSQUEDA);
  } else {
    const locales = productos.filter(vendible);
    const coincidencias = termino
      ? locales.filter((producto) => producto.nombre.toLowerCase().includes(termino))
      : locales;
    // Mismo criterio que el servidor (los que empiezan por el texto primero, luego alfabético)
    // para que la lista no se reordene cuando llegan los resultados del servidor.
    const empiezaPor = (producto: Producto) => (termino && producto.nombre.toLowerCase().startsWith(termino) ? 0 : 1);
    resultadosBusqueda = [...coincidencias]
      .sort((a, b) => empiezaPor(a) - empiezaPor(b) || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, termino ? MAX_RESULTADOS_BUSQUEDA : MAX_RESULTADOS_SIN_FILTRO);
  }
  const indiceResaltado = Math.min(resaltado, resultadosBusqueda.length - 1);

  // Igual que en el buscador: un producto sin stock no se puede vender, así que no tiene
  // sentido ofrecerlo como acceso directo.
  const accesosDirectos = productosRecientes.filter((producto) => producto.stockActual > 0);

  async function handleTeclasBusqueda(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setMostrarDropdown(false);
      setResaltado(-1);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (resultadosBusqueda.length === 0) return;
      e.preventDefault();
      setMostrarDropdown(true);
      const total = resultadosBusqueda.length;
      setResaltado((actual) => {
        const base = Math.min(actual, total - 1);
        return e.key === 'ArrowDown' ? (base + 1) % total : base <= 0 ? total - 1 : base - 1;
      });
      return;
    }

    if (e.key !== 'Enter') return;

    // Con un resultado resaltado con las flechas, Enter lo agrega. Sin resaltar, Enter busca por
    // código de barras (lo que hace el lector al terminar de escanear).
    if (mostrarDropdown && indiceResaltado >= 0) {
      e.preventDefault();
      handleSeleccionarResultado(resultadosBusqueda[indiceResaltado]);
      return;
    }

    const texto = terminoBusqueda.trim();
    if (!texto) return;

    setBuscandoCodigo(true);
    setErrorBusqueda(null);
    try {
      const producto = await buscarProductoPorCodigoBarras(texto, token);
      onSeleccionarProducto(producto);
      setTerminoBusqueda('');
    } catch (err) {
      setErrorBusqueda(
        err instanceof ApiError ? 'No se encontró ningún producto con ese código.' : 'No se pudo realizar la búsqueda.'
      );
    } finally {
      setBuscandoCodigo(false);
    }
  }

  // Foco programático: no debe reabrir el dropdown (el onFocus lo abre solo cuando el usuario
  // entra al campo). El evento focus se dispara de forma síncrona dentro de focus().
  const omitirAperturaRef = useRef(false);
  function enfocarCampo() {
    omitirAperturaRef.current = true;
    inputRef.current?.focus();
    omitirAperturaRef.current = false;
  }

  function handleSeleccionarResultado(producto: Producto) {
    if (disabled) return;
    onSeleccionarProducto(producto);
    setTerminoBusqueda('');
    setErrorBusqueda(null);
    setMostrarDropdown(false);
    setResaltado(-1);
    // Se mantiene el foco en el campo para seguir buscando o escaneando sin tocar el mouse.
    enfocarCampo();
  }

  function handleEnfocarBusqueda() {
    if (omitirAperturaRef.current) return;
    setMostrarDropdown(true);
  }

  function handleDesenfocarBusqueda() {
    // Sin retraso: los clics dentro de la lista no le quitan el foco al campo (ver
    // onMouseDown de la lista), así que un blur real siempre significa que el usuario salió.
    setMostrarDropdown(false);
    setResaltado(-1);
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-navy">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="relative">
          <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            ref={inputRef}
            value={terminoBusqueda}
            onChange={(e) => {
              setTerminoBusqueda(e.target.value);
              setErrorBusqueda(null);
              setResaltado(-1);
              setMostrarDropdown(true);
            }}
            onKeyDown={handleTeclasBusqueda}
            onFocus={handleEnfocarBusqueda}
            // Si el campo ya tiene el foco (p. ej. tras agregar un producto) el clic no dispara
            // onFocus: se reabre la lista aquí.
            onClick={() => setMostrarDropdown(true)}
            onBlur={handleDesenfocarBusqueda}
            placeholder="Escanea el código o escribe el nombre del producto..."
            disabled={bloqueado}
            className="pl-9"
            autoFocus
          />
        </div>

        {errorBusqueda && <p className="text-sm text-error-text">{errorBusqueda}</p>}

        {mostrarDropdown && (
          <div
            className="max-h-72 overflow-y-auto rounded-md border border-border"
            // Evita que presionar dentro de la lista le quite el foco al campo: así no se cierra
            // ni se redibuja a mitad del clic y un solo clic basta.
            onMouseDown={(e) => e.preventDefault()}
          >
            {resultadosBusqueda.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">
                {buscandoNombre
                  ? 'Buscando...'
                  : terminoBusqueda.trim()
                  ? 'Sin resultados por nombre. Presiona Enter para buscar por código.'
                  : 'No hay productos disponibles.'}
              </p>
            ) : (
              resultadosBusqueda.map((producto, indice) => (
                <button
                  key={producto.id}
                  type="button"
                  disabled={disabled}
                  // Se agrega al presionar (un solo clic, sin esperar a soltar). El onClick solo
                  // atiende la activación por teclado (detail = 0) para no agregar dos veces.
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    handleSeleccionarResultado(producto);
                  }}
                  onClick={(e) => {
                    if (e.detail === 0) handleSeleccionarResultado(producto);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-background disabled:pointer-events-none disabled:opacity-50',
                    indice === indiceResaltado && 'bg-background ring-1 ring-inset ring-gold'
                  )}
                >
                  <span className="text-navy">{producto.nombre}</span>
                  <span className="whitespace-nowrap text-text-muted">
                    {formatoMoneda.format(producto.precio)} · {producto.stockActual} disp.
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {!mostrarDropdown && accesosDirectos.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Accesos directos · últimos vendidos
            </p>
            <div className="flex flex-wrap gap-2">
              {accesosDirectos.map((producto) => (
                <button
                  key={producto.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSeleccionarProducto(producto);
                    // El botón tomó el foco al hacer clic: se devuelve al buscador.
                    enfocarCampo();
                  }}
                  title={`Agregar ${producto.nombre}`}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-sm text-navy transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
                >
                  {producto.nombre}
                  <span className="ml-1.5 text-text-muted">{formatoMoneda.format(producto.precio)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {errorProductos && (
          <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
            {errorProductos}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
