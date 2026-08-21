import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Loader2, Search, Trash2, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { obtenerProductos } from '@/services/inventarioService';
import { buscarClientes } from '@/services/clienteService';
import {
  abrirFiado,
  agregarLineaFiado,
  editarCantidadLinea,
  obtenerAbonos,
  obtenerVentaPorId,
  obtenerVentas,
  quitarLinea,
  registrarAbono,
} from '@/services/ventaService';
import type { Producto } from '@/types/inventario';
import type { Cliente } from '@/types/clientes';
import type { AbonoResponse, DetalleVentaResponse, MetodoPago, VentaResponse, VentaResumenResponse } from '@/types/ventas';
import { BuscadorProductos } from '@/components/BuscadorProductos';
import { DetalleFacturaDialog, formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const TAMANO_PAGINA_PRODUCTOS = 500;
const TAMANO_PAGINA_CUENTAS_ABIERTAS = 200;
const DEBOUNCE_BUSQUEDA_CLIENTE_MS = 300;

const metodosPago: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'Efectivo', etiqueta: 'Efectivo' },
  { valor: 'Tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'Transferencia', etiqueta: 'Transferencia' },
];

function nombreCuenta(venta: { nombreComprador: string | null }): string {
  return venta.nombreComprador ?? 'Cliente sin nombre registrado';
}

export function FiadoPage() {
  const { token } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);

  const [cuentasAbiertas, setCuentasAbiertas] = useState<VentaResumenResponse[]>([]);
  const [cargandoCuentasAbiertas, setCargandoCuentasAbiertas] = useState(true);
  const [errorCuentasAbiertas, setErrorCuentasAbiertas] = useState<string | null>(null);
  const [cargandoCuentaId, setCargandoCuentaId] = useState<number | null>(null);

  const [terminoCliente, setTerminoCliente] = useState('');
  const [resultadosClientes, setResultadosClientes] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [errorBusquedaCliente, setErrorBusquedaCliente] = useState<string | null>(null);
  const [mostrarDropdownClientes, setMostrarDropdownClientes] = useState(false);
  const cierreDropdownClientesRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [abriendoCuenta, setAbriendoCuenta] = useState(false);
  const [cuentaYaAbiertaCliente, setCuentaYaAbiertaCliente] = useState<Cliente | null>(null);
  const [cargandoCuentaExistente, setCargandoCuentaExistente] = useState(false);

  const [cuentaAbierta, setCuentaAbierta] = useState<VentaResponse | null>(null);
  const [agregandoLinea, setAgregandoLinea] = useState(false);

  const [edicionesCantidad, setEdicionesCantidad] = useState<Record<number, string>>({});
  const [guardandoLineaId, setGuardandoLineaId] = useState<number | null>(null);
  const [lineaAEliminar, setLineaAEliminar] = useState<DetalleVentaResponse | null>(null);
  const [eliminandoLinea, setEliminandoLinea] = useState(false);

  const [abonos, setAbonos] = useState<AbonoResponse[]>([]);
  const [cargandoAbonos, setCargandoAbonos] = useState(false);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<MetodoPago | ''>('');
  const [registrandoAbono, setRegistrandoAbono] = useState(false);
  const [errorAbono, setErrorAbono] = useState<string | null>(null);

  const [ventaCerrada, setVentaCerrada] = useState<VentaResponse | null>(null);
  const [facturaAbierta, setFacturaAbierta] = useState(false);

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

  const cargarCuentasAbiertas = useCallback(async () => {
    setCargandoCuentasAbiertas(true);
    setErrorCuentasAbiertas(null);
    try {
      const respuesta = await obtenerVentas(1, TAMANO_PAGINA_CUENTAS_ABIERTAS, token, { estado: 'Pendiente' });
      setCuentasAbiertas(respuesta.data);
    } catch (err) {
      setErrorCuentasAbiertas(err instanceof ApiError ? err.message : 'No se pudieron cargar las cuentas abiertas.');
    } finally {
      setCargandoCuentasAbiertas(false);
    }
  }, [token]);

  useEffect(() => {
    if (!cuentaAbierta) {
      cargarCuentasAbiertas();
    }
  }, [cuentaAbierta, cargarCuentasAbiertas]);

  const cargarAbonos = useCallback(
    async (ventaId: number) => {
      setCargandoAbonos(true);
      try {
        const datos = await obtenerAbonos(ventaId, token);
        setAbonos(datos);
      } catch (err) {
        const mensaje = err instanceof ApiError ? err.message : 'No se pudieron cargar los abonos.';
        toast.error(mensaje);
      } finally {
        setCargandoAbonos(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!cuentaAbierta) {
      setAbonos([]);
      return;
    }
    cargarAbonos(cuentaAbierta.id);
    // Solo se recarga cuando cambia el id de la cuenta cargada, no en cada
    // actualización de cuentaAbierta (ej. al editar una línea).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaAbierta?.id]);

  // Debounce simple: espera a que el usuario deje de escribir antes de
  // consultar al backend, para no disparar una búsqueda por cada tecla.
  useEffect(() => {
    if (cuentaAbierta) return;

    const idTimeout = setTimeout(async () => {
      setBuscandoClientes(true);
      setErrorBusquedaCliente(null);
      try {
        const clientes = await buscarClientes(terminoCliente, token);
        setResultadosClientes(clientes);
      } catch (err) {
        setErrorBusquedaCliente(err instanceof ApiError ? err.message : 'No se pudieron buscar clientes.');
      } finally {
        setBuscandoClientes(false);
      }
    }, DEBOUNCE_BUSQUEDA_CLIENTE_MS);

    return () => clearTimeout(idTimeout);
  }, [terminoCliente, token, cuentaAbierta]);

  function handleEnfocarBusquedaCliente() {
    if (cierreDropdownClientesRef.current) {
      clearTimeout(cierreDropdownClientesRef.current);
      cierreDropdownClientesRef.current = null;
    }
    setMostrarDropdownClientes(true);
  }

  function handleDesenfocarBusquedaCliente() {
    cierreDropdownClientesRef.current = setTimeout(() => setMostrarDropdownClientes(false), 150);
  }

  function handleSeleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setCuentaYaAbiertaCliente(null);
    setMostrarDropdownClientes(false);
  }

  function handleCambiarCliente() {
    setClienteSeleccionado(null);
    setCuentaYaAbiertaCliente(null);
    setTerminoCliente('');
  }

  async function handleAbrirCuenta() {
    if (!clienteSeleccionado) return;

    setAbriendoCuenta(true);
    setCuentaYaAbiertaCliente(null);
    try {
      const venta = await abrirFiado(clienteSeleccionado.id, token);
      setCuentaAbierta(venta);
      toast.success('Cuenta abierta creada', { description: clienteSeleccionado.nombre });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCuentaYaAbiertaCliente(clienteSeleccionado);
      } else {
        const mensaje = err instanceof ApiError ? err.message : 'No se pudo abrir la cuenta.';
        toast.error(mensaje);
      }
    } finally {
      setAbriendoCuenta(false);
    }
  }

  async function handleContinuarCuentaExistente() {
    if (!cuentaYaAbiertaCliente) return;

    const resumen = cuentasAbiertas.find((venta) => venta.clienteId === cuentaYaAbiertaCliente.id);
    if (!resumen) {
      toast.error('No se encontró la cuenta abierta de este cliente.');
      return;
    }

    setCargandoCuentaExistente(true);
    try {
      const venta = await obtenerVentaPorId(resumen.id, token);
      setCuentaAbierta(venta);
      toast.success('Continuando con la cuenta abierta', { description: cuentaYaAbiertaCliente.nombre });
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo cargar la cuenta abierta.';
      toast.error(mensaje);
    } finally {
      setCargandoCuentaExistente(false);
    }
  }

  async function handleCargarCuentaDesdeTarjeta(resumen: VentaResumenResponse) {
    if (cargandoCuentaId !== null) return;

    setCargandoCuentaId(resumen.id);
    try {
      const venta = await obtenerVentaPorId(resumen.id, token);
      setCuentaAbierta(venta);
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo cargar la cuenta.';
      toast.error(mensaje);
    } finally {
      setCargandoCuentaId(null);
    }
  }

  async function handleAgregarProducto(producto: Producto) {
    if (!cuentaAbierta || agregandoLinea) return;

    setAgregandoLinea(true);
    try {
      const venta = await agregarLineaFiado(cuentaAbierta.id, { productoId: producto.id, cantidad: 1 }, token);
      setCuentaAbierta(venta);
      await cargarProductos();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo agregar el producto a la cuenta.';
      toast.error(mensaje);
    } finally {
      setAgregandoLinea(false);
    }
  }

  function reiniciarCuentaAbierta() {
    setCuentaAbierta(null);
    setClienteSeleccionado(null);
    setCuentaYaAbiertaCliente(null);
    setTerminoCliente('');
    setEdicionesCantidad({});
    setLineaAEliminar(null);
    setAbonos([]);
    setMontoAbono('');
    setMetodoPagoAbono('');
    setErrorAbono(null);
  }

  function valorCantidadMostrado(linea: DetalleVentaResponse): string {
    return edicionesCantidad[linea.id] ?? String(linea.cantidad);
  }

  function handleCambiarCantidadInput(detalleId: number, valor: string) {
    setEdicionesCantidad((actual) => ({ ...actual, [detalleId]: valor }));
  }

  function limpiarEdicionCantidad(detalleId: number) {
    setEdicionesCantidad((actual) => {
      const { [detalleId]: _omitido, ...resto } = actual;
      return resto;
    });
  }

  async function handleConfirmarCantidad(linea: DetalleVentaResponse) {
    if (!cuentaAbierta) return;

    const valorEditado = edicionesCantidad[linea.id];
    if (valorEditado === undefined) return;

    const cantidad = Number(valorEditado);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      toast.error('Ingresa una cantidad válida (entero mayor a 0).');
      limpiarEdicionCantidad(linea.id);
      return;
    }
    if (cantidad === linea.cantidad) {
      limpiarEdicionCantidad(linea.id);
      return;
    }

    setGuardandoLineaId(linea.id);
    try {
      const venta = await editarCantidadLinea(cuentaAbierta.id, linea.id, cantidad, token);
      setCuentaAbierta(venta);
      limpiarEdicionCantidad(linea.id);
      await cargarProductos();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo actualizar la cantidad.';
      toast.error(mensaje);
      limpiarEdicionCantidad(linea.id);
    } finally {
      setGuardandoLineaId(null);
    }
  }

  async function handleConfirmarEliminarLinea() {
    if (!cuentaAbierta || !lineaAEliminar) return;
    const linea = lineaAEliminar;

    setEliminandoLinea(true);
    try {
      const venta = await quitarLinea(cuentaAbierta.id, linea.id, token);
      setCuentaAbierta(venta);
      await cargarProductos();
      toast.success('Producto quitado de la cuenta');
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo quitar el producto.';
      toast.error(mensaje);
    } finally {
      setEliminandoLinea(false);
      setLineaAEliminar(null);
    }
  }

  const totalAbonado = abonos.reduce((acumulado, abono) => acumulado + abono.monto, 0);
  const saldoPendiente = cuentaAbierta ? Math.max(cuentaAbierta.total - totalAbonado, 0) : 0;

  function handlePagarSaldoCompleto() {
    setMontoAbono(saldoPendiente > 0 ? String(Math.round(saldoPendiente)) : '0');
  }

  async function handleRegistrarAbono(event: FormEvent) {
    event.preventDefault();
    if (!cuentaAbierta || registrandoAbono) return;

    setErrorAbono(null);
    const monto = Number(montoAbono);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorAbono('Ingresa un monto válido.');
      return;
    }
    if (!metodoPagoAbono) {
      setErrorAbono('Selecciona un método de pago.');
      return;
    }

    setRegistrandoAbono(true);
    try {
      const venta = await registrarAbono(cuentaAbierta.id, { monto, metodoPago: metodoPagoAbono }, token);

      if (venta.estado.trim().toLowerCase() === 'pagada') {
        toast.success('Cuenta abierta pagada por completo', {
          description: `Venta #${venta.id} · ${formatoMoneda.format(venta.total)}`,
        });
        reiniciarCuentaAbierta();
        setVentaCerrada(venta);
        setFacturaAbierta(true);
      } else {
        const abonosActualizados = await obtenerAbonos(venta.id, token);
        const totalAbonadoActualizado = abonosActualizados.reduce((acumulado, abono) => acumulado + abono.monto, 0);
        const saldoActualizado = Math.max(venta.total - totalAbonadoActualizado, 0);

        setAbonos(abonosActualizados);
        setCuentaAbierta(venta);
        setMontoAbono('');
        setMetodoPagoAbono('');
        toast.success('Abono registrado', {
          description: `Saldo pendiente: ${formatoMoneda.format(saldoActualizado)}`,
        });
      }
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar el abono.';
      setErrorAbono(mensaje);
      toast.error(mensaje);
    } finally {
      setRegistrandoAbono(false);
    }
  }

  return (
    <div className="space-y-4">
      {!cuentaAbierta && (
        <>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-navy">Cuentas Abiertas</CardTitle>
              <CardDescription>Cuentas con saldo pendiente actualmente.</CardDescription>
            </CardHeader>
            <CardContent>
              {cargandoCuentasAbiertas ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  Cargando cuentas abiertas...
                </div>
              ) : errorCuentasAbiertas ? (
                <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                  {errorCuentasAbiertas}
                </div>
              ) : cuentasAbiertas.length === 0 ? (
                <p className="py-8 text-center text-text-muted">No hay cuentas abiertas actualmente.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cuentasAbiertas.map((resumen) => (
                    <button
                      key={resumen.id}
                      type="button"
                      onClick={() => handleCargarCuentaDesdeTarjeta(resumen)}
                      disabled={cargandoCuentaId !== null}
                      className="rounded-md border border-border p-4 text-left transition-colors motion-reduce:transition-none hover:border-gold hover:bg-gold/5 disabled:pointer-events-none disabled:opacity-60"
                    >
                      <p className="font-medium text-navy">{nombreCuenta(resumen)}</p>
                      <p className="mt-1 text-lg font-semibold text-navy">{formatoMoneda.format(resumen.total)}</p>
                      <p className="mt-1 text-xs text-text-muted">Abierta el {formatoFecha(resumen.fecha)}</p>
                      {cargandoCuentaId === resumen.id && (
                        <Loader2 className="mt-2 h-4 w-4 animate-spin text-gold motion-reduce:animate-none" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-navy">Abrir nueva cuenta</CardTitle>
              <CardDescription>Busca un cliente registrado para abrir una cuenta abierta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={terminoCliente}
                  onChange={(e) => setTerminoCliente(e.target.value)}
                  onFocus={handleEnfocarBusquedaCliente}
                  onBlur={handleDesenfocarBusquedaCliente}
                  placeholder="Busca por nombre o número de identificación..."
                  className="pl-9"
                />
              </div>

              {errorBusquedaCliente && <p className="text-sm text-error-text">{errorBusquedaCliente}</p>}

              {mostrarDropdownClientes && (
                <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                  {buscandoClientes ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      Buscando...
                    </div>
                  ) : resultadosClientes.length === 0 ? (
                    <p className="flex items-center gap-2 px-3 py-2 text-sm text-text-muted">
                      <Users className="h-4 w-4" />
                      No se encontraron clientes.
                    </p>
                  ) : (
                    resultadosClientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => handleSeleccionarCliente(cliente)}
                        className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-background"
                      >
                        <span className="text-navy">{cliente.nombre}</span>
                        <span className="whitespace-nowrap text-text-muted">{cliente.numeroIdentificacion}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {clienteSeleccionado && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-gold bg-gold/10 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-navy">{clienteSeleccionado.nombre}</p>
                    <p className="text-xs text-text-muted">{clienteSeleccionado.numeroIdentificacion}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleCambiarCliente} disabled={abriendoCuenta}>
                    Quitar
                  </Button>
                </div>
              )}

              {cuentaYaAbiertaCliente && (
                <div className="flex flex-col gap-2 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy" role="alert">
                  <p>
                    {cuentaYaAbiertaCliente.nombre} ya tiene una cuenta abierta. ¿Deseas continuar con ella en lugar de
                    abrir una nueva?
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={handleContinuarCuentaExistente}
                    disabled={cargandoCuentaExistente}
                  >
                    {cargandoCuentaExistente && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                    Continuar con la cuenta existente
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="gold"
                className="w-full"
                disabled={!clienteSeleccionado || abriendoCuenta}
                onClick={handleAbrirCuenta}
              >
                {abriendoCuenta && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                Abrir cuenta
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {cuentaAbierta && (
        <>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-navy">Cuenta abierta</CardTitle>
              <CardDescription>Cuenta abierta en curso.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-green" />
                  <div>
                    <p className="text-sm font-medium text-navy">{nombreCuenta(cuentaAbierta)}</p>
                    <p className="text-xs text-text-muted">Cuenta #{cuentaAbierta.id} · Pendiente</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={reiniciarCuentaAbierta}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver a cuentas abiertas
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BuscadorProductos
              productos={productos}
              cargandoProductos={cargandoProductos}
              errorProductos={errorProductos}
              token={token}
              onSeleccionarProducto={handleAgregarProducto}
              disabled={agregandoLinea}
              titulo="Agregar producto a la cuenta"
              descripcion="Cada producto seleccionado se descuenta y se suma a la cuenta de inmediato."
            />

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-navy">Productos de la cuenta</CardTitle>
                <CardDescription>Edita la cantidad o quita productos de esta cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cuentaAbierta.detalles.length === 0 ? (
                  <p className="py-10 text-center text-text-muted">Agrega productos para cargarlos a la cuenta.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="w-28">Cantidad</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cuentaAbierta.detalles.map((linea) => {
                          const guardando = guardandoLineaId === linea.id;
                          return (
                            <TableRow key={linea.id}>
                              <TableCell className="text-navy">{linea.productoNombre}</TableCell>
                              <TableCell>
                                <Input
                                  aria-label={`Cantidad para ${linea.productoNombre}`}
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={valorCantidadMostrado(linea)}
                                  onChange={(e) => handleCambiarCantidadInput(linea.id, e.target.value)}
                                  onBlur={() => handleConfirmarCantidad(linea)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  disabled={guardando}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium text-navy">
                                {formatoMoneda.format(linea.subtotalConIva)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Quitar producto"
                                  onClick={() => setLineaAEliminar(linea)}
                                  disabled={guardando}
                                >
                                  <Trash2 className="h-4 w-4 text-error-text" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-text-muted">Total acumulado</span>
                  <span className="text-lg font-semibold text-navy">{formatoMoneda.format(cuentaAbierta.total)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-navy">Abonos</CardTitle>
              <CardDescription>Registra pagos parciales o el pago total de esta cuenta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm text-text-muted">Saldo pendiente</span>
                <span className="text-lg font-semibold text-navy">{formatoMoneda.format(saldoPendiente)}</span>
              </div>

              <form onSubmit={handleRegistrarAbono} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="montoAbono">Monto</Label>
                    <Input
                      id="montoAbono"
                      type="number"
                      min="1"
                      step="1"
                      value={montoAbono}
                      onChange={(e) => setMontoAbono(e.target.value)}
                      disabled={registrandoAbono}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metodoPagoAbono">Método de pago</Label>
                    <Select value={metodoPagoAbono} onValueChange={(valor) => setMetodoPagoAbono(valor as MetodoPago)}>
                      <SelectTrigger id="metodoPagoAbono" disabled={registrandoAbono}>
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
                </div>

                {errorAbono && (
                  <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                    {errorAbono}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePagarSaldoCompleto}
                    disabled={registrandoAbono || saldoPendiente <= 0}
                  >
                    Pagar saldo completo
                  </Button>
                  <Button type="submit" variant="gold" className="sm:flex-1" disabled={registrandoAbono}>
                    {registrandoAbono && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                    Registrar abono
                  </Button>
                </div>
              </form>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium text-navy">Historial de abonos</p>
                {cargandoAbonos ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    Cargando abonos...
                  </div>
                ) : abonos.length === 0 ? (
                  <p className="py-2 text-sm text-text-muted">Todavía no se han registrado abonos.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {abonos.map((abono) => (
                          <TableRow key={abono.id}>
                            <TableCell className="text-navy">{formatoFecha(abono.fecha)}</TableCell>
                            <TableCell className="text-navy">{abono.metodoPago}</TableCell>
                            <TableCell className="text-right font-medium text-navy">
                              {formatoMoneda.format(abono.monto)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={lineaAEliminar !== null} onOpenChange={(open) => !open && setLineaAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar producto de la cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará "{lineaAEliminar?.productoNombre}" de esta cuenta abierta y se repondrá el stock. Esta acción
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminandoLinea}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarEliminarLinea} disabled={eliminandoLinea}>
              {eliminandoLinea ? 'Quitando...' : 'Quitar producto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DetalleFacturaDialog venta={ventaCerrada} open={facturaAbierta} onOpenChange={setFacturaAbierta} />
    </div>
  );
}
