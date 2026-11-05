import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { actualizarCategoria, crearCategoria, eliminarCategoria, obtenerCategorias } from '@/services/inventarioService';
import type { Categoria } from '@/types/inventario';
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

const LONGITUD_MAXIMA = 100; // Mismo límite que Categoria.Crear en el backend.

// Misma regla que el backend (comparación sin distinguir mayúsculas, con el nombre recortado).
// Es solo una ayuda para avisar antes de enviar: la validación que manda sigue siendo la del servidor.
const normalizar = (nombre: string) => nombre.trim().toLocaleUpperCase('es');

interface CategoriasDialogProps {
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  /** Se avisa cuando se crea, renombra o elimina una categoría, para que la pantalla que lo abrió refresque sus listas. */
  onCategoriasCambiadas?: () => void;
}

/**
 * Maestro de categorías: lista las que ya existen y permite agregar, renombrar y eliminar (solo si
 * no tienen productos). Es la única forma de crear categorías — los productos y la importación de
 * Excel solo pueden usar las de esta lista.
 */
export function CategoriasDialog({ abierto, onCambiarAbierto, onCategoriasCambiadas }: CategoriasDialogProps) {
  const { token } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [porEliminar, setPorEliminar] = useState<Categoria | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Se recarga cada vez que se abre: otra persona pudo haber agregado categorías mientras tanto.
  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setCargando(true);
    setErrorCarga(null);
    setNombre('');
    setErrorNombre(null);
    setEditandoId(null);
    setErrorEdicion(null);
    obtenerCategorias(token)
      .then((data) => {
        if (!cancelado) setCategorias(data);
      })
      .catch((err) => {
        if (!cancelado) {
          setErrorCarga(err instanceof ApiError ? err.message : 'No se pudieron cargar las categorías.');
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, token]);

  const nombresExistentes = useMemo(() => new Set(categorias.map((c) => normalizar(c.nombre))), [categorias]);
  const nombreRecortado = nombre.trim();
  const duplicada = nombreRecortado !== '' && nombresExistentes.has(normalizar(nombreRecortado));

  async function handleAgregar(e: FormEvent) {
    e.preventDefault();
    if (guardando || nombreRecortado === '' || duplicada) return;

    setGuardando(true);
    setErrorNombre(null);
    try {
      const creada = await crearCategoria(nombreRecortado, token);
      setCategorias((previo) =>
        [...previo, { ...creada, cantidadProductos: creada.cantidadProductos ?? 0 }].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        )
      );
      setNombre('');
      toast.success(`Categoría "${creada.nombre}" creada correctamente`);
      onCategoriasCambiadas?.();
    } catch (err) {
      setErrorNombre(err instanceof ApiError ? err.message : 'No se pudo crear la categoría.');
    } finally {
      setGuardando(false);
    }
  }

  function empezarEdicion(categoria: Categoria) {
    setEditandoId(categoria.id);
    setNombreEditado(categoria.nombre);
    setErrorEdicion(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setErrorEdicion(null);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (guardandoEdicion || editandoId === null) return;
    const nuevoNombre = nombreEditado.trim();
    if (nuevoNombre === '') return;

    // Otra categoría distinta de la que se edita con el mismo nombre.
    const choca = categorias.some((c) => c.id !== editandoId && normalizar(c.nombre) === normalizar(nuevoNombre));
    if (choca) {
      setErrorEdicion('Ya existe una categoría con ese nombre.');
      return;
    }

    setGuardandoEdicion(true);
    setErrorEdicion(null);
    try {
      const actualizada = await actualizarCategoria(editandoId, nuevoNombre, token);
      setCategorias((previo) =>
        previo
          .map((c) => (c.id === actualizada.id ? { ...c, nombre: actualizada.nombre } : c))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
      );
      setEditandoId(null);
      toast.success('Categoría renombrada correctamente');
      onCategoriasCambiadas?.();
    } catch (err) {
      setErrorEdicion(err instanceof ApiError ? err.message : 'No se pudo renombrar la categoría.');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function handleConfirmarEliminar() {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await eliminarCategoria(porEliminar.id, token);
      setCategorias((previo) => previo.filter((c) => c.id !== porEliminar.id));
      toast.success(`Categoría "${porEliminar.nombre}" eliminada`);
      setPorEliminar(null);
      onCategoriasCambiadas?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar la categoría.');
      setPorEliminar(null);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <>
    <Dialog open={abierto} onOpenChange={onCambiarAbierto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
          <DialogDescription>
            Los productos y la importación de Excel solo pueden usar las categorías de esta lista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAgregar} className="space-y-1.5">
          <Label htmlFor="nuevaCategoria">Nueva categoría</Label>
          <div className="flex gap-2">
            <Input
              id="nuevaCategoria"
              autoFocus
              value={nombre}
              maxLength={LONGITUD_MAXIMA}
              placeholder="Ej: Ferretería, Plomería, Hogar"
              onChange={(e) => {
                setNombre(e.target.value);
                setErrorNombre(null);
              }}
              disabled={guardando}
            />
            <Button type="submit" variant="gold" disabled={guardando || nombreRecortado === '' || duplicada}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Plus className="h-4 w-4" />}
              Agregar
            </Button>
          </div>
          {duplicada && <p className="text-xs text-error-text">Ya existe una categoría con ese nombre.</p>}
          {errorNombre && (
            <p className="text-xs text-error-text" role="alert">
              {errorNombre}
            </p>
          )}
        </form>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Categorías existentes ({categorias.length})
          </p>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border">
            {cargando ? (
              <p className="flex items-center gap-2 p-4 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Cargando...
              </p>
            ) : errorCarga ? (
              <p className="p-4 text-sm text-error-text" role="alert">
                {errorCarga}
              </p>
            ) : categorias.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">Aún no hay categorías. Agrega la primera arriba.</p>
            ) : (
              <ul className="divide-y divide-border">
                {categorias.map((categoria) => (
                  <li key={categoria.id} className="px-3 py-2 text-sm">
                    {editandoId === categoria.id ? (
                      <form onSubmit={handleGuardarEdicion} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            aria-label={`Nuevo nombre de ${categoria.nombre}`}
                            value={nombreEditado}
                            maxLength={LONGITUD_MAXIMA}
                            onChange={(e) => {
                              setNombreEditado(e.target.value);
                              setErrorEdicion(null);
                            }}
                            disabled={guardandoEdicion}
                          />
                          <Button
                            type="submit"
                            size="icon"
                            variant="gold"
                            aria-label="Guardar nombre"
                            disabled={guardandoEdicion || nombreEditado.trim() === ''}
                          >
                            {guardandoEdicion ? (
                              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Cancelar edición"
                            onClick={cancelarEdicion}
                            disabled={guardandoEdicion}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {errorEdicion && (
                          <p className="text-xs text-error-text" role="alert">
                            {errorEdicion}
                          </p>
                        )}
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-navy">{categoria.nombre}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="mr-1 text-xs text-text-muted">
                            {categoria.cantidadProductos === 1 ? '1 producto' : `${categoria.cantidadProductos} productos`}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Renombrar ${categoria.nombre}`}
                            onClick={() => empezarEdicion(categoria)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Eliminar ${categoria.nombre}`}
                            title={
                              categoria.cantidadProductos > 0
                                ? 'Tiene productos: cámbiales la categoría para poder eliminarla'
                                : undefined
                            }
                            disabled={categoria.cantidadProductos > 0}
                            onClick={() => setPorEliminar(categoria)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onCambiarAbierto(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={porEliminar !== null} onOpenChange={(valor) => !valor && !eliminando && setPorEliminar(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar la categoría "{porEliminar?.nombre}"?</AlertDialogTitle>
          <AlertDialogDescription>
            No tiene productos. Si la necesitas después, tendrás que crearla de nuevo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={eliminando}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirmarEliminar();
            }}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
