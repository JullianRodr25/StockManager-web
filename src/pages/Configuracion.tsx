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

  useEffect(() => {
    obtenerConfiguracion(token)
      .then((data) => {
        setConfiguracion(data);
        setTarifaIvaInput(String(data.tarifaIvaPorDefecto));
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
      const actualizado = await actualizarConfiguracion({ tarifaIvaPorDefecto: valor }, token);
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

      <Separator />

      <p className="text-sm text-text-muted">Más ajustes próximamente.</p>
    </div>
  );
}
