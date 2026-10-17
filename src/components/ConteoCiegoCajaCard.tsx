import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { actualizarConfiguracion, aRequest } from '@/services/configuracionService';
import type { ConfiguracionGeneral } from '@/types/configuracion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ConteoCiegoCajaCardProps {
  configuracion: ConfiguracionGeneral | null;
  esAdmin: boolean;
  onActualizada: (configuracion: ConfiguracionGeneral) => void;
}

/**
 * Define si al cerrar la caja el empleado cuenta sin ver el efectivo esperado. A ciegas evita
 * que el conteo se "ajuste" para que cuadre. Un administrador siempre ve el esperado.
 */
export function ConteoCiegoCajaCard({ configuracion, esAdmin, onActualizada }: ConteoCiegoCajaCardProps) {
  const { token } = useAuth();
  const [guardando, setGuardando] = useState(false);

  async function handleCambiar(conteoCiegoCaja: boolean) {
    if (!configuracion) return;
    setGuardando(true);
    try {
      const actualizada = await actualizarConfiguracion({ ...aRequest(configuracion), conteoCiegoCaja }, token);
      onActualizada(actualizada);
      toast.success(conteoCiegoCaja ? 'Conteo a ciegas activado' : 'Conteo a ciegas desactivado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-navy">Cierre de caja</CardTitle>
        <CardDescription>
          Con el conteo a ciegas, el empleado cuenta el efectivo sin ver cuánto debería haber; el sistema
          muestra el resultado al cerrar. Un administrador siempre ve el esperado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Switch
            id="conteoCiegoCaja"
            checked={configuracion?.conteoCiegoCaja ?? true}
            onCheckedChange={handleCambiar}
            disabled={!esAdmin || guardando || !configuracion}
          />
          <Label htmlFor="conteoCiegoCaja" className="text-navy">
            Contar a ciegas
          </Label>
        </div>
        {!esAdmin && (
          <p className="mt-2 text-xs text-text-muted">Solo un administrador puede cambiar esta opción.</p>
        )}
      </CardContent>
    </Card>
  );
}
