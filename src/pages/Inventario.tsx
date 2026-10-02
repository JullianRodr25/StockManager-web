import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { Barcode, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import {
  actualizarProducto,
  ajustarStock,
  buscarProductoPorCodigoBarras,
  crearProducto,
  desactivarProducto,
  importarProductos,
  obtenerCategorias,
  obtenerProductos,
  reactivarProducto,
} from '@/services/inventarioService';
import { obtenerConfiguracion } from '@/services/configuracionService';
import { obtenerProveedores } from '@/services/proveedorService';
import { useSincronizacionStock } from '@/hooks/useSincronizacionStock';
import type {
  ActualizarProductoRequest,
  Categoria,
  CrearProductoRequest,
  ImportarProductoError,
  ImportarProductosErrorResponse,
  ImportarProductosResponse,
  Producto,
} from '@/types/inventario';
import type { Proveedor } from '@/types/proveedores';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TAMANO_PAGINA = 50;

const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

interface NuevoProductoForm {
  nombre: string;
  categoriaId: string;
  precio: string;
  stockInicial: string;
  stockMinimo: string;
  codigoBarras: string;
  aplicaIva: boolean;
  tarifaIva: string;
  costo: string;
  proveedorId: string;
}

const formularioVacio: NuevoProductoForm = {
  nombre: '',
  categoriaId: '',
  precio: '',
  stockInicial: '',
  stockMinimo: '',
  codigoBarras: '',
  aplicaIva: true,
  tarifaIva: '',
  costo: '',
  proveedorId: '',
};

const SIN_PROVEEDOR = 'ninguno';

function obtenerErroresImportacion(data: unknown): ImportarProductoError[] {
  if (!data || typeof data !== 'object' || !('errores' in data) || !Array.isArray(data.errores)) {
    return [];
  }

  return (data as ImportarProductosErrorResponse).errores.filter(
    (error): error is ImportarProductoError =>
      typeof error === 'object' &&
      error !== null &&
      typeof error.fila === 'number' &&
      typeof error.mensaje === 'string'
  );
}

export function Inventario() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario?.rol === 'Admin';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [tarifaIvaGeneral, setTarifaIvaGeneral] = useState<number | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const [codigoBarrasBusqueda, setCodigoBarrasBusqueda] = useState('');
  const [buscandoPorCodigo, setBuscandoPorCodigo] = useState(false);
  const [errorBusquedaCodigo, setErrorBusquedaCodigo] = useState<string | null>(null);
  const [productoEncontradoPorCodigo, setProductoEncontradoPorCodigo] = useState<Producto | null>(null);

  const [dialogNuevoAbierto, setDialogNuevoAbierto] = useState(false);
  const [formulario, setFormulario] = useState<NuevoProductoForm>(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const guardadoEnCursoRef = useRef(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);

  // Ajuste rápido de stock: doble clic en "Stock actual" habilita un input chiquito donde se
  // escribe cuánto sumar (ej. "10") o restar (ej. "-3") — para cuando llega mercancía o hay que
  // corregir un conteo físico, sin pasar por el formulario completo de edición del producto.
  const [editandoStockId, setEditandoStockId] = useState<number | null>(null);
  const [deltaStockInput, setDeltaStockInput] = useState('');
  const [guardandoAjusteStock, setGuardandoAjusteStock] = useState(false);
  // Ajuste de stock que el admin ya escribió (Enter en el campo) pero todavía no confirmó: se
  // pide confirmación explícita antes de tocar el stock real, porque es un cambio directo en
  // inventario sin pasar por una venta/movimiento normal y un error de tecleo (un cero de más,
  // un signo equivocado) sería fácil de cometer y costoso de notar después.
  const [pendienteAjusteStock, setPendienteAjusteStock] = useState<{ producto: Producto; delta: number } | null>(
    null
  );

  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [productoParaDesactivar, setProductoParaDesactivar] = useState<Producto | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [procesandoReactivarId, setProcesandoReactivarId] = useState<number | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState<ImportarProductosResponse | null>(null);
  const [dialogImportacionAbierto, setDialogImportacionAbierto] = useState(false);
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);
  const [erroresImportacion, setErroresImportacion] = useState<ImportarProductoError[]>([]);

  const cargarProductos = useCallback(
    async (paginaSolicitada: number, categoriaId: number | undefined) => {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await obtenerProductos(paginaSolicitada, TAMANO_PAGINA, token, categoriaId);
        setProductos(respuesta.data);
        setPagina(respuesta.pagina);
        setTotalPaginas(respuesta.totalPaginas);
        setTotal(respuesta.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos.');
      } finally {
        setCargando(false);
      }
    },
    [token]
  );

  // Cuando otro usuario vende algo (u otra acción que cambie el stock), esto actualiza el
  // stockActual de los productos ya cargados en esta pantalla sin recargar nada.
  useSincronizacionStock(setProductos);

  useEffect(() => {
    obtenerCategorias(token)
      .then(setCategorias)
      .catch(() => {
        // Si fallan las categorías, el filtro simplemente queda vacío;
        // la tabla de productos puede seguir funcionando sin filtro.
      });
  }, [token]);

  useEffect(() => {
    obtenerConfiguracion(token)
      .then((configuracion) => setTarifaIvaGeneral(configuracion.tarifaIvaPorDefecto))
      .catch(() => {
        // Si falla, el campo de IVA del formulario simplemente queda vacío
        // y el usuario puede escribir el valor manualmente.
      });
  }, [token]);

  useEffect(() => {
    obtenerProveedores(1, 200, token, true)
      .then((respuesta) => setProveedores(respuesta.data))
      .catch(() => {
        // Si fallan los proveedores, el selector del formulario simplemente queda vacío;
        // la tabla de productos puede seguir funcionando sin el nombre del proveedor.
      });
  }, [token]);

  useEffect(() => {
    const categoriaId = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
    cargarProductos(1, categoriaId);
    // Solo debe recargar cuando cambia el filtro de categoría; cargarProductos
    // ya depende de "token" internamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaFiltro]);

  function irAPagina(nuevaPagina: number) {
    const categoriaId = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
    cargarProductos(nuevaPagina, categoriaId);
  }

  const productosFiltrados = useMemo(() => {
    let lista = productos;
    if (!esAdmin || !mostrarInactivos) {
      lista = lista.filter((producto) => producto.activo);
    }
    if (busqueda.trim()) {
      const termino = busqueda.trim().toLowerCase();
      lista = lista.filter((producto) => producto.nombre.toLowerCase().includes(termino));
    }
    return lista;
  }, [productos, busqueda, esAdmin, mostrarInactivos]);

  const categoriaPorId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias]
  );

  const proveedorPorId = useMemo(
    () => new Map(proveedores.map((p) => [p.id, p.nombre])),
    [proveedores]
  );

  async function handleBuscarPorCodigoBarras(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;

    const codigo = codigoBarrasBusqueda.trim();
    if (!codigo) return;

    setBuscandoPorCodigo(true);
    setErrorBusquedaCodigo(null);
    try {
      const producto = await buscarProductoPorCodigoBarras(codigo, token);
      setProductoEncontradoPorCodigo(producto);
    } catch (err) {
      setProductoEncontradoPorCodigo(null);
      setErrorBusquedaCodigo(
        err instanceof ApiError ? 'No se encontró ningún producto con ese código.' : 'No se pudo realizar la búsqueda.'
      );
    } finally {
      setBuscandoPorCodigo(false);
      setCodigoBarrasBusqueda('');
    }
  }

  function limpiarBusquedaPorCodigo() {
    setProductoEncontradoPorCodigo(null);
    setErrorBusquedaCodigo(null);
  }

  function iniciarEdicionStock(producto: Producto) {
    if (!esAdmin) return;
    setEditandoStockId(producto.id);
    setDeltaStockInput('');
  }

  function cancelarEdicionStock() {
    setEditandoStockId(null);
    setDeltaStockInput('');
  }

  // Se llama al presionar Enter en el campo de ajuste: valida el número escrito y, si es
  // válido, pasa la pregunta al AlertDialog de confirmación en vez de aplicar el cambio de
  // una vez. El campo de edición se cierra ya mismo; si el admin cancela la confirmación,
  // tiene que volver a hacer doble clic para intentarlo de nuevo (evita dejar un estado
  // intermedio confuso entre "editando" y "confirmando").
  function confirmarAjusteStock(producto: Producto) {
    const delta = Number(deltaStockInput);
    const esValido = deltaStockInput.trim() !== '' && !Number.isNaN(delta) && delta !== 0;
    cancelarEdicionStock();
    if (esValido) {
      setPendienteAjusteStock({ producto, delta });
    }
  }

  async function handleConfirmarAjusteStock() {
    if (!pendienteAjusteStock) return;
    const { producto, delta } = pendienteAjusteStock;

    setGuardandoAjusteStock(true);
    try {
      const actualizado = await ajustarStock(producto.id, delta, token);
      setProductos((actuales) =>
        actuales.map((p) => (p.id === actualizado.id ? { ...p, stockActual: actualizado.stockActual } : p))
      );
      if (productoEncontradoPorCodigo?.id === actualizado.id) {
        setProductoEncontradoPorCodigo((previo) => (previo ? { ...previo, stockActual: actualizado.stockActual } : previo));
      }
      toast.success(
        `Stock de "${producto.nombre}" ${delta > 0 ? 'aumentado' : 'reducido'} a ${actualizado.stockActual}`
      );
      setPendienteAjusteStock(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo ajustar el stock.');
    } finally {
      setGuardandoAjusteStock(false);
    }
  }

  function actualizarCampoFormulario(campo: keyof Omit<NuevoProductoForm, 'aplicaIva'>, valor: string) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function actualizarAplicaIva(aplicaIva: boolean) {
    setFormulario((previo) => ({ ...previo, aplicaIva }));
  }

  function abrirDialogNuevo() {
    setProductoEditando(null);
    setFormulario({
      ...formularioVacio,
      tarifaIva: tarifaIvaGeneral !== null ? String(tarifaIvaGeneral) : '',
    });
    setErrorFormulario(null);
    setDialogNuevoAbierto(true);
  }

  function abrirDialogEditar(producto: Producto) {
    setProductoEditando(producto);
    setFormulario({
      nombre: producto.nombre,
      categoriaId: String(producto.categoriaId),
      precio: String(producto.precio),
      stockInicial: '',
      stockMinimo: String(producto.stockMinimo),
      codigoBarras: producto.codigoBarras ?? '',
      aplicaIva: producto.aplicaIva,
      tarifaIva: String(producto.tarifaIva || (tarifaIvaGeneral ?? '')),
      costo: String(producto.costo),
      proveedorId: producto.proveedorId ? String(producto.proveedorId) : '',
    });
    setErrorFormulario(null);
    setDialogNuevoAbierto(true);
  }

  function cerrarDialogProducto(abierto: boolean) {
    setDialogNuevoAbierto(abierto);
    if (!abierto) {
      setProductoEditando(null);
    }
  }

  async function handleGuardarProducto(e: FormEvent) {
    e.preventDefault();
    if (guardadoEnCursoRef.current) return;
    setErrorFormulario(null);

    const precio = Number(formulario.precio);
    const stockInicial = Number(formulario.stockInicial);
    const stockMinimo = Number(formulario.stockMinimo);
    const categoriaId = Number(formulario.categoriaId);
    const tarifaIva = Number(formulario.tarifaIva);
    const costo = formulario.costo.trim() === '' ? 0 : Number(formulario.costo);

    const camposBasicosInvalidos =
      !formulario.nombre.trim() ||
      !categoriaId ||
      Number.isNaN(precio) ||
      Number.isNaN(stockMinimo) ||
      Number.isNaN(costo) ||
      costo < 0;
    // La tarifa solo es obligatoria cuando el producto aplica IVA; si no aplica, se ignora
    // (el backend siempre la guarda en 0 — ver Producto.ActualizarInformacion/Crear).
    const tarifaIvaInvalida =
      formulario.aplicaIva &&
      (formulario.tarifaIva.trim() === '' || Number.isNaN(tarifaIva) || tarifaIva < 0 || tarifaIva > 100);

    if (camposBasicosInvalidos || tarifaIvaInvalida || (!productoEditando && Number.isNaN(stockInicial))) {
      setErrorFormulario(
        'Completa todos los campos obligatorios con valores válidos. Si el producto aplica IVA, la tarifa debe estar entre 0 y 100.'
      );
      return;
    }

    const proveedorId = formulario.proveedorId ? Number(formulario.proveedorId) : null;

    guardadoEnCursoRef.current = true;
    setGuardando(true);
    try {
      if (productoEditando) {
        const data: ActualizarProductoRequest = {
          nombre: formulario.nombre.trim(),
          categoriaId,
          precio,
          stockMinimo,
          aplicaIva: formulario.aplicaIva,
          tarifaIva,
          costo,
          proveedorId,
          ...(formulario.codigoBarras.trim() ? { codigoBarras: formulario.codigoBarras.trim() } : {}),
        };
        await actualizarProducto(productoEditando.id, data, token);
        toast.success('Producto actualizado correctamente');
      } else {
        const data: CrearProductoRequest = {
          nombre: formulario.nombre.trim(),
          categoriaId,
          precio,
          stockInicial,
          stockMinimo,
          aplicaIva: formulario.aplicaIva,
          tarifaIva,
          costo,
          proveedorId,
          ...(formulario.codigoBarras.trim() ? { codigoBarras: formulario.codigoBarras.trim() } : {}),
        };
        await crearProducto(data, token);
        toast.success(`Producto "${data.nombre}" creado correctamente`);
      }

      setDialogNuevoAbierto(false);
      setProductoEditando(null);
      const categoriaIdFiltro = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
      await cargarProductos(pagina, categoriaIdFiltro);
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar el producto.';
      setErrorFormulario(mensaje);
      toast.error(mensaje);
    } finally {
      guardadoEnCursoRef.current = false;
      setGuardando(false);
    }
  }

  function handleClickImportar() {
    inputArchivoRef.current?.click();
  }

  async function handleArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setImportando(true);
    setErrorImportacion(null);
    setErroresImportacion([]);
    setResultadoImportacion(null);
    try {
      const resultado = await importarProductos(archivo, token);
      setResultadoImportacion(resultado);
      setDialogImportacionAbierto(true);
      if (resultado.errores.length === 0) {
        toast.success(`${resultado.creados} de ${resultado.totalFilas} productos importados`);
      } else {
        toast.warning(`${resultado.creados} importados, ${resultado.errores.length} con errores`);
      }
      const categoriaId = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
      await cargarProductos(pagina, categoriaId);
    } catch (err) {
      const errores = err instanceof ApiError ? obtenerErroresImportacion(err.data) : [];
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo importar el archivo.';
      setResultadoImportacion(null);
      setErroresImportacion(errores);
      setErrorImportacion(errores.length > 0 && mensaje === 'Ocurrió un error inesperado.' ? null : mensaje);
      setDialogImportacionAbierto(true);
      if (errores.length > 0) {
        toast.warning(`${errores.length} fila(s) con errores de importación`);
      } else {
        toast.error(mensaje);
      }
    } finally {
      setImportando(false);
    }
  }

  function pedirConfirmacionDesactivar(producto: Producto) {
    setProductoParaDesactivar(producto);
  }

  async function handleConfirmarDesactivar() {
    if (!productoParaDesactivar) return;
    const producto = productoParaDesactivar;

    setDesactivando(true);
    try {
      await desactivarProducto(producto.id, token);
      toast.success('Producto desactivado');
      setProductoParaDesactivar(null);
      if (productoEncontradoPorCodigo?.id === producto.id) {
        setProductoEncontradoPorCodigo(null);
      }
      const categoriaIdFiltro = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
      await cargarProductos(pagina, categoriaIdFiltro);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo desactivar el producto.');
    } finally {
      setDesactivando(false);
    }
  }

  async function handleReactivar(producto: Producto) {
    setProcesandoReactivarId(producto.id);
    try {
      await reactivarProducto(producto.id, token);
      toast.success('Producto reactivado');
      if (productoEncontradoPorCodigo?.id === producto.id) {
        setProductoEncontradoPorCodigo(null);
      }
      const categoriaIdFiltro = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
      await cargarProductos(pagina, categoriaIdFiltro);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo reactivar el producto.');
    } finally {
      setProcesandoReactivarId(null);
    }
  }

  function renderFilaProducto(producto: Producto) {
    const sinStock = producto.stockActual <= 0;
    const stockBajo = !sinStock && producto.stockActual <= producto.stockMinimo;
    const reactivando = procesandoReactivarId === producto.id;

    return (
      <TableRow key={producto.id} className={cn(!producto.activo && 'opacity-50')}>
        <TableCell className="font-medium text-navy">
          <span className="flex items-center gap-2">
            {producto.nombre}
            {!producto.activo && <Badge variant="outline">Inactivo</Badge>}
          </span>
        </TableCell>
        <TableCell className="text-navy">{categoriaPorId.get(producto.categoriaId) ?? '—'}</TableCell>
        <TableCell className="text-navy">{formatoMoneda.format(producto.precio)}</TableCell>
        <TableCell className="text-navy">
          {producto.aplicaIva ? `${producto.tarifaIva}%` : <span className="text-text-muted">Exento</span>}
        </TableCell>
        {esAdmin && (
          <TableCell className="text-text-muted">{formatoMoneda.format(producto.costo)}</TableCell>
        )}
        <TableCell
          className={cn(
            'font-semibold',
            sinStock ? 'text-error-text' : stockBajo ? 'text-gold' : 'text-navy',
            esAdmin && editandoStockId !== producto.id && 'cursor-pointer'
          )}
          onDoubleClick={() => iniciarEdicionStock(producto)}
          title={esAdmin ? 'Doble clic para ajustar el stock' : undefined}
        >
          {editandoStockId === producto.id ? (
            <Input
              autoFocus
              type="number"
              step="1"
              placeholder="+10 o -3"
              value={deltaStockInput}
              onChange={(e) => setDeltaStockInput(e.target.value)}
              onBlur={cancelarEdicionStock}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmarAjusteStock(producto);
                } else if (e.key === 'Escape') {
                  cancelarEdicionStock();
                }
              }}
              disabled={guardandoAjusteStock}
              className="h-7 w-24 text-sm"
            />
          ) : (
            <span className="inline-flex items-center gap-2">
              {producto.stockActual}
              {/* Punto que titila (igual que un radar): rojo para estado crítico (sin stock, no
                  se puede vender) y naranja/dorado para warning (por debajo o igual al mínimo
                  configurado, todavía hay para vender pero hay que reponer pronto). Mismo
                  criterio que ya dispara la notificación de stock bajo en la campana, así la
                  señal es consistente en toda la app. */}
              {sinStock ? (
                <span className="relative inline-flex h-2.5 w-2.5 shrink-0" role="img" aria-label="Crítico: sin stock disponible">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error-text opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error-text" />
                </span>
              ) : stockBajo ? (
                <span className="relative inline-flex h-2.5 w-2.5 shrink-0" role="img" aria-label="Warning: stock por debajo del mínimo">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
                </span>
              ) : null}
            </span>
          )}
        </TableCell>
        <TableCell className="text-navy">{producto.stockMinimo}</TableCell>
        <TableCell className="text-text-muted">{producto.codigoBarras ?? '—'}</TableCell>
        <TableCell className="text-navy">
          {producto.proveedorId ? proveedorPorId.get(producto.proveedorId) ?? '—' : '—'}
        </TableCell>
        {esAdmin && (
          <TableCell>
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${producto.nombre}`}
                onClick={() => abrirDialogEditar(producto)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {producto.activo ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Desactivar ${producto.nombre}`}
                  onClick={() => pedirConfirmacionDesactivar(producto)}
                >
                  <Trash2 className="h-4 w-4 text-error-text" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Reactivar ${producto.nombre}`}
                  disabled={reactivando}
                  onClick={() => handleReactivar(producto)}
                >
                  {reactivando ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-green" />
                  )}
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pl-9"
            />
          </div>

          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categorias.map((categoria) => (
                <SelectItem key={categoria.id} value={String(categoria.id)}>
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:max-w-xs">
            <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={codigoBarrasBusqueda}
              onChange={(e) => setCodigoBarrasBusqueda(e.target.value)}
              onKeyDown={handleBuscarPorCodigoBarras}
              placeholder="Escanear o escribir código..."
              disabled={buscandoPorCodigo}
              className="pl-9"
            />
          </div>

          {productoEncontradoPorCodigo && (
            <Button variant="outline" size="sm" onClick={limpiarBusquedaPorCodigo}>
              <X className="h-4 w-4" />
              Limpiar búsqueda
            </Button>
          )}

          {esAdmin && (
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-text-muted">
              <Switch checked={mostrarInactivos} onCheckedChange={setMostrarInactivos} />
              Mostrar inactivos
            </label>
          )}
        </div>

        {esAdmin && (
          <div className="flex gap-2">
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleArchivoSeleccionado}
            />
            <Button variant="outline" onClick={handleClickImportar} disabled={importando}>
              {importando ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Upload className="h-4 w-4" />}
              Importar Excel
            </Button>
            <Button variant="gold" onClick={abrirDialogNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {esAdmin && (
        <p className="text-xs text-text-muted">
          Columnas del Excel: Nombre, Categoría, Precio, StockInicial, StockMinimo, CodigoBarras (opcional),
          TarifaIva (opcional: vacía aplica el IVA general vigente, 0 marca el producto como exento),
          Costo (opcional). Doble clic en "Stock actual" para ajustarlo rápido (ej. +10 o -3).
        </p>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {error}
        </div>
      )}

      {errorBusquedaCodigo && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {errorBusquedaCodigo}
        </div>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>IVA (%)</TableHead>
                {esAdmin && <TableHead>Costo</TableHead>}
                <TableHead>Stock actual</TableHead>
                <TableHead>Stock mínimo</TableHead>
                <TableHead>Código de barras</TableHead>
                <TableHead>Proveedor</TableHead>
                {esAdmin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {productoEncontradoPorCodigo ? (
                renderFilaProducto(productoEncontradoPorCodigo)
              ) : cargando ? (
                <TableRow>
                  <TableCell colSpan={esAdmin ? 10 : 8} className="py-8 text-center text-text-muted">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </TableCell>
                </TableRow>
              ) : productosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={esAdmin ? 10 : 8} className="py-8 text-center text-text-muted">
                    No se encontraron productos.
                  </TableCell>
                </TableRow>
              ) : (
                productosFiltrados.map((producto) => renderFilaProducto(producto))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!productoEncontradoPorCodigo && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-text-muted">
            Página {pagina} de {totalPaginas} · {total} productos en total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => irAPagina(pagina - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas || cargando}
              onClick={() => irAPagina(pagina + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogNuevoAbierto} onOpenChange={cerrarDialogProducto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{productoEditando ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            <DialogDescription>
              {productoEditando
                ? 'Actualiza los datos del producto. El stock actual no se edita aquí.'
                : 'Registra un producto nuevo en el inventario.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarProducto} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formulario.nombre}
                onChange={(e) => actualizarCampoFormulario('nombre', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoriaId">Categoría</Label>
              <Select
                value={formulario.categoriaId}
                onValueChange={(valor) => actualizarCampoFormulario('categoriaId', valor)}
              >
                <SelectTrigger id="categoriaId">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={String(categoria.id)}>
                      {categoria.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={cn('grid grid-cols-1 gap-4', productoEditando ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              <div className="space-y-2">
                <Label htmlFor="precio">Precio de venta</Label>
                <Input
                  id="precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.precio}
                  onChange={(e) => actualizarCampoFormulario('precio', e.target.value)}
                  required
                />
                <p className="text-xs text-text-muted">
                  Valor final que paga el cliente (ya incluye el IVA, si aplica).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="costo">Costo</Label>
                <Input
                  id="costo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.costo}
                  onChange={(e) => actualizarCampoFormulario('costo', e.target.value)}
                />
                <p className="text-xs text-text-muted">
                  Para calcular rentabilidad. Nunca se muestra al cliente ni en la factura.
                </p>
              </div>
              {!productoEditando && (
                <div className="space-y-2">
                  <Label htmlFor="stockInicial">Stock inicial</Label>
                  <Input
                    id="stockInicial"
                    type="number"
                    min="0"
                    value={formulario.stockInicial}
                    onChange={(e) => actualizarCampoFormulario('stockInicial', e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="stockMinimo">Stock mínimo</Label>
                <Input
                  id="stockMinimo"
                  type="number"
                  min="0"
                  value={formulario.stockMinimo}
                  onChange={(e) => actualizarCampoFormulario('stockMinimo', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="aplicaIva">¿Aplica IVA?</Label>
                <label className="flex items-center gap-2">
                  <Switch id="aplicaIva" checked={formulario.aplicaIva} onCheckedChange={actualizarAplicaIva} />
                  <span className="text-sm text-text-muted">
                    {formulario.aplicaIva ? 'Sí, este producto causa IVA' : 'No, este producto está exento de IVA'}
                  </span>
                </label>
              </div>
              {formulario.aplicaIva && (
                <div className="space-y-2">
                  <Label htmlFor="tarifaIva">Tarifa de IVA (%)</Label>
                  <div className="relative">
                    <Input
                      id="tarifaIva"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formulario.tarifaIva}
                      onChange={(e) => actualizarCampoFormulario('tarifaIva', e.target.value)}
                      className="pr-8"
                      required
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                      %
                    </span>
                  </div>
                  {!productoEditando && tarifaIvaGeneral !== null && (
                    <p className="text-xs text-text-muted">Tarifa general vigente: {tarifaIvaGeneral}%</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigoBarras">Código de barras (opcional)</Label>
              <Input
                id="codigoBarras"
                value={formulario.codigoBarras}
                onChange={(e) => actualizarCampoFormulario('codigoBarras', e.target.value)}
              />
              <p className="text-xs text-text-muted">
                Déjalo vacío si el producto no trae código de fábrica.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proveedorId">Proveedor (opcional)</Label>
              <Select
                value={formulario.proveedorId || SIN_PROVEEDOR}
                onValueChange={(valor) =>
                  actualizarCampoFormulario('proveedorId', valor === SIN_PROVEEDOR ? '' : valor)
                }
              >
                <SelectTrigger id="proveedorId">
                  <SelectValue placeholder="Sin proveedor asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PROVEEDOR}>Sin proveedor asignado</SelectItem>
                  {proveedores.map((proveedor) => (
                    <SelectItem key={proveedor.id} value={String(proveedor.id)}>
                      {proveedor.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-text-muted">
                Si el proveedor tiene un WhatsApp configurado, se le avisará automáticamente
                cuando este producto entre en stock bajo.
              </p>
            </div>

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => cerrarDialogProducto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={guardando}>
                {guardando ? 'Guardando...' : productoEditando ? 'Guardar cambios' : 'Guardar producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogImportacionAbierto} onOpenChange={setDialogImportacionAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultado de la importación</DialogTitle>
          </DialogHeader>

          {errorImportacion && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {errorImportacion}
            </div>
          )}

          {resultadoImportacion && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-text-muted">Filas procesadas</p>
                    <p className="text-lg font-semibold text-navy">{resultadoImportacion.totalFilas}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-text-muted">Productos creados</p>
                    <p className="text-lg font-semibold text-green">{resultadoImportacion.creados}</p>
                  </div>
                </div>

              </div>
          )}

          {(resultadoImportacion?.errores ?? erroresImportacion).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-error-text">
                {(resultadoImportacion?.errores ?? erroresImportacion).length} fila(s) con errores
              </p>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead>Mensaje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(resultadoImportacion?.errores ?? erroresImportacion).map((error) => (
                      <TableRow key={`${error.fila}-${error.mensaje}`}>
                        <TableCell className="text-navy">{error.fila}</TableCell>
                        <TableCell className="text-error-text">{error.mensaje}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="gold" onClick={() => setDialogImportacionAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={productoParaDesactivar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setProductoParaDesactivar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no aparecerá disponible para vender, pero su historial se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desactivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={desactivando}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmarDesactivar();
              }}
            >
              {desactivando ? 'Desactivando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendienteAjusteStock !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPendienteAjusteStock(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendienteAjusteStock && pendienteAjusteStock.delta > 0 ? '¿Aumentar el stock?' : '¿Reducir el stock?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendienteAjusteStock && (
                <>
                  {pendienteAjusteStock.delta > 0 ? 'Vas a sumar' : 'Vas a restar'}{' '}
                  <strong className="text-navy">{Math.abs(pendienteAjusteStock.delta)}</strong> unidades al stock de
                  "{pendienteAjusteStock.producto.nombre}": de {pendienteAjusteStock.producto.stockActual} pasará a{' '}
                  <strong className="text-navy">
                    {pendienteAjusteStock.producto.stockActual + pendienteAjusteStock.delta}
                  </strong>
                  .
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardandoAjusteStock}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={guardandoAjusteStock}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmarAjusteStock();
              }}
            >
              {guardandoAjusteStock ? 'Guardando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
