import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Barcode } from 'lucide-react';
import { ApiError } from '@/services/api';
import { buscarProductoPorCodigoBarras } from '@/services/inventarioService';
import type { Producto } from '@/types/inventario';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const MAX_RESULTADOS_BUSQUEDA = 8;
const MAX_RESULTADOS_SIN_FILTRO = 20;

interface BuscadorProductosProps {
  productos: Producto[];
  cargandoProductos: boolean;
  errorProductos: string | null;
  token: string | null;
  onSeleccionarProducto: (producto: Producto) => void;
  disabled?: boolean;
  titulo?: string;
  descripcion?: string;
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
}: BuscadorProductosProps) {
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const cierreDropdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const termino = terminoBusqueda.trim().toLowerCase();
  const coincidencias = termino
    ? productos.filter((producto) => producto.nombre.toLowerCase().includes(termino))
    : productos;
  const resultadosBusqueda = [...coincidencias]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .slice(0, termino ? MAX_RESULTADOS_BUSQUEDA : MAX_RESULTADOS_SIN_FILTRO);

  async function handleEnterBusqueda(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;

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

  function handleSeleccionarResultado(producto: Producto) {
    onSeleccionarProducto(producto);
    setTerminoBusqueda('');
    setErrorBusqueda(null);
    setMostrarDropdown(false);
  }

  function handleEnfocarBusqueda() {
    if (cierreDropdownRef.current) {
      clearTimeout(cierreDropdownRef.current);
      cierreDropdownRef.current = null;
    }
    setMostrarDropdown(true);
  }

  function handleDesenfocarBusqueda() {
    // Retraso para que el click en un resultado del dropdown alcance a
    // registrarse antes de que este se oculte por el blur del input.
    cierreDropdownRef.current = setTimeout(() => setMostrarDropdown(false), 150);
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
            value={terminoBusqueda}
            onChange={(e) => {
              setTerminoBusqueda(e.target.value);
              setErrorBusqueda(null);
            }}
            onKeyDown={handleEnterBusqueda}
            onFocus={handleEnfocarBusqueda}
            onBlur={handleDesenfocarBusqueda}
            placeholder="Escanea el código o escribe el nombre del producto..."
            disabled={disabled || buscandoCodigo || cargandoProductos}
            className="pl-9"
            autoFocus
          />
        </div>

        {errorBusqueda && <p className="text-sm text-error-text">{errorBusqueda}</p>}

        {mostrarDropdown && (
          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {resultadosBusqueda.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-muted">
                {terminoBusqueda.trim()
                  ? 'Sin resultados por nombre. Presiona Enter para buscar por código.'
                  : 'No hay productos disponibles.'}
              </p>
            ) : (
              resultadosBusqueda.map((producto) => (
                <button
                  key={producto.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSeleccionarResultado(producto)}
                  className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-background disabled:pointer-events-none disabled:opacity-50"
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

        {errorProductos && (
          <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
            {errorProductos}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
