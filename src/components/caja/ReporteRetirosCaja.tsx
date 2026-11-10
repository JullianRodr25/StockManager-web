import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useReporte } from '@/hooks/useReporte';
import { ApiError } from '@/services/api';
import { anularRetiro, obtenerReporteRetiros } from '@/services/cajaService';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import { BotonExportar, CuerpoReporte, Kpi, SelectorRango, TituloSeccion } from '@/components/reportes/comun';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descargarCsv } from '@/utils/csv';
import { etiquetaDia, rangoMesActual } from '@/utils/fechas';
import type { RangoFechas } from '@/utils/fechas';

interface ReporteRetirosCajaProps {
  esAdmin: boolean;
  /** Ids de los turnos todavía abiertos: solo esos retiros se pueden anular. */
  turnosAbiertos: number[];
  /** Cambia cuando algo afecta la caja (ej. se registró un retiro) para volver a consultar. */
  version: number;
  onCambio: () => void;
}

/** Cuánto efectivo se ha sacado de la caja, por día y retiro a retiro, en un rango de fechas. */
export function ReporteRetirosCaja({ esAdmin, turnosAbiertos, version, onCambio }: ReporteRetirosCajaProps) {
  const { token } = useAuth();
  const [rango, setRango] = useState<RangoFechas>(rangoMesActual);
  const [anulando, setAnulando] = useState<number | null>(null);
  const { datos, cargando, error } = useReporte(
    () => obtenerReporteRetiros(rango.desde, rango.hasta, token),
    [rango.desde, rango.hasta, token, version]
  );

  async function anular(id: number) {
    setAnulando(id);
    try {
      await anularRetiro(id, token);
      toast.success('Retiro anulado');
      onCambio();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo anular el retiro');
    } finally {
      setAnulando(null);
    }
  }

  function exportar() {
    if (!datos) return;
    descargarCsv(
      `retiros_caja_${datos.desde}_a_${datos.hasta}.csv`,
      ['Fecha', 'Empleado', 'Monto', 'Estado'],
      datos.retiros.map((r) => [formatoFecha(r.fecha), r.empleadoNombre, r.monto, r.anulado ? 'Anulado' : 'Vigente'])
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-navy">Retiros de caja</CardTitle>
        <CardDescription>Efectivo que se ha sacado de la caja. Fechas en hora de Colombia.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SelectorRango rango={rango} onCambio={setRango} />
        <CuerpoReporte cargando={cargando} error={error} vacio={!datos}>
          {datos && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Kpi etiqueta="Total retirado" valor={formatoMoneda.format(datos.totalRetirado)} destacado />
                <Kpi etiqueta="Retiros" valor={String(datos.cantidadRetiros)} />
              </div>

              {datos.porDia.length > 0 && (
                <div className="space-y-2">
                  <TituloSeccion>Por día</TituloSeccion>
                  <ul className="space-y-1 text-sm">
                    {datos.porDia.map((d) => (
                      <li key={d.fecha} className="flex justify-between">
                        <span className="text-text-muted">{etiquetaDia(d.fecha)}</span>
                        <span className="font-medium tabular-nums">
                          {formatoMoneda.format(d.total)} <span className="text-text-muted">({d.cantidad})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <TituloSeccion accion={<BotonExportar onClick={exportar} disabled={datos.retiros.length === 0} />}>
                  Detalle
                </TituloSeccion>
                {datos.retiros.length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-muted">Sin retiros en este rango.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Empleado</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {datos.retiros.map((r) => (
                        <TableRow key={r.id} className={r.anulado ? 'opacity-60' : undefined}>
                          <TableCell>{formatoFecha(r.fecha)}</TableCell>
                          <TableCell>{r.empleadoNombre}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={r.anulado ? 'line-through' : undefined}>{formatoMoneda.format(r.monto)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.anulado ? (
                              <Badge variant="outline">Anulado</Badge>
                            ) : (
                              esAdmin &&
                              turnosAbiertos.includes(r.turnoCajaId) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={anulando === r.id}
                                  onClick={() => anular(r.id)}
                                >
                                  Anular
                                </Button>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </CuerpoReporte>
      </CardContent>
    </Card>
  );
}
