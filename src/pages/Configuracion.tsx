import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLogo } from '@/context/LogoContext';
import { ApiError } from '@/services/api';
import { actualizarConfiguracion, obtenerConfiguracion } from '@/services/configuracionService';
import type { ConfiguracionGeneral } from '@/types/configuracion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const TAMANO_MAXIMO_BYTES = 3 * 1024 * 1024; // 3 MB

export function Configuracion() {
  const { usuario, token } = useAuth();
  const esAdmin = usuario?.rol === 'Admin';
  const { logoUrl, esLogoPersonalizado, actualizarLogo, restaurarLogoPredeterminado } = useLogo();

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [cargandoLogo, setCargandoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

  const [configuracion, setConfiguracion] = useState<ConfiguracionGeneral | null>(null);
  const [cargandoConfiguracion, setCargandoConfiguracion] = useState(true);
  const [errorConfiguracion, setErrorConfiguracion] = useState<string | null>(null);
  const [tarifaIvaInput, setTarifaIvaInput] = useState('');
  const [guardandoIva, setGuardandoIva] = useState(false);
  const [errorIva, setErrorIva] = useState<string | null>(null);
  const [telefonoAdminInput, setTelefonoAdminInput] = useState('');
  const [guardandoTelefonoAdmin, setGuardandoTelefonoAdmin] = useState(false);
  const [errorTelefonoAdmin, setErrorTelefonoAdmin] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfiguracion(token)
      .then((data) => {
        setConfiguracion(data);
        setTarifaIvaInput(String(data.tarifaIvaPorDefecto));
        setTelefonoAdminInput(data.telefonoNotificacionesAdmin ?? '');
      })
      .catch((err) => {
        setErrorConfiguracion(
          err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.'
        );
      })
      .finally(() => setCargandoConfiguracion(false));
  }, [token]);

  function handleClickCambiarLogo() {
    inputArchivoRef.current?.click();
  }

  function handleArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setErrorLogo(null);

    if (!archivo.type.startsWith('image/')) {
      setErrorLogo('El archivo debe ser una imagen (PNG, JPG o SVG).');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setErrorLogo('La imagen no puede pesar más de 3 MB.');
      return;
    }

    setCargandoLogo(true);
    const lector = new FileReader();
    lector.onload = () => {
      actualizarLogo(lector.result as string);
      toast.success('Logo actualizado correctamente');
      setCargandoLogo(false);
    };
    lector.onerror = () => {
      setErrorLogo('No se pudo leer el archivo seleccionado.');
      setCargandoLogo(false);
    };
    lector.readAsDataURL(archivo);
  }

  function handleRestaurarLogo() {
    restaurarLogoPredeterminado();
    toast.success('Se restauró el logo predeterminado');
  }

  async function handleGuardarIva(e: FormEvent) {
    e.preventDefault();
    setErrorIva(null);

    const valor = Number(tarifaIvaInput);
    if (tarifaIvaInput.trim() === '' || Number.isNaN(valor) || valor < 0 || valor > 100) {
      setErrorIva('Ingresa una tarifa válida entre 0 y 100.');
      return;
    }

    setGuardandoIva(true);
    try {
      const actualizado = await actualizarConfiguracion(
        {
          tarifaIvaPorDefecto: valor,
          // El PUT reemplaza toda la fila de Configuracion, así que se reenvía el teléfono
          // vigente para no borrarlo al guardar solo la tarifa.
          telefonoNotificacionesAdmin: configuracion?.telefonoNotificacionesAdmin ?? null,
        },
        token
      );
      setConfiguracion(actualizado);
      setTarifaIvaInput(String(actualizado.tarifaIvaPorDefecto));
      toast.success('Tarifa de IVA actualizada correctamente');
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo actualizar la tarifa de IVA.';
      setErrorIva(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardandoIva(false);
    }
  }

  const FORMATO_TELEFONO_E164 = /^\+[1-9]\d{7,14}$/;

  async function handleGuardarTelefonoAdmin(e: FormEvent) {
    e.preventDefault();
    setErrorTelefonoAdmin(null);

    const valor = telefonoAdminInput.trim();
    if (valor !== '' && !FORMATO_TELEFONO_E164.test(valor)) {
      setErrorTelefonoAdmin('Ingresa un número en formato internacional, ej. +573001234567, o déjalo vacío para desactivar el aviso.');
      return;
    }

    setGuardandoTelefonoAdmin(true);
    try {
      const actualizado = await actualizarConfiguracion(
        {
          tarifaIvaPorDefecto: configuracion?.tarifaIvaPorDefecto ?? 0,
          telefonoNotificacionesAdmin: valor === '' ? null : valor,
        },
        token
      );
      setConfiguracion(actualizado);
      setTelefonoAdminInput(actualizado.telefonoNotificacionesAdmin ?? '');
      toast.success('Teléfono de notificaciones actualizado correctamente');
    } catch (err) {
      const mensaje =
        err instanceof ApiError ? err.message : 'No se pudo actualizar el teléfono de notificaciones.';
      setErrorTelefonoAdmin(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardandoTelefonoAdmin(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-navy">Configuración</h2>
        <p className="text-sm text-text-muted">Ajustes generales del sistema.</p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-navy">Logotipo de la empresa</CardTitle>
          <CardDescription>
            Este logo se muestra en el menú lateral y en la pantalla de inicio de sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <img
              src={logoUrl}
              alt="Logo actual de la empresa"
              className="h-24 w-24 shrink-0 rounded-full border-2 border-gold object-cover"
            />

            {esAdmin ? (
              <div className="flex flex-1 flex-col gap-3">
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleArchivoSeleccionado}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="gold" onClick={handleClickCambiarLogo} disabled={cargandoLogo}>
                    <ImagePlus className="h-4 w-4" />
                    {cargandoLogo ? 'Cargando...' : 'Cambiar logo'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRestaurarLogo}
                    disabled={cargandoLogo || !esLogoPersonalizado}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restaurar predeterminado
                  </Button>
                </div>
                <p className="text-xs text-text-muted">
                  Formatos admitidos: PNG, JPG o SVG. Tamaño máximo 3 MB.
                </p>
                {errorLogo && (
                  <div
                    className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text"
                    role="alert"
                  >
                    {errorLogo}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                Solo un administrador puede cambiar el logo de la empresa.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-navy">Tarifa de IVA general</CardTitle>
          <CardDescription>
            Se aplica por defecto a los productos nuevos que no especifiquen una tarifa propia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargandoConfiguracion ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Cargando tarifa vigente...
            </div>
          ) : errorConfiguracion ? (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {errorConfiguracion}
            </div>
          ) : esAdmin ? (
            <form onSubmit={handleGuardarIva} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="tarifaIvaPorDefecto">IVA (%)</Label>
                <div className="relative max-w-[10rem]">
                  <Input
                    id="tarifaIvaPorDefecto"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={tarifaIvaInput}
                    onChange={(e) => setTarifaIvaInput(e.target.value)}
                    className="pr-8"
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                    %
                  </span>
                </div>
              </div>

              {errorIva && (
                <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                  {errorIva}
                </div>
              )}

              <Button type="submit" variant="gold" disabled={guardandoIva}>
                {guardandoIva ? 'Guardando...' : 'Guardar tarifa'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-navy">
              Tarifa vigente: <span className="font-semibold">{configuracion?.tarifaIvaPorDefecto}%</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/*
        A diferencia de las tarjetas de arriba (que muestran una vista de solo lectura a
        Empleado), esta tarjeta no se muestra en absoluto si no eres Admin: el backend
        directamente omite este teléfono en la respuesta para cualquier otro rol, así que no
        habría nada real que mostrarle a un Empleado aquí — es justo el aislamiento "por rol,
        por seguridad" que se pidió para este dato.
      */}
      {esAdmin && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-navy">Notificaciones por WhatsApp</CardTitle>
            <CardDescription>
              Número que recibe los avisos administrativos: pedidos nuevos y cuentas por pagar
              próximas a vencer. Solo un administrador puede ver y cambiar este dato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cargandoConfiguracion ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                Cargando configuración de notificaciones...
              </div>
            ) : errorConfiguracion ? (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorConfiguracion}
              </div>
            ) : (
              <form onSubmit={handleGuardarTelefonoAdmin} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="telefonoNotificacionesAdmin">Teléfono de WhatsApp</Label>
                  <Input
                    id="telefonoNotificacionesAdmin"
                    type="tel"
                    placeholder="+573001234567"
                    value={telefonoAdminInput}
                    onChange={(e) => setTelefonoAdminInput(e.target.value)}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-text-muted">
                    Formato internacional (E.164), ej. +573001234567. Déjalo vacío para desactivar
                    este aviso.
                  </p>
                </div>

                {errorTelefonoAdmin && (
                  <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                    {errorTelefonoAdmin}
                  </div>
                )}

                <Button type="submit" variant="gold" disabled={guardandoTelefonoAdmin}>
                  {guardandoTelefonoAdmin ? 'Guardando...' : 'Guardar teléfono'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      <p className="text-sm text-text-muted">Más ajustes próximamente.</p>
    </div>
  );
}
