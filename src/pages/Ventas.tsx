import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Barcode, Loader2, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { buscarProductoPorCodigoBarras, obtenerProductos } from '@/services/inventarioService';
import { registrarVenta } from '@/services/ventaService';
import type { Producto } from '@/types/inventario';
import type { MetodoPago, RegistrarVentaRequest } from '@/types/ventas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TAMANO_PAGINA_PRODUCTOS = 500;
const MAX_RESULTADOS_BUSQUEDA = 8;
const MAX_RESULTADOS_SIN_FILTRO = 20;

const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const metodosPago: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'Efectivo', etiqueta: 'Efectivo' },
  { valor: 'Tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'Transferencia', etiqueta: 'Transferencia' },
];

type ModoComprador = 'registrado' | 'sinRegistro';

interface LineaCarrito {
  productoId: number;
  cantidad: string;
}

const estadoInicialComprador = {
  modoComprador: 'sinRegistro' as ModoComprador,
  clienteId: '',
  nombreComprador: '',
  telefonoComprador: '',
  emailComprador: '',
  metodoPago: '' as MetodoPago | '',
};

export function Ventas() {
  const { token } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const cierreDropdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);

  const [dialogFinalizarAbierto, setDialogFinalizarAbierto] = useState(false);
  const [modoComprador, setModoComprador] = useState<ModoComprador>(estadoInicialComprador.modoComprador);
  const [clienteId, setClienteId] = useState(estadoInicialComprador.clienteId);
  const [nombreComprador, setNombreComprador] = useState(estadoInicialComprador.nombreComprador);
  const [telefonoComprador, setTelefonoComprador] = useState(estadoInicialComprador.telefonoComprador);
  const [emailComprador, setEmailComprador] = useState(estadoInicialComprador.emailComprador);
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>(estadoInicialComprador.metodoPago);

  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [conflictoStock, setConflictoStock] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const registroEnCursoRef = useRef(false);

  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true);
    setErrorProductos(null);
    try {
      const respuesta = await obtenerProductos(1, TAMANO_PAGINA_PRODUCTOS, token);
      setProductos(respuesta.data.filter((producto) => producto.activo));
    } catch (err) {
      setErrorProductos(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos.');
    } finally {
      setCargandoProductos(false);
    }
  }, [token]);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  const productosPorId = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto])),
    [productos]
  );

  const resultadosBusqueda = useMemo(() => {
    const termino = terminoBusqueda.trim().toLowerCase();
    const coincidencias = termino
      ? productos.filter((producto) => producto.nombre.toLowerCase().includes(termino))
      : productos;
    return [...coincidencias]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .slice(0, termino ? MAX_RESULTADOS_BUSQUEDA : MAX_RESULTADOS_SIN_FILTRO);
  }, [productos, terminoBusqueda]);

  const carritoConDatos = useMemo(
    () =>
      carrito.map((linea) => {
        const producto = productosPorId.get(linea.productoId);
        const cantidad = Number(linea.cantidad);
        const cantidadInvalida = !Number.isFinite(cantidad) || cantidad < 1;
        const subtotal = producto && !cantidadInvalida ? producto.precio * cantidad : 0;
        return { ...linea, producto, cantidadInvalida, subtotal };
      }),
    [carrito, productosPorId]
  );

  const hayCantidadInvalida = carritoConDatos.some((linea) => linea.cantidadInvalida);
  const total = carritoConDatos.reduce((acumulado, linea) => acumulado + linea.subtotal, 0);
  const carritoVacio = carrito.length === 0;

  function agregarProductoAlCarrito(producto: Producto) {
    setCarrito((actual) => {
      const existente = actual.find((linea) => linea.productoId === producto.id);
      if (existente) {
        return actual.map((linea) =>
          linea.productoId === producto.id
            ? { ...linea, cantidad: String((Number(linea.cantidad) || 0) + 1) }
            : linea
        );
      }
      return [...actual, { productoId: producto.id, cantidad: '1' }];
    });
  }

  function actualizarCantidad(productoId: number, valor: string) {
    setCarrito((actual) =>
      actual.map((linea) => (linea.productoId === productoId ? { ...linea, cantidad: valor } : linea))
    );
  }

  function eliminarLinea(productoId: number) {
    setCarrito((actual) => actual.filter((linea) => linea.productoId !== productoId));
  }

  async function handleEnterBusqueda(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;

    const texto = terminoBusqueda.trim();
    if (!texto) return;

    setBuscandoCodigo(true);
    setErrorBusqueda(null);
    try {
      const producto = await buscarProductoPorCodigoBarras(texto, token);
      agregarProductoAlCarrito(producto);
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
    agregarProductoAlCarrito(producto);
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

  function abrirDialogFinalizar() {
    setErrorFormulario(null);
    setConflictoStock(null);
    setDialogFinalizarAbierto(true);
  }

  function reiniciarVenta() {
    setCarrito([]);
    setModoComprador(estadoInicialComprador.modoComprador);
    setClienteId(estadoInicialComprador.clienteId);
    setNombreComprador(estadoInicialComprador.nombreComprador);
    setTelefonoComprador(estadoInicialComprador.telefonoComprador);
    setEmailComprador(estadoInicialComprador.emailComprador);
    setMetodoPago(estadoInicialComprador.metodoPago);
    setErrorFormulario(null);
    setConflictoStock(null);
    setDialogFinalizarAbierto(false);
  }

  async function handleConfirmarVenta(event: FormEvent) {
    event.preventDefault();
    if (registroEnCursoRef.current) return;

    setErrorFormulario(null);
    setConflictoStock(null);

    if (carritoVacio) {
      setErrorFormulario('Agrega al menos un producto para registrar la venta.');
      return;
    }
    if (hayCantidadInvalida) {
      setErrorFormulario('Corrige las cantidades inválidas antes de confirmar la venta.');
      return;
    }
    if (!metodoPago) {
      setErrorFormulario('Selecciona un método de pago.');
      return;
    }
    if (modoComprador === 'registrado' && (!Number.isInteger(Number(clienteId)) || Number(clienteId) <= 0)) {
      setErrorFormulario('Ingresa un ID de cliente válido.');
      return;
    }
    if (modoComprador === 'sinRegistro' && !nombreComprador.trim()) {
      setErrorFormulario('El nombre del comprador es obligatorio.');
      return;
    }

    const solicitud: RegistrarVentaRequest = {
      ...(modoComprador === 'registrado' ? { clienteId: Number(clienteId) } : {}),
      ...(modoComprador === 'sinRegistro' && nombreComprador.trim()
        ? { nombreComprador: nombreComprador.trim() }
        : {}),
      ...(modoComprador === 'sinRegistro' && telefonoComprador.trim()
        ? { telefonoComprador: telefonoComprador.trim() }
        : {}),
      ...(modoComprador === 'sinRegistro' && emailComprador.trim()
        ? { emailComprador: emailComprador.trim() }
        : {}),
      metodoPago,
      lineas: carritoConDatos.map((linea) => ({
        productoId: linea.productoId,
        cantidad: Number(linea.cantidad),
      })),
    };

    registroEnCursoRef.current = true;
    setRegistrando(true);
    try {
      const venta = await registrarVenta(solicitud, token);
      toast.success('Venta registrada correctamente', {
        description: `Venta #${venta.id} · ${formatoMoneda.format(venta.total)}`,
      });
      reiniciarVenta();
      await cargarProductos();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar la venta.';
      if (err instanceof ApiError && err.status === 409) {
        setConflictoStock(mensaje || 'El stock cambió mientras se procesaba la venta. Intenta de nuevo.');
        toast.error('El stock cambió, intenta de nuevo');
      } else {
        setErrorFormulario(mensaje);
        toast.error(mensaje);
      }
    } finally {
      registroEnCursoRef.current = false;
      setRegistrando(false);
    }
  }

  async function handleReintentarTrasConflicto() {
    setConflictoStock(null);
    await cargarProductos();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-navy">Buscar producto</CardTitle>
            <CardDescription>Escanea el código de barras o escribe el nombre.</CardDescription>
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
                disabled={buscandoCodigo || cargandoProductos}
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
                      onClick={() => handleSeleccionarResultado(producto)}
                      className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-background"
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

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-navy">Venta actual</CardTitle>
            <CardDescription>Productos agregados a esta venta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {carritoVacio ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-text-muted">
                <ShoppingCart className="h-8 w-8" />
                <p>Agrega productos para iniciar la venta.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Precio unit.</TableHead>
                        <TableHead className="w-28">Cantidad</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carritoConDatos.map((linea) => (
                        <TableRow key={linea.productoId}>
                          <TableCell className="text-navy">{linea.producto?.nombre ?? '—'}</TableCell>
                          <TableCell className="text-text-muted">
                            {linea.producto ? formatoMoneda.format(linea.producto.precio) : '—'}
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`Cantidad para ${linea.producto?.nombre ?? 'el producto'}`}
                              type="number"
                              min="1"
                              step="1"
                              value={linea.cantidad}
                              onChange={(e) => actualizarCantidad(linea.productoId, e.target.value)}
                              className={cn(linea.cantidadInvalida && 'border-error-text focus-visible:ring-error-text')}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium text-navy">
                            {formatoMoneda.format(linea.subtotal)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Eliminar producto"
                              onClick={() => eliminarLinea(linea.productoId)}
                            >
                              <Trash2 className="h-4 w-4 text-error-text" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-text-muted">Total</span>
                  <span className="text-lg font-semibold text-navy">{formatoMoneda.format(total)}</span>
                </div>

                <Button
                  type="button"
                  variant="gold"
                  className="w-full"
                  disabled={carritoVacio || hayCantidadInvalida}
                  onClick={abrirDialogFinalizar}
                >
                  Finalizar venta
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogFinalizarAbierto} onOpenChange={setDialogFinalizarAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar venta</DialogTitle>
            <DialogDescription>
              {carritoConDatos.length} producto(s) · Total {formatoMoneda.format(total)}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmarVenta} className="space-y-5">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={modoComprador === 'sinRegistro' ? 'gold' : 'outline'}
                onClick={() => setModoComprador('sinRegistro')}
                disabled={registrando}
              >
                Sin registrar
              </Button>
              <Button
                type="button"
                variant={modoComprador === 'registrado' ? 'gold' : 'outline'}
                onClick={() => setModoComprador('registrado')}
                disabled={registrando}
              >
                Cliente registrado
              </Button>
            </div>

            {modoComprador === 'registrado' ? (
              <div className="space-y-2">
                <Label htmlFor="clienteId">ID del cliente</Label>
                <Input
                  id="clienteId"
                  type="number"
                  min="1"
                  step="1"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  disabled={registrando}
                  required
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreComprador">Nombre</Label>
                  <Input
                    id="nombreComprador"
                    value={nombreComprador}
                    onChange={(e) => setNombreComprador(e.target.value)}
                    disabled={registrando}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="telefonoComprador">Teléfono (opcional)</Label>
                    <Input
                      id="telefonoComprador"
                      value={telefonoComprador}
                      onChange={(e) => setTelefonoComprador(e.target.value)}
                      disabled={registrando}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailComprador">Correo (opcional)</Label>
                    <Input
                      id="emailComprador"
                      type="email"
                      value={emailComprador}
                      onChange={(e) => setEmailComprador(e.target.value)}
                      disabled={registrando}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de pago</Label>
              <Select value={metodoPago} onValueChange={(valor) => setMetodoPago(valor as MetodoPago)}>
                <SelectTrigger id="metodoPago" disabled={registrando}>
                  <SelectValue placeholder="Selecciona un método" />
                </SelectTrigger>
                <SelectContent>
                  {metodosPago.map((metodo) => (
                    <SelectItem key={metodo.valor} value={metodo.valor}>
                      {metodo.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {conflictoStock && (
              <div className="flex flex-col gap-2 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy" role="alert">
                <div>
                  <p className="font-semibold">Conflicto de stock</p>
                  <p>{conflictoStock}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleReintentarTrasConflicto}>
                  <RefreshCw className="h-4 w-4" />
                  Recargar productos
                </Button>
              </div>
            )}

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogFinalizarAbierto(false)} disabled={registrando}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={registrando}>
                {registrando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                {registrando ? 'Confirmando venta...' : 'Confirmar venta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
