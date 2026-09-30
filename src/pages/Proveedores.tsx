import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Plus, Receipt, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import {
  activarProveedor,
  actualizarProveedor,
  crearProveedor,
  desactivarProveedor,
  obtenerProveedores,
} from '@/services/proveedorService';
import type { ActualizarProveedorRequest, CrearProveedorRequest, Proveedor } from '@/types/proveedores';
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
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TAMANO_PAGINA = 100;

interface ProveedorForm {
  nombre: string;
  numeroIdentificacion: string;
  telefono: string;
  email: string;
  direccion: string;
  numeroWhatsApp: string;
}

const formularioVacio: ProveedorForm = {
  nombre: '',
  numeroIdentificacion: '',
  telefono: '',
  email: '',
  direccion: '',
  numeroWhatsApp: '',
};

const FORMATO_TELEFONO_E164 = /^\+[1-9]\d{7,14}$/;

export function Proveedores() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario?.rol === 'Admin';

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [formulario, setFormulario] = useState<ProveedorForm>(formularioVacio);
  const [proveedorEditando, setProveedorEditando] = useState<Proveedor | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [proveedorParaDesactivar, setProveedorParaDesactivar] = useState<Proveedor | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [procesandoActivarId, setProcesandoActivarId] = useState<number | null>(null);

  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Se trae la lista completa sin filtro de "activo" (mostrarInactivos solo decide qué
      // se pinta): así el toggle no dispara una nueva llamada al backend cada vez.
      const respuesta = await obtenerProveedores(1, TAMANO_PAGINA, token);
      setProveedores(respuesta.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proveedores.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  const proveedoresVisibles = mostrarInactivos ? proveedores : proveedores.filter((p) => p.activo);

  function actualizarCampoFormulario(campo: keyof ProveedorForm, valor: string) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function abrirDialogNuevo() {
    setProveedorEditando(null);
    setFormulario(formularioVacio);
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  function abrirDialogEditar(proveedor: Proveedor) {
    setProveedorEditando(proveedor);
    setFormulario({
      nombre: proveedor.nombre,
      numeroIdentificacion: proveedor.numeroIdentificacion ?? '',
      telefono: proveedor.telefono ?? '',
      email: proveedor.email ?? '',
      direccion: proveedor.direccion ?? '',
      numeroWhatsApp: proveedor.numeroWhatsApp ?? '',
    });
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  function cerrarDialog(abierto: boolean) {
    setDialogAbierto(abierto);
    if (!abierto) {
      setProveedorEditando(null);
    }
  }

  async function handleGuardarProveedor(e: FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    if (!formulario.nombre.trim()) {
      setErrorFormulario('El nombre del proveedor es obligatorio.');
      return;
    }

    const numeroWhatsAppNormalizado = formulario.numeroWhatsApp.trim() || null;
    if (numeroWhatsAppNormalizado && !FORMATO_TELEFONO_E164.test(numeroWhatsAppNormalizado)) {
      setErrorFormulario('El número de WhatsApp debe estar en formato internacional, ej. +573001234567.');
      return;
    }

    const data: CrearProveedorRequest | ActualizarProveedorRequest = {
      nombre: formulario.nombre.trim(),
      numeroIdentificacion: formulario.numeroIdentificacion.trim() || null,
      telefono: formulario.telefono.trim() || null,
      email: formulario.email.trim() || null,
      direccion: formulario.direccion.trim() || null,
      numeroWhatsApp: numeroWhatsAppNormalizado,
    };

    setGuardando(true);
    try {
      if (proveedorEditando) {
        await actualizarProveedor(proveedorEditando.id, data, token);
        toast.success('Proveedor actualizado correctamente');
      } else {
        await crearProveedor(data, token);
        toast.success(`Proveedor "${data.nombre}" creado correctamente`);
      }
      setDialogAbierto(false);
      setProveedorEditando(null);
      await cargarProveedores();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar el proveedor.';
      setErrorFormulario(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function handleConfirmarDesactivar() {
    if (!proveedorParaDesactivar) return;

    setDesactivando(true);
    try {
      await desactivarProveedor(proveedorParaDesactivar.id, token);
      toast.success('Proveedor desactivado');
      setProveedorParaDesactivar(null);
      await cargarProveedores();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo desactivar el proveedor.');
    } finally {
      setDesactivando(false);
    }
  }

  async function handleActivar(proveedor: Proveedor) {
    setProcesandoActivarId(proveedor.id);
    try {
      await activarProveedor(proveedor.id, token);
      toast.success('Proveedor activado');
      await cargarProveedores();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo activar el proveedor.');
    } finally {
      setProcesandoActivarId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-navy">Proveedores</h2>
          <p className="text-sm text-text-muted">Administra los proveedores y sus compras a crédito.</p>
        </div>

        <div className="flex items-center gap-3">
          {esAdmin && (
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-text-muted">
              <Switch checked={mostrarInactivos} onCheckedChange={setMostrarInactivos} />
              Mostrar inactivos
            </label>
          )}
          {esAdmin && (
            <Button variant="gold" onClick={abrirDialogNuevo}>
              <Plus className="h-4 w-4" />
              Nuevo proveedor
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {error}
        </div>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>NIT / identificación</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </TableCell>
                </TableRow>
              ) : proveedoresVisibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    No hay proveedores registrados.
                  </TableCell>
                </TableRow>
              ) : (
                proveedoresVisibles.map((proveedor) => {
                  const activando = procesandoActivarId === proveedor.id;
                  return (
                    <TableRow key={proveedor.id} className={cn(!proveedor.activo && 'opacity-50')}>
                      <TableCell className="font-medium text-navy">
                        <span className="flex items-center gap-2">
                          {proveedor.nombre}
                          {!proveedor.activo && <Badge variant="outline">Inactivo</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-navy">{proveedor.numeroIdentificacion ?? '—'}</TableCell>
                      <TableCell className="text-navy">{proveedor.telefono ?? '—'}</TableCell>
                      <TableCell className="text-text-muted">{proveedor.email ?? '—'}</TableCell>
                      <TableCell className="text-navy">{proveedor.numeroWhatsApp ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild aria-label={`Cuentas por pagar de ${proveedor.nombre}`}>
                            <Link to={`/proveedores/cuentas-por-pagar?proveedorId=${proveedor.id}`}>
                              <Receipt className="h-4 w-4" />
                            </Link>
                          </Button>
                          {esAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Editar ${proveedor.nombre}`}
                                onClick={() => abrirDialogEditar(proveedor)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {proveedor.activo ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Desactivar ${proveedor.nombre}`}
                                  onClick={() => setProveedorParaDesactivar(proveedor)}
                                >
                                  <Trash2 className="h-4 w-4 text-error-text" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Activar ${proveedor.nombre}`}
                                  disabled={activando}
                                  onClick={() => handleActivar(proveedor)}
                                >
                                  {activando ? (
                                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 text-green" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={cerrarDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{proveedorEditando ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {proveedorEditando
                ? 'Actualiza los datos de contacto del proveedor.'
                : 'Registra un proveedor nuevo para poder llevarle cuentas por pagar a crédito.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarProveedor} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formulario.nombre}
                onChange={(e) => actualizarCampoFormulario('nombre', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numeroIdentificacion">NIT / identificación (opcional)</Label>
                <Input
                  id="numeroIdentificacion"
                  value={formulario.numeroIdentificacion}
                  onChange={(e) => actualizarCampoFormulario('numeroIdentificacion', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono (opcional)</Label>
                <Input
                  id="telefono"
                  value={formulario.telefono}
                  onChange={(e) => actualizarCampoFormulario('telefono', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={formulario.email}
                onChange={(e) => actualizarCampoFormulario('email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección (opcional)</Label>
              <Input
                id="direccion"
                value={formulario.direccion}
                onChange={(e) => actualizarCampoFormulario('direccion', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroWhatsApp">WhatsApp para avisos de stock bajo (opcional)</Label>
              <Input
                id="numeroWhatsApp"
                placeholder="+573001234567"
                value={formulario.numeroWhatsApp}
                onChange={(e) => actualizarCampoFormulario('numeroWhatsApp', e.target.value)}
              />
              <p className="text-xs text-text-muted">
                Formato internacional (con el + y el código de país). Si lo configuras, el sistema le avisará
                automáticamente por WhatsApp cuando alguno de sus productos entre en stock bajo.
              </p>
            </div>

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => cerrarDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={guardando}>
                {guardando ? 'Guardando...' : proveedorEditando ? 'Guardar cambios' : 'Guardar proveedor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={proveedorParaDesactivar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setProveedorParaDesactivar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no podrás registrarle nuevas cuentas por pagar, pero su historial se conserva.
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
    </div>
  );
}
