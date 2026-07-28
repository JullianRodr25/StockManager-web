import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { Barcode, Loader2, Plus, Search, Upload, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import {
  buscarProductoPorCodigoBarras,
  crearProducto,
  importarProductos,
  obtenerCategorias,
  obtenerProductos,
} from '@/services/inventarioService';
import type {
  Categoria,
  CrearProductoRequest,
  ImportarProductosResponse,
  Producto,
} from '@/types/inventario';
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
}

const formularioVacio: NuevoProductoForm = {
  nombre: '',
  categoriaId: '',
  precio: '',
  stockInicial: '',
  stockMinimo: '',
  codigoBarras: '',
};

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

  const [codigoBarrasBusqueda, setCodigoBarrasBusqueda] = useState('');
  const [buscandoPorCodigo, setBuscandoPorCodigo] = useState(false);
  const [errorBusquedaCodigo, setErrorBusquedaCodigo] = useState<string | null>(null);
  const [productoEncontradoPorCodigo, setProductoEncontradoPorCodigo] = useState<Producto | null>(null);

  const [dialogNuevoAbierto, setDialogNuevoAbierto] = useState(false);
  const [formulario, setFormulario] = useState<NuevoProductoForm>(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState<ImportarProductosResponse | null>(null);
  const [dialogImportacionAbierto, setDialogImportacionAbierto] = useState(false);
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);

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

  useEffect(() => {
    obtenerCategorias(token)
      .then(setCategorias)
      .catch(() => {
        // Si fallan las categorías, el filtro simplemente queda vacío;
        // la tabla de productos puede seguir funcionando sin filtro.
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
    if (!busqueda.trim()) return productos;
    const termino = busqueda.trim().toLowerCase();
    return productos.filter((producto) => producto.nombre.toLowerCase().includes(termino));
  }, [productos, busqueda]);

  const categoriaPorId = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias]
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

  function actualizarCampoFormulario(campo: keyof NuevoProductoForm, valor: string) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function abrirDialogNuevo() {
    setFormulario(formularioVacio);
    setErrorFormulario(null);
    setDialogNuevoAbierto(true);
  }

  async function handleCrearProducto(e: FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    const precio = Number(formulario.precio);
    const stockInicial = Number(formulario.stockInicial);
    const stockMinimo = Number(formulario.stockMinimo);
    const categoriaId = Number(formulario.categoriaId);

    if (
      !formulario.nombre.trim() ||
      !categoriaId ||
      Number.isNaN(precio) ||
      Number.isNaN(stockInicial) ||
      Number.isNaN(stockMinimo)
    ) {
      setErrorFormulario('Completa todos los campos obligatorios con valores válidos.');
      return;
    }

    const data: CrearProductoRequest = {
      nombre: formulario.nombre.trim(),
      categoriaId,
      precio,
      stockInicial,
      stockMinimo,
      ...(formulario.codigoBarras.trim() ? { codigoBarras: formulario.codigoBarras.trim() } : {}),
    };

    setGuardando(true);
    try {
      await crearProducto(data, token);
      setDialogNuevoAbierto(false);
      const categoriaIdFiltro = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
      await cargarProductos(pagina, categoriaIdFiltro);
    } catch (err) {
      setErrorFormulario(err instanceof ApiError ? err.message : 'No se pudo crear el producto.');
    } finally {
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
    try {
      const resultado = await importarProductos(archivo, token);
      setResultadoImportacion(resultado);
      setDialogImportacionAbierto(true);
      const categoriaId = categoriaFiltro === 'todas' ? undefined : Number(categoriaFiltro);
      await cargarProductos(pagina, categoriaId);
    } catch (err) {
      setResultadoImportacion(null);
      setErrorImportacion(err instanceof ApiError ? err.message : 'No se pudo importar el archivo.');
      setDialogImportacionAbierto(true);
    } finally {
      setImportando(false);
    }
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
                <TableHead>Stock actual</TableHead>
                <TableHead>Stock mínimo</TableHead>
                <TableHead>Código de barras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productoEncontradoPorCodigo ? (
                (() => {
                  const producto = productoEncontradoPorCodigo;
                  const sinStock = producto.stockActual <= 0;
                  const stockBajo = !sinStock && producto.stockActual <= producto.stockMinimo;
                  return (
                    <TableRow key={producto.id}>
                      <TableCell className="font-medium text-navy">{producto.nombre}</TableCell>
                      <TableCell className="text-navy">{categoriaPorId.get(producto.categoriaId) ?? '—'}</TableCell>
                      <TableCell className="text-navy">{formatoMoneda.format(producto.precio)}</TableCell>
                      <TableCell
                        className={cn(
                          'font-semibold',
                          sinStock ? 'text-error-text' : stockBajo ? 'text-gold' : 'text-navy'
                        )}
                      >
                        {producto.stockActual}
                      </TableCell>
                      <TableCell className="text-navy">{producto.stockMinimo}</TableCell>
                      <TableCell className="text-text-muted">{producto.codigoBarras ?? '—'}</TableCell>
                    </TableRow>
                  );
                })()
              ) : cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </TableCell>
                </TableRow>
              ) : productosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    No se encontraron productos.
                  </TableCell>
                </TableRow>
              ) : (
                productosFiltrados.map((producto) => {
                  const sinStock = producto.stockActual <= 0;
                  const stockBajo = !sinStock && producto.stockActual <= producto.stockMinimo;
                  return (
                    <TableRow key={producto.id}>
                      <TableCell className="font-medium text-navy">{producto.nombre}</TableCell>
                      <TableCell className="text-navy">{categoriaPorId.get(producto.categoriaId) ?? '—'}</TableCell>
                      <TableCell className="text-navy">{formatoMoneda.format(producto.precio)}</TableCell>
                      <TableCell
                        className={cn(
                          'font-semibold',
                          sinStock ? 'text-error-text' : stockBajo ? 'text-gold' : 'text-navy'
                        )}
                      >
                        {producto.stockActual}
                      </TableCell>
                      <TableCell className="text-navy">{producto.stockMinimo}</TableCell>
                      <TableCell className="text-text-muted">{producto.codigoBarras ?? '—'}</TableCell>
                    </TableRow>
                  );
                })
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

      <Dialog open={dialogNuevoAbierto} onOpenChange={setDialogNuevoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo producto</DialogTitle>
            <DialogDescription>Registra un producto nuevo en el inventario.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCrearProducto} className="space-y-4">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="precio">Precio</Label>
                <Input
                  id="precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.precio}
                  onChange={(e) => actualizarCampoFormulario('precio', e.target.value)}
                  required
                />
              </div>
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

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogNuevoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar producto'}
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

          {errorImportacion ? (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {errorImportacion}
            </div>
          ) : (
            resultadoImportacion && (
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

                {resultadoImportacion.errores.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-error-text">
                      {resultadoImportacion.errores.length} fila(s) con errores
                    </p>
                    <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
                      {resultadoImportacion.errores.map((error) => (
                        <li key={error.fila} className="text-navy">
                          Fila {error.fila}: <span className="text-error-text">{error.mensaje}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          )}

          <DialogFooter>
            <Button variant="gold" onClick={() => setDialogImportacionAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
