import { useAuth } from '@/context/AuthContext';
import { useReporte } from '@/hooks/useReporte';
import { obtenerReporteCartera } from '@/services/reporteService';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descargarCsv } from '@/utils/csv';
import { hoyColombia } from '@/utils/fechas';
import { BotonExportar, CuerpoReporte, Kpi, TituloSeccion } from './comun';

export function ReporteCartera() {
  const { token } = useAuth();
  const { datos, cargando, error } = useReporte(() => obtenerReporteCartera(token), [token]);

  function exportarPorCobrar() {
    if (!datos) return;
    descargarCsv(
      `por_cobrar_${hoyColombia()}.csv`,
      ['Venta', 'Cliente', 'Días abierta', 'Total', 'Saldo'],
      datos.porCobrar.map((c) => [c.ventaId, c.cliente, c.diasAbierta, c.total, c.saldo])
    );
  }

  function exportarPorPagar() {
    if (!datos) return;
    descargarCsv(
      `por_pagar_${hoyColombia()}.csv`,
      ['Proveedor', 'Cuentas', 'Saldo', 'Saldo vencido'],
      datos.porPagar.map((p) => [p.proveedor, p.cuentas, p.saldo, p.saldoVencido])
    );
  }

  return (
    <CuerpoReporte cargando={cargando} error={error} vacio={!datos}>
      {datos && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi etiqueta="Por cobrar (clientes)" valor={formatoMoneda.format(datos.totalPorCobrar)} destacado />
            <Kpi etiqueta="Por pagar (proveedores)" valor={formatoMoneda.format(datos.totalPorPagar)} />
            <Kpi
              etiqueta="Vencido por pagar"
              valor={formatoMoneda.format(datos.totalVencidoPorPagar)}
              ayuda={datos.totalVencidoPorPagar > 0 ? 'Requiere atención' : 'Al día'}
            />
          </div>

          <Card className="space-y-3 p-4">
            <TituloSeccion accion={<BotonExportar onClick={exportarPorCobrar} disabled={datos.porCobrar.length === 0} />}>
              Cuentas por cobrar
            </TituloSeccion>
            <div className="grid gap-2 sm:grid-cols-3">
              {datos.antiguedadPorCobrar.map((r) => (
                <div key={r.rango} className="rounded-xl border border-border bg-navy/5 px-3 py-2">
                  <p className="text-xs text-text-muted">{r.rango}</p>
                  <p className="font-heading text-lg font-bold">{formatoMoneda.format(r.saldo)}</p>
                  <p className="text-xs text-text-muted">{r.cuentas} cuenta(s)</p>
                </div>
              ))}
            </div>
            {datos.porCobrar.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">No hay cuentas abiertas con saldo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Días abierta</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.porCobrar.map((c) => (
                    <TableRow key={c.ventaId}>
                      <TableCell className="font-medium">{c.cliente}</TableCell>
                      <TableCell className={`text-right tabular-nums ${c.diasAbierta > 30 ? 'text-error-text' : ''}`}>
                        {c.diasAbierta}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda.format(c.total)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatoMoneda.format(c.saldo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <TituloSeccion accion={<BotonExportar onClick={exportarPorPagar} disabled={datos.porPagar.length === 0} />}>
              Saldos por proveedor
            </TituloSeccion>
            {datos.porPagar.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">No hay cuentas por pagar pendientes.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Cuentas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.porPagar.map((p) => (
                    <TableRow key={p.proveedorId}>
                      <TableCell className="font-medium">{p.proveedor}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.cuentas}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMoneda.format(p.saldo)}</TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${p.saldoVencido > 0 ? 'text-error-text' : ''}`}
                      >
                        {formatoMoneda.format(p.saldoVencido)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </CuerpoReporte>
  );
}
