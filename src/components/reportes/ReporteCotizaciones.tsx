import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useReporte } from '@/hooks/useReporte';
import { obtenerReporteCotizaciones } from '@/services/cotizacionService';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descargarCsv } from '@/utils/csv';
import { etiquetaDia, rangoMesActual } from '@/utils/fechas';
import type { RangoFechas } from '@/utils/fechas';
import { BotonExportar, CuerpoReporte, Kpi, SelectorRango, TituloSeccion } from './comun';

const porcentaje = (v: number) => `${(v * 100).toFixed(1)} %`;

/** Cuánto se cotizó, cuánto se convirtió en venta y cómo rinde cada vendedor. */
export function ReporteCotizaciones() {
  const { token } = useAuth();
  const [rango, setRango] = useState<RangoFechas>(rangoMesActual);
  const { datos, cargando, error } = useReporte(
    () => obtenerReporteCotizaciones(rango.desde, rango.hasta, token),
    [rango.desde, rango.hasta, token]
  );

  function exportar() {
    if (!datos) return;
    descargarCsv(
      `cotizaciones_${rango.desde}_${rango.hasta}.csv`,
      ['Número', 'Cliente', 'Vendedor', 'Fecha', 'Válida hasta', 'Estado', 'Líneas', 'Total'],
      datos.cotizaciones.map((c) => [
        c.numero,
        c.nombreCliente ?? '',
        c.empleadoNombre,
        c.fecha.slice(0, 10),
        c.fechaVencimiento,
        c.estado,
        c.cantidadLineas,
        c.total,
      ])
    );
  }

  return (
    <div className="space-y-4">
      <SelectorRango rango={rango} onCambio={setRango} />
      <CuerpoReporte cargando={cargando} error={error} vacio={!datos}>
        {datos && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi etiqueta="Cotizaciones" valor={String(datos.cantidad)} />
              <Kpi etiqueta="Valor cotizado" valor={formatoMoneda.format(datos.valorCotizado)} />
              <Kpi etiqueta="Valor convertido" valor={formatoMoneda.format(datos.valorConvertido)} destacado />
              <Kpi
                etiqueta="Tasa de conversión"
                valor={porcentaje(datos.tasaConversionCantidad)}
                ayuda={`${porcentaje(datos.tasaConversionValor)} del valor (sin contar anuladas)`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-3 p-4">
                <TituloSeccion>Por estado</TituloSeccion>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.porEstado.map((e) => (
                      <TableRow key={e.estado}>
                        <TableCell>{e.estado}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.cantidad}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatoMoneda.format(e.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="space-y-3 p-4">
                <TituloSeccion>Por vendedor</TituloSeccion>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Cotiz.</TableHead>
                      <TableHead className="text-right">Convert.</TableHead>
                      <TableHead className="text-right">Valor convertido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.porEmpleado.map((e) => (
                      <TableRow key={e.empleadoId}>
                        <TableCell>{e.empleado}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.cantidad}</TableCell>
                        <TableCell className="text-right tabular-nums">{e.convertidas}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatoMoneda.format(e.valorConvertido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            <Card className="space-y-3 p-4">
              <TituloSeccion accion={<BotonExportar onClick={exportar} disabled={datos.cotizaciones.length === 0} />}>
                Detalle
              </TituloSeccion>
              {datos.cotizaciones.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No hay cotizaciones en este rango.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N.°</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Válida hasta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datos.cotizaciones.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero}</TableCell>
                        <TableCell>{c.nombreCliente ?? '—'}</TableCell>
                        <TableCell>{c.empleadoNombre}</TableCell>
                        <TableCell>{etiquetaDia(c.fechaVencimiento)}</TableCell>
                        <TableCell>
                          <Badge variant={c.estado === 'Convertida' ? 'gold' : 'outline'}>{c.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatoMoneda.format(c.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )}
      </CuerpoReporte>
    </div>
  );
}
