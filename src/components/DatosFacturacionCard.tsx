import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { actualizarConfiguracion, aRequest } from '@/services/configuracionService';
import type { ConfiguracionGeneral } from '@/types/configuracion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DatosFacturacionCardProps {
  configuracion: ConfiguracionGeneral | null;
  cargando: boolean;
  error: string | null;
  esAdmin: boolean;
  onActualizada: (configuracion: ConfiguracionGeneral) => void;
}

// Formulario en texto: los inputs siempre manejan strings; se convierten a su tipo real
// (número / fecha / null) solo al guardar, en un único lugar.
interface FormularioFacturacion {
  ciudadEmpresa: string;
  barrioEmpresa: string;
  responsabilidadIvaEmpresa: string;
  actividadEconomicaEmpresa: string;
  resolucionDianNumero: string;
  resolucionDianFecha: string;
  resolucionDianPrefijo: string;
  resolucionDianRangoDesde: string;
  resolucionDianRangoHasta: string;
  resolucionDianVigenciaMeses: string;
  textoLegalFactura: string;
  politicaCambiosFactura: string;
}

const vacioANull = (texto: string): string | null => (texto.trim() === '' ? null : texto.trim());
const numeroONull = (texto: string): number | null => (texto.trim() === '' ? null : Number(texto));

function aFormulario(c: ConfiguracionGeneral): FormularioFacturacion {
  return {
    ciudadEmpresa: c.ciudadEmpresa ?? '',
    barrioEmpresa: c.barrioEmpresa ?? '',
    responsabilidadIvaEmpresa: c.responsabilidadIvaEmpresa ?? '',
    actividadEconomicaEmpresa: c.actividadEconomicaEmpresa ?? '',
    resolucionDianNumero: c.resolucionDianNumero ?? '',
    resolucionDianFecha: c.resolucionDianFecha ? c.resolucionDianFecha.slice(0, 10) : '',
    resolucionDianPrefijo: c.resolucionDianPrefijo ?? '',
    resolucionDianRangoDesde: c.resolucionDianRangoDesde?.toString() ?? '',
    resolucionDianRangoHasta: c.resolucionDianRangoHasta?.toString() ?? '',
    resolucionDianVigenciaMeses: c.resolucionDianVigenciaMeses?.toString() ?? '',
    textoLegalFactura: c.textoLegalFactura ?? '',
    politicaCambiosFactura: c.politicaCambiosFactura ?? '',
  };
}

/**
 * Datos que completan el encabezado y el pie de la factura (ciudad, barrio, responsabilidad
 * de IVA, resolución DIAN, textos legales). Viven en Configuración —no en el código— para
 * que Gold los cree o cambie cuando le renueven la resolución, sin pedir un despliegue.
 */
export function DatosFacturacionCard({
  configuracion,
  cargando,
  error,
  esAdmin,
  onActualizada,
}: DatosFacturacionCardProps) {
  const { token } = useAuth();
  const [form, setForm] = useState<FormularioFacturacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    if (configuracion) setForm(aFormulario(configuracion));
  }, [configuracion]);

  function cambiar(campo: keyof FormularioFacturacion, valor: string) {
    setForm((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  }

  async function handleGuardar(e: FormEvent) {
    e.preventDefault();
    if (!configuracion || !form) return;
    setErrorGuardado(null);

    const desde = numeroONull(form.resolucionDianRangoDesde);
    const hasta = numeroONull(form.resolucionDianRangoHasta);
    if ((desde === null) !== (hasta === null)) {
      setErrorGuardado('El rango autorizado necesita los dos extremos (desde y hasta), o ninguno.');
      return;
    }
    if (desde !== null && hasta !== null && (desde < 1 || desde > hasta)) {
      setErrorGuardado('El rango debe empezar en 1 o más y "desde" no puede superar a "hasta".');
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await actualizarConfiguracion(
        {
          ...aRequest(configuracion),
          ciudadEmpresa: vacioANull(form.ciudadEmpresa),
          barrioEmpresa: vacioANull(form.barrioEmpresa),
          responsabilidadIvaEmpresa: vacioANull(form.responsabilidadIvaEmpresa),
          actividadEconomicaEmpresa: vacioANull(form.actividadEconomicaEmpresa),
          resolucionDianNumero: vacioANull(form.resolucionDianNumero),
          resolucionDianFecha: vacioANull(form.resolucionDianFecha),
          resolucionDianPrefijo: vacioANull(form.resolucionDianPrefijo),
          resolucionDianRangoDesde: desde,
          resolucionDianRangoHasta: hasta,
          resolucionDianVigenciaMeses: numeroONull(form.resolucionDianVigenciaMeses),
          textoLegalFactura: vacioANull(form.textoLegalFactura),
          politicaCambiosFactura: vacioANull(form.politicaCambiosFactura),
        },
        token
      );
      onActualizada(actualizado);
      toast.success('Datos de facturación actualizados correctamente');
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron actualizar los datos de facturación.';
      setErrorGuardado(mensaje);
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-navy">Datos de la factura</CardTitle>
        <CardDescription>
          Ciudad, barrio, responsabilidad de IVA, resolución de la DIAN y los textos que aparecen al
          pie de la factura y del tiquete. Lo que dejes vacío simplemente no se imprime.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cargando || (configuracion && !form) ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Cargando datos de la factura...
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
            {error}
          </div>
        ) : !esAdmin || !form ? (
          <p className="text-sm text-navy">
            {configuracion?.ciudadEmpresa ?? 'Sin configurar (solo un administrador puede hacerlo)'}
          </p>
        ) : (
          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ciudadEmpresa">Ciudad</Label>
                <Input id="ciudadEmpresa" placeholder="Ej. Bogotá, D.C." value={form.ciudadEmpresa}
                  onChange={(e) => cambiar('ciudadEmpresa', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barrioEmpresa">Barrio</Label>
                <Input id="barrioEmpresa" placeholder="Ej. Los Alpes" value={form.barrioEmpresa}
                  onChange={(e) => cambiar('barrioEmpresa', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsabilidadIvaEmpresa">Responsabilidad de IVA</Label>
                <Input id="responsabilidadIvaEmpresa" placeholder="Ej. Responsable de IVA / No responsable de IVA"
                  value={form.responsabilidadIvaEmpresa}
                  onChange={(e) => cambiar('responsabilidadIvaEmpresa', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actividadEconomicaEmpresa">Actividad económica</Label>
                <Input id="actividadEconomicaEmpresa" placeholder="Ej. 4752 - Comercio al por menor de artículos de ferretería"
                  value={form.actividadEconomicaEmpresa}
                  onChange={(e) => cambiar('actividadEconomicaEmpresa', e.target.value)} />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium text-navy">Resolución de la DIAN</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="resolucionDianNumero">Número</Label>
                  <Input id="resolucionDianNumero" value={form.resolucionDianNumero}
                    onChange={(e) => cambiar('resolucionDianNumero', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolucionDianFecha">Fecha</Label>
                  <Input id="resolucionDianFecha" type="date" value={form.resolucionDianFecha}
                    onChange={(e) => cambiar('resolucionDianFecha', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolucionDianPrefijo">Prefijo</Label>
                  <Input id="resolucionDianPrefijo" placeholder="Ej. FV" value={form.resolucionDianPrefijo}
                    onChange={(e) => cambiar('resolucionDianPrefijo', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolucionDianRangoDesde">Rango desde</Label>
                  <Input id="resolucionDianRangoDesde" type="number" min={1} value={form.resolucionDianRangoDesde}
                    onChange={(e) => cambiar('resolucionDianRangoDesde', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolucionDianRangoHasta">Rango hasta</Label>
                  <Input id="resolucionDianRangoHasta" type="number" min={1} value={form.resolucionDianRangoHasta}
                    onChange={(e) => cambiar('resolucionDianRangoHasta', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolucionDianVigenciaMeses">Vigencia (meses)</Label>
                  <Input id="resolucionDianVigenciaMeses" type="number" min={1} max={120}
                    value={form.resolucionDianVigenciaMeses}
                    onChange={(e) => cambiar('resolucionDianVigenciaMeses', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="textoLegalFactura">Texto legal (letra de cambio / título valor)</Label>
                <textarea id="textoLegalFactura" rows={3} maxLength={600} value={form.textoLegalFactura}
                  onChange={(e) => cambiar('textoLegalFactura', e.target.value)}
                  className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="politicaCambiosFactura">Política de cambios y devoluciones</Label>
                <textarea id="politicaCambiosFactura" rows={2} maxLength={300} value={form.politicaCambiosFactura}
                  onChange={(e) => cambiar('politicaCambiosFactura', e.target.value)}
                  className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
            </div>

            {errorGuardado && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorGuardado}
              </div>
            )}

            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar datos de la factura'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
