import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { Barcode, ChevronDown, Download, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { descargarArchivo } from '@/lib/descargarArchivo';
import { ApiError, MENSAJE_ERROR_GENERICO } from '@/services/api';
import { ResumenAlertasStock } from '@/components/ResumenAlertasStock';
import type { FiltroAlertaStock } from '@/components/ResumenAlertasStock';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import { actualizarProducto, ajustarStock, buscarProductoPorCodigoBarras, crearProducto, desactivarProducto, descargarPlantillaProductos, exportarInventario, importarProductos, obtenerAlertasStock, obtenerCategorias, obtenerProductos, reactivarProducto } from '@/services/inventarioService';
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
  ProductoFoto,
} from '@/types/inventario';
import { GaleriaFotosProducto } from '@/components/GaleriaFotosProducto';
import { ProveedorRapidoDialog } from '@/components/ProveedorRapidoDialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatoMoneda } from '@/components/DetalleFacturaDialog';

const TAMANO_PAGINA = 50;

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
  const [dialogProveedorAbierto, setDialogProveedorAbierto] = useState(false);

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

  // Modal de ajuste de stock (doble clic sobre el stock de un producto). El Aceptar/Cancelar
  // del propio modal es la confirmación explícita antes de tocar el stock real: es un cambio
  // directo en inventario sin pasar por una venta/movimiento normal, así que un error de
  // tecleo (un cero de más) sería fácil de cometer y costoso de notar después.
  const [productoStockModalId, setProductoStockModalId] = useState<number | null>(null);
  const [nuevoStockInput, setNuevoStockInput] = useState('');
  const [guardandoAjusteStock, setGuardandoAjusteStock] = useState(false);

  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  // Productos que necesitan reposición (viven en su propio endpoint: la tabla está paginada y
  // un conteo hecho con la página visible sería engañoso). null = vista normal.
  const [alertas, setAlertas] = useState<Producto[]>([]);
  const [filtroAlerta, setFiltroAlerta] = useState<FiltroAlertaStock | null>(null);
  const [productoParaDesactivar, setProductoParaDesactivar] = useState<Producto | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [procesandoReactivarId, setProcesandoReactivarId] = useState<number | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState<'inventario' | 'plantilla' | null>(null);
  const [resultadoImportacion, setResultadoImportacion] = useState<ImportarProductosResponse | null>(null);
  const [dialogImportacionAbierto, setDialogImportacionAbierto] = useState(false);
  // Archivo ya validado en la vista previa, a la espera de que el usuario confirme.
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);
  const [erroresImportacion, setErroresImportacion] = useState<ImportarProductoError[]>([]);

  // Texto de búsqueda ya "asentado" (espera 300 ms tras dejar de escribir). Va en un ref para que
  // todas las recargas (editar, desactivar, importar...) conserven la búsqueda sin tocar sus firmas.
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const busquedaAplicadaRef = useRef('');
  busquedaAplicadaRef.current = busquedaAplicada;

  useEffect(() => {
    const temporizador = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  const cargarProductos = useCallback(
    async (paginaSolicitada: number, categoriaId: number | undefined) => {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await obtenerProductos(
          paginaSolicitada,
          TAMANO_PAGINA,
          token,
          categoriaId,
          busquedaAplicadaRef.current
        );
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

  // Se vuelve a consultar cada vez que cambia el inventario cargado: así el resumen también se
  // actualiza cuando alguien vende, repone o edita el stock (ver useSincronizacionStock).
  useEffect(() => {
    obtenerAlertasStock(token)
      .then(setAlertas)
      .catch(() => {
        // Sin el resumen, la tabla sigue funcionando; solo no se muestran los chips.
      });
  }, [token, productos]);

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
    // Recarga (desde la página 1) cuando cambia la categoría o el texto de búsqueda ya asentado;
    // cargarProductos ya depende de "token" internamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaFiltro, busquedaAplicada]);

  function irAPagina(nuevaPagina: number) {
    const categoriaId = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
    cargarProductos(nuevaPagina, categoriaId);
  }

  const productosFiltrados = useMemo(() => {
    let lista = productos;
    if (!esAdmin || !mostrarInactivos) {
      lista = lista.filter((producto) => producto.activo);
    }
    // El filtro por nombre lo hace el servidor (sobre todo el inventario, no solo la página).
    return lista;
  }, [productos, esAdmin, mostrarInactivos]);

  const agotados = alertas.filter((p) => p.stockActual <= 0).length;
  const stockBajo = alertas.length - agotados;

  // Si el chip activo se queda sin productos (se repuso todo), se vuelve a la vista normal en
  // vez de dejar una tabla vacía sin el chip que permitiría salir.
  useEffect(() => {
    if ((filtroAlerta === 'agotado' && agotados === 0) || (filtroAlerta === 'bajo' && stockBajo === 0)) {
      setFiltroAlerta(null);
    }
  }, [filtroAlerta, agotados, stockBajo]);

  // Con un chip activo la tabla muestra la lista de alertas (ya completa, sin paginar), todavía
  // respetando la búsqueda y la categoría elegidas.
  const alertasFiltradas = useMemo(() => {
    if (!filtroAlerta) return [];
    const termino = busqueda.trim().toLowerCase();
    return alertas.filter((p) => {
      if (filtroAlerta === 'agotado' ? p.stockActual > 0 : p.stockActual <= 0) return false;
      if (categoriaFiltro !== 'todas' && p.categoriaId !== Number(categoriaFiltro)) return false;
      return !termino || p.nombre.toLowerCase().includes(termino);
    });
  }, [alertas, filtroAlerta, busqueda, categoriaFiltro]);

  const productosAMostrar = filtroAlerta ? alertasFiltradas : productosFiltrados;

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

  // El modal guarda solo el id y deriva el producto de la lista viva: así, si otra venta
  // cambia el stock mientras el modal está abierto (useSincronizacionStock), el "stock actual"
  // y el cambio calculado se mantienen al día en vez de apoyarse en una copia vieja.
  const productoStockModal =
    productoStockModalId === null
      ? null
      : productos.find((p) => p.id === productoStockModalId) ??
        (productoEncontradoPorCodigo?.id === productoStockModalId ? productoEncontradoPorCodigo : null);

  const nuevoStockNumero = Number(nuevoStockInput);
  const nuevoStockValido =
    nuevoStockInput.trim() !== '' && Number.isInteger(nuevoStockNumero) && nuevoStockNumero >= 0;
  const deltaStockModal = productoStockModal && nuevoStockValido ? nuevoStockNumero - productoStockModal.stockActual : 0;

  function abrirModalStock(producto: Producto) {
    if (!esAdmin) return;
    setProductoStockModalId(producto.id);
    setNuevoStockInput(String(producto.stockActual));
  }

  function cerrarModalStock() {
    if (guardandoAjusteStock) return;
    setProductoStockModalId(null);
    setNuevoStockInput('');
  }

  async function handleConfirmarAjusteStock(e: FormEvent) {
    e.preventDefault();
    if (!productoStockModal || !nuevoStockValido || deltaStockModal === 0) return;
    const producto = productoStockModal;
    const delta = deltaStockModal;

    setGuardandoAjusteStock(true);
    try {
      // El backend aplica un delta (ver ajustarStock): se calcula contra el stock más reciente
      // que tiene la pantalla, así que el resultado final es el número que el admin escribió.
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
      setProductoStockModalId(null);
      setNuevoStockInput('');
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

  // Mantiene en sync productoEditando (para que la galería re-renderice de inmediato) y la
  // fila correspondiente en la lista ya cargada (para no tener que recargar toda la página).
  function handleFotosCambiadas(fotos: ProductoFoto[]) {
    if (!productoEditando) return;
    const actualizado = { ...productoEditando, fotos };
    setProductoEditando(actualizado);
    setProductos((previo) => previo.map((p) => (p.id === actualizado.id ? actualizado : p)));
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

  // Descarga el Excel de inventario o la plantilla vacía. Un solo manejador para ambos: solo
  // cambia qué se pide y cómo se llama el archivo.
  async function handleDescargarExcel(tipo: 'inventario' | 'plantilla') {
    if (descargandoExcel) return;
    setDescargandoExcel(tipo);
    try {
      if (tipo === 'inventario') {
        const archivo = await exportarInventario(token);
        const hoy = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
        descargarArchivo(archivo, `inventario-${hoy}.xlsx`);
        toast.success('Inventario exportado');
      } else {
        const archivo = await descargarPlantillaProductos(token);
        descargarArchivo(archivo, 'plantilla-productos.xlsx');
        toast.success('Plantilla descargada');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo descargar el archivo.');
    } finally {
      setDescargandoExcel(null);
    }
  }

  function handleClickImportar() {
    inputArchivoRef.current?.click();
  }

  function normalizarResultadoImportacion(respuesta: Partial<ImportarProductosResponse> | undefined): ImportarProductosResponse {
    // Una respuesta sin cuerpo JSON (ej. un proxy o el propio Azure devolviendo otra cosa con
    // 200) llegaba acá como undefined y rompía la pantalla; se normaliza para que siempre
    // haya un resultado con forma válida que mostrar.
    return {
      totalFilas: respuesta?.totalFilas ?? 0,
      creados: respuesta?.creados ?? 0,
      modificados: respuesta?.modificados ?? 0,
      sinCambios: respuesta?.sinCambios ?? 0,
      aplicado: respuesta?.aplicado ?? false,
      errores: Array.isArray(respuesta?.errores) ? respuesta.errores : [],
    };
  }

  function mostrarErrorImportacion(err: unknown) {
    const errores = err instanceof ApiError ? obtenerErroresImportacion(err.data) : [];
    const mensaje = err instanceof ApiError ? err.message : 'No se pudo importar el archivo.';
    setResultadoImportacion(null);
    setArchivoPendiente(null);
    setErroresImportacion(errores);
    setErrorImportacion(errores.length > 0 && mensaje.startsWith(MENSAJE_ERROR_GENERICO) ? null : mensaje);
    setDialogImportacionAbierto(true);
    if (errores.length > 0) {
      toast.warning(`${errores.length} fila(s) con errores de importación`);
    } else {
      toast.error(mensaje);
    }
  }

  // Paso 1: validar el archivo SIN guardar y mostrar qué pasaría (vista previa).
  async function handleArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setImportando(true);
    setErrorImportacion(null);
    setErroresImportacion([]);
    setResultadoImportacion(null);
    setArchivoPendiente(null);
    try {
      const resultado = normalizarResultadoImportacion(await importarProductos(archivo, token, true));
      setResultadoImportacion(resultado);
      // Solo se puede confirmar si todo es válido y hay algo que aplicar.
      const hayCambios = resultado.creados + resultado.modificados > 0;
      setArchivoPendiente(resultado.errores.length === 0 && hayCambios ? archivo : null);
      setDialogImportacionAbierto(true);
    } catch (err) {
      mostrarErrorImportacion(err);
    } finally {
      setImportando(false);
    }
  }

  // Paso 2: el usuario confirmó; se envía el mismo archivo para aplicar los cambios.
  async function handleConfirmarImportacion() {
    if (!archivoPendiente) return;

    setImportando(true);
    try {
      const resultado = normalizarResultadoImportacion(await importarProductos(archivoPendiente, token, false));
      setResultadoImportacion(resultado);
      if (resultado.aplicado) {
        setArchivoPendiente(null);
        toast.success(
          `Importación aplicada: ${resultado.creados} creados, ${resultado.modificados} modificados`
        );
        const categoriaId = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
        await cargarProductos(pagina, categoriaId);
      } else {
        // El archivo cambió de estado entre la vista previa y la confirmación (ej. alguien creó
        // un producto con el mismo nombre): no se guardó nada y se muestran los nuevos errores.
        setArchivoPendiente(null);
        toast.warning('No se guardó nada: el archivo tiene errores.');
      }
    } catch (err) {
      mostrarErrorImportacion(err);
    } finally {
      setImportando(false);
    }
  }

  function handleCerrarImportacion(abierto: boolean) {
    if (importando) return;
    setDialogImportacionAbierto(abierto);
    if (!abierto) setArchivoPendiente(null);
  }

  // Proveedor recién creado desde el formulario: se agrega a la lista y queda seleccionado.
  function handleProveedorCreado(proveedor: Proveedor) {
    setProveedores((anteriores) =>
      [...anteriores, proveedor].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    );
    actualizarCampoFormulario('proveedorId', String(proveedor.id));
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
      <TableRow
        key={producto.id}
        className={cn(
          !producto.activo && 'opacity-50',
          // Tinte suave de toda la fila: el problema se ve al recorrer la tabla sin tener que
          // fijarse en la columna de stock.
          producto.activo && sinStock && 'bg-error-bg/40',
          producto.activo && stockBajo && 'bg-gold/5'
        )}
      >
        <TableCell
          className={cn(
            'font-medium text-navy',
            // Barra lateral de color: refuerza el estado sin depender solo del tinte de fondo.
            producto.activo && sinStock && 'border-l-4 border-error-text',
            producto.activo && stockBajo && 'border-l-4 border-gold'
          )}
        >
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
            esAdmin && 'cursor-pointer select-none'
          )}
          onDoubleClick={() => abrirModalStock(producto)}
          title={esAdmin ? 'Doble clic para cambiar el stock' : undefined}
        >
          <span className="inline-flex flex-col items-start gap-1">
            <span className="inline-flex items-center gap-2">
              <span className="tabular-nums">{producto.stockActual}</span>
              {/* Etiqueta con texto (no solo un punto de color): dice qué pasa y qué hay que
                  hacer. "Agotado" = no se puede vender; "Stock bajo" = igual o por debajo del
                  mínimo configurado, todavía se vende pero hay que reponer. Mismo criterio que
                  la notificación de stock bajo de la campana. */}
              {sinStock && (
                <Badge className="border-error-text/40 bg-error-bg text-error-text" role="status">
                  Agotado
                </Badge>
              )}
              {stockBajo && (
                <Badge className="border-gold/50 bg-gold/15 text-gold" role="status">
                  Stock bajo
                </Badge>
              )}
            </span>
            {(sinStock || stockBajo) && (
              <span className="text-xs font-normal text-text-muted">
                Reponer al menos {Math.max(producto.stockMinimo - producto.stockActual, 1)} u. para llegar al mínimo
              </span>
            )}
          </span>
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
              accept=".xlsx"
              className="hidden"
              onChange={handleArchivoSeleccionado}
            />
            <Button variant="outline" onClick={handleClickImportar} disabled={importando}>
              {importando ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Upload className="h-4 w-4" />}
              Importar Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={descargandoExcel !== null}>
                  {descargandoExcel !== null ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Exportar
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="cursor-pointer" onClick={() => handleDescargarExcel('inventario')}>
                  Inventario actual (con datos)
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => handleDescargarExcel('plantilla')}>
                  Plantilla vacía (productos nuevos)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="gold" onClick={abrirDialogNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {esAdmin && (
        <p className="text-xs text-text-muted">
          Columnas del Excel: Nombre, Categoría (debe existir en Configuración → Categorías; si alguna no
          existe, el archivo completo se rechaza), Precio, StockInicial (mayor a 0), StockMinimo, CodigoBarras (opcional),
          TarifaIva (opcional: vacía aplica el IVA general vigente, 0 marca el producto como exento),
          Costo (opcional), Proveedor (opcional). El menú Exportar descarga la plantilla vacía con listas
          desplegables o una copia del inventario. Doble clic en "Stock actual" para cambiarlo rápido.
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

      <ResumenAlertasStock
        agotados={agotados}
        stockBajo={stockBajo}
        filtro={filtroAlerta}
        onCambiarFiltro={setFiltroAlerta}
      />

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
                  <TableCell colSpan={esAdmin ? 10 : 8} className="text-center text-text-muted">
                    <PantallaCargaLogo variante="en-linea" />
                  </TableCell>
                </TableRow>
              ) : productosAMostrar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={esAdmin ? 10 : 8} className="py-8 text-center text-text-muted">
                    No se encontraron productos.
                  </TableCell>
                </TableRow>
              ) : (
                productosAMostrar.map((producto) => renderFilaProducto(producto))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!productoEncontradoPorCodigo && !filtroAlerta && (
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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="proveedorId">Proveedor (opcional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDialogProveedorAbierto(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear proveedor
                </Button>
              </div>
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

            {productoEditando && (
              <GaleriaFotosProducto
                productoId={productoEditando.id}
                fotos={productoEditando.fotos}
                onCambiar={handleFotosCambiadas}
              />
            )}

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

      <ProveedorRapidoDialog
        abierto={dialogProveedorAbierto}
        onCambiarAbierto={setDialogProveedorAbierto}
        onCreado={handleProveedorCreado}
      />

      <Dialog open={dialogImportacionAbierto} onOpenChange={handleCerrarImportacion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resultadoImportacion?.aplicado
                ? 'Importación aplicada'
                : archivoPendiente
                  ? 'Vista previa de la importación'
                  : 'Resultado de la importación'}
            </DialogTitle>
          </DialogHeader>

          {errorImportacion && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {errorImportacion}
            </div>
          )}

          {resultadoImportacion && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Filas</p>
                  <p className="text-lg font-semibold text-navy">{resultadoImportacion.totalFilas}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Nuevos</p>
                  <p className="text-lg font-semibold text-green">{resultadoImportacion.creados}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Modificados</p>
                  <p className="text-lg font-semibold text-navy">{resultadoImportacion.modificados}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Sin cambios</p>
                  <p className="text-lg font-semibold text-text-muted">{resultadoImportacion.sinCambios}</p>
                </div>
              </div>

              {archivoPendiente && (
                <p className="text-sm text-text-muted">
                  Todavía no se ha guardado nada. Revisa el resumen y confirma para aplicar los cambios.
                </p>
              )}
              {!archivoPendiente &&
                !resultadoImportacion.aplicado &&
                resultadoImportacion.errores.length === 0 && (
                  <p className="text-sm text-text-muted">El archivo no tiene cambios para aplicar.</p>
                )}
            </div>
          )}

          {(resultadoImportacion?.errores ?? erroresImportacion).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-error-text">
                {(resultadoImportacion?.errores ?? erroresImportacion).length} fila(s) con errores — no se guardó ningún cambio.
                Corrige el archivo y vuelve a subirlo.
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
                        <TableCell className="text-navy">{error.fila > 0 ? error.fila : 'General'}</TableCell>
                        <TableCell className="text-error-text">{error.mensaje}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {archivoPendiente ? (
              <>
                <Button variant="outline" onClick={() => handleCerrarImportacion(false)} disabled={importando}>
                  Cancelar
                </Button>
                <Button variant="gold" onClick={handleConfirmarImportacion} disabled={importando}>
                  {importando ? 'Importando...' : 'Confirmar e importar'}
                </Button>
              </>
            ) : (
              <Button variant="gold" onClick={() => handleCerrarImportacion(false)}>
                Cerrar
              </Button>
            )}
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

      <Dialog open={productoStockModal !== null} onOpenChange={(abierto) => !abierto && cerrarModalStock()}>
        <DialogContent>
          <form onSubmit={handleConfirmarAjusteStock} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Cambiar stock</DialogTitle>
              <DialogDescription>
                {productoStockModal ? `"${productoStockModal.nombre}"` : ''} — escribe la cantidad que hay ahora
                en inventario.
              </DialogDescription>
            </DialogHeader>

            {productoStockModal && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border p-3">
                    <p className="text-text-muted">Stock actual</p>
                    <p className="text-lg font-semibold text-navy">{productoStockModal.stockActual}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-text-muted">Cambio</p>
                    <p
                      className={cn(
                        'text-lg font-semibold',
                        deltaStockModal > 0 ? 'text-green' : deltaStockModal < 0 ? 'text-error-text' : 'text-navy'
                      )}
                    >
                      {deltaStockModal > 0 ? `+${deltaStockModal}` : deltaStockModal}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nuevoStock">Nuevo stock</Label>
                  <Input
                    id="nuevoStock"
                    autoFocus
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={nuevoStockInput}
                    onChange={(e) => setNuevoStockInput(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    disabled={guardandoAjusteStock}
                  />
                  {nuevoStockInput.trim() !== '' && !nuevoStockValido && (
                    <p className="text-xs text-error-text">Escribe un número entero de 0 en adelante.</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrarModalStock} disabled={guardandoAjusteStock}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gold"
                disabled={guardandoAjusteStock || !nuevoStockValido || deltaStockModal === 0}
              >
                {guardandoAjusteStock ? 'Guardando...' : 'Aceptar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
