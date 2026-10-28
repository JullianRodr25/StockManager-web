import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
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
export function ResumenCierre({ turno }: { turno: TurnoCaja }) {
  const diferencia = turno.diferencia ?? 0;

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

      {turno.notaCierre && (
        <p className="rounded-md bg-muted/40 p-3 text-sm text-navy">
          <span className="font-semibold">Nota: </span>
          {turno.notaCierre}
        </p>
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
