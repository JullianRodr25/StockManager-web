import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import {
  activarCliente,
  actualizarCliente,
  actualizarDatosFacturacion,
  buscarClientes,
  crearCliente,
  desactivarCliente,
} from '@/services/clienteService';
import type {
  ActualizarClienteRequest,
  ActualizarDatosFacturacionRequest,
  Cliente,
  CrearClienteRequest,
  TipoDocumentoFiscal,
} from '@/types/clientes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface ClienteForm {
  numeroIdentificacion: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  password: string;
}

const formularioVacio: ClienteForm = {
  numeroIdentificacion: '',
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
  password: '',
};

// Datos para factura electrónica: formulario aparte (misma pantalla, sección propia) porque
// tienen un propósito distinto al de contacto y se guardan con su propio endpoint para un
// cliente ya existente (ActualizarDatosFacturacionRequest). "" en tipoDocumentoFiscal
// representa "sin tipo seleccionado" en el <Select>; se traduce a null al guardar.
interface DatosFacturacionForm {
  tipoDocumentoFiscal: TipoDocumentoFiscal | '';
  numeroDocumentoFiscal: string;
  razonSocialFiscal: string;
  direccionFiscal: string;
  emailFacturacion: string;
}

const datosFacturacionVacio: DatosFacturacionForm = {
  tipoDocumentoFiscal: '',
  numeroDocumentoFiscal: '',
  razonSocialFiscal: '',
  direccionFiscal: '',
  emailFacturacion: '',
};

const tiposDocumentoFiscal: { valor: TipoDocumentoFiscal; etiqueta: string }[] = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'NIT', etiqueta: 'NIT' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'Pasaporte', etiqueta: 'Pasaporte' },
  { valor: 'Otro', etiqueta: 'Otro' },
];

export function Clientes() {
  const { token } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [formulario, setFormulario] = useState<ClienteForm>(formularioVacio);
  const [datosFacturacion, setDatosFacturacion] = useState<DatosFacturacionForm>(datosFacturacionVacio);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [clienteParaDesactivar, setClienteParaDesactivar] = useState<Cliente | null>(null);
  const [desactivando, setDesactivando] = useState(false);
  const [procesandoActivarId, setProcesandoActivarId] = useState<number | null>(null);

  const [dialogPasswordAbierto, setDialogPasswordAbierto] = useState(false);
  const [passwordGenerada, setPasswordGenerada] = useState<{ nombre: string; password: string } | null>(null);

  const cargarClientes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      // Sin "activo": trae todos, igual que Proveedores — el toggle solo decide qué se pinta.
      const resultado = await buscarClientes(busqueda, token);
      setClientes(resultado);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setCargando(false);
    }
  }, [token, busqueda]);

  useEffect(() => {
    const timeoutId = setTimeout(cargarClientes, 300);
    return () => clearTimeout(timeoutId);
  }, [cargarClientes]);

  const clientesVisibles = mostrarInactivos ? clientes : clientes.filter((c) => c.activo);

  function actualizarCampoFormulario(campo: keyof ClienteForm, valor: string) {
    setFormulario((previo) => ({ ...previo, [campo]: valor }));
  }

  function abrirDialogNuevo() {
    setClienteEditando(null);
    setFormulario(formularioVacio);
    setDatosFacturacion(datosFacturacionVacio);
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  function abrirDialogEditar(cliente: Cliente) {
    setClienteEditando(cliente);
    setFormulario({
      numeroIdentificacion: cliente.numeroIdentificacion,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      password: '',
    });
    setDatosFacturacion({
      tipoDocumentoFiscal: cliente.tipoDocumentoFiscal ?? '',
      numeroDocumentoFiscal: cliente.numeroDocumentoFiscal ?? '',
      razonSocialFiscal: cliente.razonSocialFiscal ?? '',
      direccionFiscal: cliente.direccionFiscal ?? '',
      emailFacturacion: cliente.emailFacturacion ?? '',
    });
    setErrorFormulario(null);
    setDialogAbierto(true);
  }

  function cerrarDialog(abierto: boolean) {
    setDialogAbierto(abierto);
    if (!abierto) {
      setClienteEditando(null);
    }
  }

  async function handleGuardarCliente(e: FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    if (!formulario.nombre.trim() || !formulario.email.trim() || !formulario.telefono.trim() || !formulario.direccion.trim()) {
      setErrorFormulario('Completa todos los campos obligatorios.');
      return;
    }
    if (!clienteEditando && !formulario.numeroIdentificacion.trim()) {
      setErrorFormulario('El número de identificación es obligatorio.');
      return;
    }

    setGuardando(true);
    try {
      const datosFacturacionRequest: ActualizarDatosFacturacionRequest = {
        tipoDocumentoFiscal: datosFacturacion.tipoDocumentoFiscal || null,
        numeroDocumentoFiscal: datosFacturacion.numeroDocumentoFiscal.trim() || null,
        razonSocialFiscal: datosFacturacion.razonSocialFiscal.trim() || null,
        direccionFiscal: datosFacturacion.direccionFiscal.trim() || null,
        emailFacturacion: datosFacturacion.emailFacturacion.trim() || null,
      };

      if (clienteEditando) {
        const data: ActualizarClienteRequest = {
          nombre: formulario.nombre.trim(),
          email: formulario.email.trim(),
          telefono: formulario.telefono.trim(),
          direccion: formulario.direccion.trim(),
        };
        await actualizarCliente(clienteEditando.id, data, token);
        // Los datos fiscales van en su propio endpoint/petición: son un propósito distinto
        // al de contacto (ver ActualizarDatosFacturacionRequest), aunque en esta pantalla se
        // editen juntos en un solo formulario por comodidad del usuario.
        await actualizarDatosFacturacion(clienteEditando.id, datosFacturacionRequest, token);
        toast.success('Cliente actualizado correctamente');
      } else {
        const data: CrearClienteRequest = {
          numeroIdentificacion: formulario.numeroIdentificacion.trim(),
          nombre: formulario.nombre.trim(),
          email: formulario.email.trim(),
          telefono: formulario.telefono.trim(),
          direccion: formulario.direccion.trim(),
          password: formulario.password.trim() || null,
          ...datosFacturacionRequest,
        };
        const resultado = await crearCliente(data, token);
        toast.success(`Cliente "${resultado.cliente.nombre}" creado correctamente`);
        if (resultado.passwordTemporal) {
          setPasswordGenerada({ nombre: resultado.cliente.nombre, password: resultado.passwordTemporal });
          setDialogPasswordAbierto(true);
        }
      }
      setDialogAbierto(false);
      setClienteEditando(null);
      await cargarClientes();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo guardar el cliente.';
      setErrorFormulario(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  async function handleConfirmarDesactivar() {
    if (!clienteParaDesactivar) return;

    setDesactivando(true);
    try {
      await desactivarCliente(clienteParaDesactivar.id, token);
      toast.success('Cliente desactivado');
      setClienteParaDesactivar(null);
      await cargarClientes();
    } catch (err) {
      // ClienteConPedidosActivosException llega como 400 con un mensaje claro del backend.
      toast.error(err instanceof ApiError ? err.message : 'No se pudo desactivar el cliente.');
    } finally {
      setDesactivando(false);
    }
  }

  async function handleActivar(cliente: Cliente) {
    setProcesandoActivarId(cliente.id);
    try {
      await activarCliente(cliente.id, token);
      toast.success('Cliente activado');
      await cargarClientes();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo activar el cliente.');
    } finally {
      setProcesandoActivarId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-navy">Clientes</h2>
          <p className="text-sm text-text-muted">
            Clientes registrados (autoregistrados en la PWA o creados aquí). Solo un cliente
            registrado puede ser parte de una Cuenta Abierta.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-text-muted">
            <Switch checked={mostrarInactivos} onCheckedChange={setMostrarInactivos} />
            Mostrar inactivos
          </label>
          <Button variant="gold" onClick={abrirDialogNuevo}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      <Input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o número de identificación..."
        className="sm:max-w-xs"
      />

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
                <TableHead>Identificación</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargando ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted">
                    <PantallaCargaLogo variante="en-linea" />
                  </TableCell>
                </TableRow>
              ) : clientesVisibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">
                    No hay clientes registrados.
                  </TableCell>
                </TableRow>
              ) : (
                clientesVisibles.map((cliente) => {
                  const activando = procesandoActivarId === cliente.id;
                  return (
                    <TableRow key={cliente.id} className={cn(!cliente.activo && 'opacity-50')}>
                      <TableCell className="font-medium text-navy">
                        <span className="flex items-center gap-2">
                          {cliente.nombre}
                          {!cliente.activo && <Badge variant="outline">Inactivo</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="text-navy">{cliente.numeroIdentificacion}</TableCell>
                      <TableCell className="text-navy">{cliente.telefono}</TableCell>
                      <TableCell className="text-text-muted">{cliente.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cliente.origenRegistro === 'Pwa' ? 'PWA' : 'Caja'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${cliente.nombre}`}
                            onClick={() => abrirDialogEditar(cliente)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {cliente.activo ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Desactivar ${cliente.nombre}`}
                              onClick={() => setClienteParaDesactivar(cliente)}
                            >
                              <Trash2 className="h-4 w-4 text-error-text" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Activar ${cliente.nombre}`}
                              disabled={activando}
                              onClick={() => handleActivar(cliente)}
                            >
                              {activando ? (
                                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                              ) : (
                                <RotateCcw className="h-4 w-4 text-green" />
                              )}
                            </Button>
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
            <DialogTitle>{clienteEditando ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
            <DialogDescription>
              {clienteEditando
                ? 'Actualiza los datos de contacto del cliente.'
                : 'Registra un cliente para poder abrirle una Cuenta Abierta o asociarlo a un pedido.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarCliente} className="space-y-4">
            {!clienteEditando && (
              <div className="space-y-2">
                <Label htmlFor="numeroIdentificacion">Número de identificación</Label>
                <Input
                  id="numeroIdentificacion"
                  value={formulario.numeroIdentificacion}
                  onChange={(e) => actualizarCampoFormulario('numeroIdentificacion', e.target.value)}
                  required
                />
              </div>
            )}

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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formulario.email}
                  onChange={(e) => actualizarCampoFormulario('email', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formulario.telefono}
                  onChange={(e) => actualizarCampoFormulario('telefono', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formulario.direccion}
                onChange={(e) => actualizarCampoFormulario('direccion', e.target.value)}
                required
              />
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-navy">Datos para factura electrónica</p>
                <p className="text-xs text-text-muted">
                  Opcionales. Se usan cuando este cliente pida factura electrónica en una venta;
                  no se piden de nuevo si ya están completos acá.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipoDocumentoFiscal">Tipo de documento</Label>
                  <Select
                    value={datosFacturacion.tipoDocumentoFiscal}
                    onValueChange={(valor) =>
                      setDatosFacturacion((previo) => ({ ...previo, tipoDocumentoFiscal: valor as TipoDocumentoFiscal }))
                    }
                  >
                    <SelectTrigger id="tipoDocumentoFiscal">
                      <SelectValue placeholder="Sin especificar" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposDocumentoFiscal.map((tipo) => (
                        <SelectItem key={tipo.valor} value={tipo.valor}>
                          {tipo.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroDocumentoFiscal">Número de documento</Label>
                  <Input
                    id="numeroDocumentoFiscal"
                    value={datosFacturacion.numeroDocumentoFiscal}
                    onChange={(e) =>
                      setDatosFacturacion((previo) => ({ ...previo, numeroDocumentoFiscal: e.target.value }))
                    }
                    placeholder="Ej. NIT con dígito de verificación"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="razonSocialFiscal">Razón social</Label>
                <Input
                  id="razonSocialFiscal"
                  value={datosFacturacion.razonSocialFiscal}
                  onChange={(e) => setDatosFacturacion((previo) => ({ ...previo, razonSocialFiscal: e.target.value }))}
                  placeholder="Nombre o razón social a facturar"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="direccionFiscal">Dirección fiscal</Label>
                  <Input
                    id="direccionFiscal"
                    value={datosFacturacion.direccionFiscal}
                    onChange={(e) => setDatosFacturacion((previo) => ({ ...previo, direccionFiscal: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFacturacion">Correo de facturación</Label>
                  <Input
                    id="emailFacturacion"
                    type="email"
                    value={datosFacturacion.emailFacturacion}
                    onChange={(e) => setDatosFacturacion((previo) => ({ ...previo, emailFacturacion: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {!clienteEditando && (
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña (opcional)</Label>
                <Input
                  id="password"
                  type="text"
                  value={formulario.password}
                  onChange={(e) => actualizarCampoFormulario('password', e.target.value)}
                  placeholder="Déjala vacía para generar una automáticamente"
                />
                <p className="text-xs text-text-muted">
                  Si la dejas vacía, se genera una contraseña temporal que se te mostrará una
                  sola vez para que se la entregues al cliente.
                </p>
              </div>
            )}

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
                {guardando ? 'Guardando...' : clienteEditando ? 'Guardar cambios' : 'Guardar cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogPasswordAbierto} onOpenChange={setDialogPasswordAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña temporal generada</DialogTitle>
            <DialogDescription>
              Entrégasela a {passwordGenerada?.nombre} para que pueda iniciar sesión en la PWA.
              No se podrá volver a consultar después de cerrar este mensaje.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-background p-3 text-center font-mono text-lg text-navy">
            {passwordGenerada?.password}
          </div>
          <DialogFooter>
            <Button variant="gold" onClick={() => setDialogPasswordAbierto(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={clienteParaDesactivar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setClienteParaDesactivar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no podrá iniciar sesión en la PWA ni abrírsele nuevas cuentas o pedidos, pero
              su historial se conserva. Si tiene un pedido en curso, no se podrá desactivar
              hasta que se entregue o cancele.
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
