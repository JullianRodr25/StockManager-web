import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useReporte } from '@/hooks/useReporte';
import { obtenerReporteVentas } from '@/services/reporteService';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descargarCsv } from '@/utils/csv';
import { etiquetaDia, rangoMesActual } from '@/utils/fechas';
import type { RangoFechas } from '@/utils/fechas';

import { BotonExportar, CuerpoReporte, Kpi, SelectorRango, TituloSeccion } from './comun';

export function ReporteVentas() {
  const { token } = useAuth();
  const [rango, setRango] = useState<RangoFechas>(rangoMesActual);
  const { datos, cargando, error } = useReporte(
    () => obtenerReporteVentas(rango.desde, rango.hasta, token),
    [rango.desde, rango.hasta, token]
  );

  const maximoDia = Math.max(...(datos?.porDia.map((d) => d.total) ?? [0]), 1);

  function exportar() {
    if (!datos) return;
    descargarCsv(
      `ventas_${datos.desde}_a_${datos.hasta}.csv`,
      ['Día', 'Ventas', 'Total'],
      datos.porDia.map((d) => [d.dia, d.cantidad, d.total])
    );
  }

  return (
    <div className="space-y-4">
      <SelectorRango rango={rango} onCambio={setRango} />
      <CuerpoReporte cargando={cargando} error={error} vacio={!datos}>
        {datos && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi etiqueta="Total vendido" valor={formatoMoneda.format(datos.totalVendido)} destacado />
              <Kpi etiqueta="Ventas" valor={String(datos.cantidadVentas)} />
              <Kpi etiqueta="Ticket promedio" valor={formatoMoneda.format(datos.ticketPromedio)} />
              <Kpi
                etiqueta="Abonos recibidos"
                valor={formatoMoneda.format(datos.abonosRecibidos)}
                ayuda="Cobros a cuentas abiertas en el rango"
              />
            </div>

            <Card className="space-y-3 p-4">
              <TituloSeccion accion={<BotonExportar onClick={exportar} disabled={datos.porDia.length === 0} />}>
                Ventas por día
              </TituloSeccion>
              {datos.porDia.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">Sin ventas en este rango.</p>
              ) : (
                <ul className="space-y-1.5">
                  {datos.porDia.map((d) => (
                    <li key={d.dia} className="grid grid-cols-[4rem_1fr_9rem] items-center gap-3 text-sm">
                      <span className="text-text-muted">{etiquetaDia(d.dia)}</span>
                      <span className="h-3 overflow-hidden rounded-full bg-navy/10" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-gold"
                          style={{ width: `${Math.max((d.total / maximoDia) * 100, 2)}%` }}
                        />
                      </span>
                      <span className="text-right font-medium tabular-nums">
                        {formatoMoneda.format(d.total)} <span className="text-text-muted">({d.cantidad})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-3 p-4">
              <TituloSeccion>Por método de pago</TituloSeccion>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.porMetodo.map((m) => (
                    <TableRow key={m.metodo}>
                      <TableCell>{m.metodo}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.cantidad}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatoMoneda.format(m.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </CuerpoReporte>
    </div>
  );
}
