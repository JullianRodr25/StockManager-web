import type { ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { hoyColombia, primerDiaDelMes, rangoMesActual, sumarDias, ultimoDiaDelMes } from '@/utils/fechas';
import type { RangoFechas } from '@/utils/fechas';

const PRESETS: { etiqueta: string; calcular: () => RangoFechas }[] = [
  { etiqueta: 'Hoy', calcular: () => ({ desde: hoyColombia(), hasta: hoyColombia() }) },
  { etiqueta: '7 días', calcular: () => ({ desde: sumarDias(hoyColombia(), -6), hasta: hoyColombia() }) },
  { etiqueta: 'Este mes', calcular: rangoMesActual },
  {
    etiqueta: 'Mes anterior',
    calcular: () => ({ desde: primerDiaDelMes(hoyColombia(), 1), hasta: ultimoDiaDelMes(hoyColombia(), 1) }),
  },
];

/** Rango de fechas con atajos. Controlado: quien lo usa guarda el rango y recarga el reporte. */
export function SelectorRango({ rango, onCambio }: { rango: RangoFechas; onCambio: (rango: RangoFechas) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="rep-desde">Desde</Label>
        <Input
          id="rep-desde"
          type="date"
          value={rango.desde}
          max={rango.hasta}
          onChange={(e) => e.target.value && onCambio({ ...rango, desde: e.target.value })}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rep-hasta">Hasta</Label>
        <Input
          id="rep-hasta"
          type="date"
          value={rango.hasta}
          min={rango.desde}
          onChange={(e) => e.target.value && onCambio({ ...rango, hasta: e.target.value })}
          className="w-40"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button key={preset.etiqueta} type="button" variant="outline" size="sm" onClick={() => onCambio(preset.calcular())}>
            {preset.etiqueta}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function Kpi({ etiqueta, valor, ayuda, destacado }: { etiqueta: string; valor: string; ayuda?: string; destacado?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{etiqueta}</p>
      <p className={cn('mt-1 font-heading text-2xl font-extrabold', destacado && 'text-gold')}>{valor}</p>
      {ayuda && <p className="mt-1 text-xs text-text-muted">{ayuda}</p>}
    </Card>
  );
}

/** Estados de carga / error / contenido de un reporte, para no repetirlos en cada panel. */
export function CuerpoReporte({
  cargando,
  error,
  vacio,
  children,
}: {
  cargando: boolean;
  error: string | null;
  vacio?: boolean;
  children: ReactNode;
}) {
  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Cargando reporte...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-error-text/40 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
        {error}
      </div>
    );
  }
  if (vacio) return <p className="py-10 text-center text-sm text-text-muted">No hay datos para este reporte.</p>;
  return <div className="space-y-4">{children}</div>;
}

export function BotonExportar({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      Exportar a Excel (CSV)
    </Button>
  );
}

export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-heading text-lg font-bold">{children}</h3>
      {accion}
    </div>
  );
}
