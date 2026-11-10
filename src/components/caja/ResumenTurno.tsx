import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import type { TurnoCaja } from '@/types/caja';

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={fuerte ? 'flex justify-between font-semibold text-navy' : 'flex justify-between text-navy'}>
      <span className={fuerte ? '' : 'text-text-muted'}>{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

/**
 * Cómo se arma el efectivo del turno: base + entradas − salidas. Sirve tanto para el turno en
 * curso (totales en vivo) como para uno cerrado (totales congelados al cierre). Si los totales
 * no están disponibles (conteo a ciegas) solo se muestra la base.
 */
export function ResumenTurno({ turno }: { turno: TurnoCaja }) {
  const totales = turno.totales;

  return (
    <div className="space-y-2 text-sm">
      <Fila etiqueta="Base inicial" valor={formatoMoneda.format(turno.baseInicial)} />

      {totales && (
        <>
          <Fila etiqueta="+ Ventas en efectivo" valor={formatoMoneda.format(totales.ventasEfectivo)} />
          <Fila etiqueta="+ Abonos de fiado" valor={formatoMoneda.format(totales.abonosFiadoEfectivo)} />
          <Fila etiqueta="− Pagos a proveedores" valor={formatoMoneda.format(totales.pagosProveedorEfectivo)} />
          {totales.pagosNominaEfectivo > 0 && (
            <Fila etiqueta="− Pagos de nómina" valor={formatoMoneda.format(totales.pagosNominaEfectivo)} />
          )}
          {totales.retirosEfectivo > 0 && (
            <Fila etiqueta="− Retiros de efectivo" valor={formatoMoneda.format(totales.retirosEfectivo)} />
          )}
          {turno.efectivoEsperado !== null && (
            <div className="border-t border-border pt-2">
              <Fila etiqueta="Esperado en caja" valor={formatoMoneda.format(turno.efectivoEsperado)} fuerte />
            </div>
          )}

          <div className="mt-3 space-y-1 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Para conciliar (no entra al efectivo)
            </p>
            <Fila etiqueta="Transferencias" valor={formatoMoneda.format(totales.transferencias)} />
            <Fila etiqueta="Tarjeta" valor={formatoMoneda.format(totales.tarjeta)} />
          </div>
        </>
      )}
    </div>
  );
}

/** Resultado de un turno cerrado: contado vs esperado, diferencia, nota y detalle del conteo. */
interface ResumenCierreProps {
  turno: TurnoCaja;
  /** Si se pasa, la nota se puede editar (lo único editable de un cierre). Debe lanzar si falla. */
  onGuardarNota?: (nota: string) => Promise<void>;
}

export function ResumenCierre({ turno, onGuardarNota }: ResumenCierreProps) {
  const diferencia = turno.diferencia ?? 0;
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorNota, setErrorNota] = useState<string | null>(null);

  function empezarEdicion() {
    setBorrador(turno.notaCierre ?? '');
    setErrorNota(null);
    setEditando(true);
  }

  async function guardar() {
    if (!onGuardarNota) return;
    setGuardando(true);
    setErrorNota(null);
    try {
      await onGuardarNota(borrador);
      setEditando(false);
    } catch (err) {
      setErrorNota(err instanceof Error ? err.message : 'No se pudo guardar la nota.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-text-muted">
        {turno.empleadoNombre} · {formatoFecha(turno.fechaApertura)}
        {turno.fechaCierre && ` → ${formatoFecha(turno.fechaCierre)}`}
        {turno.cerradoPorNombre && turno.cerradoPorNombre !== turno.empleadoNombre && (
          <> · cerrado por {turno.cerradoPorNombre}</>
        )}
      </div>

      <ResumenTurno turno={turno} />

      <div className="space-y-1 border-t border-border pt-3 text-sm">
        <Fila etiqueta="Contado" valor={formatoMoneda.format(turno.efectivoContado ?? 0)} />
        <Fila
          etiqueta={diferencia === 0 ? 'Cuadra' : diferencia < 0 ? 'Faltante' : 'Sobrante'}
          valor={formatoMoneda.format(diferencia)}
          fuerte
        />
      </div>

      {editando ? (
        <div className="space-y-2">
          <label htmlFor="nota-cierre-edicion" className="text-sm font-semibold text-navy">
            Nota{diferencia !== 0 ? ' (obligatoria por la diferencia)' : ''}
          </label>
          <textarea
            id="nota-cierre-edicion"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            maxLength={300}
            rows={3}
            autoFocus
            disabled={guardando}
            placeholder="Explica por qué sobró o faltó efectivo"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{borrador.length}/300</span>
          </div>
          {errorNota && <p className="text-sm text-error-text">{errorNota}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="gold" onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar nota
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        (turno.notaCierre || onGuardarNota) && (
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm text-navy">
              <p>
                <span className="font-semibold">Nota: </span>
                {turno.notaCierre ?? <span className="text-text-muted">Sin nota</span>}
              </p>
              {onGuardarNota && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={empezarEdicion}
                  aria-label="Editar nota"
                  title="Editar nota"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            {turno.notaActualizadaPorNombre && turno.notaActualizadaEn && (
              <p className="text-xs text-text-muted">
                Nota editada por {turno.notaActualizadaPorNombre} · {formatoFecha(turno.notaActualizadaEn)}
              </p>
            )}
          </div>
        )
      )}

      {turno.conteo && turno.conteo.length > 0 && (
        <div className="space-y-1 text-xs text-text-muted">
          <p className="font-semibold uppercase tracking-wide">Conteo</p>
          {turno.conteo.map((linea) => (
            <div key={linea.denominacion} className="flex justify-between tabular-nums">
              <span>
                {formatoMoneda.format(linea.denominacion)} × {linea.cantidad}
              </span>
              <span>{formatoMoneda.format(linea.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
