import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImagePlus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLogo } from '@/context/LogoContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const TAMANO_MAXIMO_BYTES = 3 * 1024 * 1024; // 3 MB

export function Configuracion() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'Admin';
  const { logoUrl, esLogoPersonalizado, actualizarLogo, restaurarLogoPredeterminado } = useLogo();

  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [cargandoLogo, setCargandoLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);

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

      <Separator />

      <p className="text-sm text-text-muted">Más ajustes próximamente.</p>
    </div>
  );
}
