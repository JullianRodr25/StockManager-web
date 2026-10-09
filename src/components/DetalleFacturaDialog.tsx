import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useLogo } from '@/context/LogoContext';
import { PantallaCargaLogo } from '@/components/PantallaCargaLogo';
import { AvisoClienteIncompleto } from '@/components/AvisoClienteIncompleto';
import { obtenerConfiguracion } from '@/services/configuracionService';
import { obtenerDocumentoFacturaDeVenta } from '@/services/facturaService';
import { debeAbrirCajon, imprimirRecibo } from '@/services/impresionService';
import type { FacturaDocumento } from '@/types/facturaDocumento';
import type { VentaResponse } from '@/types/ventas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatoFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function nombreComprador(venta: { nombreComprador: string | null; clienteId: number | null }): string {
  if (venta.nombreComprador) return venta.nombreComprador;
  if (venta.clienteId) return `Cliente #${venta.clienteId}`;
  return '—';
}

export function BadgeEstado({ estado }: { estado: string }) {
  const normalizado = estado.trim().toLowerCase();
  if (normalizado === 'pagada') {
    return <Badge className="border-transparent bg-green/10 text-green">Pagada</Badge>;
  }
  if (normalizado === 'pendiente') {
    return <Badge className="border-transparent bg-gold/10 text-gold">Pendiente</Badge>;
  }
  if (normalizado === 'cancelada') {
    return <Badge className="border-transparent bg-error-bg text-error-text">Cancelada</Badge>;
  }
  return <Badge variant="outline">{estado}</Badge>;
}

interface DetalleFacturaDialogProps {
  venta: VentaResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetalleFacturaDialog({ venta, open, onOpenChange }: DetalleFacturaDialogProps) {
  const { token } = useAuth();
  const { logoUrl } = useLogo();
  const [nombreImpresora, setNombreImpresora] = useState<string | null>(null);
  const [imprimiendoTiquete, setImprimiendoTiquete] = useState(false);
  const [documento, setDocumento] = useState<FacturaDocumento | null>(null);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);

  // Todo lo que se imprime (empresa, cliente, IVA por tarifa, pagos, textos legales) llega ya
  // armado del backend: la vista digital, el tiquete y el PDF muestran lo mismo.
  const ventaId = venta?.id ?? null;
  const cargarDocumento = useCallback(() => {
    if (ventaId === null) return;
    setErrorDocumento(null);
    obtenerDocumentoFacturaDeVenta(ventaId, token)
      .then(setDocumento)
      .catch(() => setErrorDocumento('No se pudieron cargar los datos de la factura.'));
  }, [ventaId, token]);

  useEffect(() => {
    if (!open) return;
    setDocumento(null);
    cargarDocumento();
  }, [open, cargarDocumento]);

  // Se consulta el nombre de la impresora configurada solo cuando el diálogo se abre, y solo
  // una vez: si no hay impresora configurada, el botón de tiquete físico no se muestra.
  useEffect(() => {
    if (!open || nombreImpresora !== null) return;
    obtenerConfiguracion(token)
      .then((config) => setNombreImpresora(config.nombreImpresoraTickets))
      .catch(() => {
        // Sin configuración simplemente no se ofrece el botón de impresión física.
      });
  }, [open, nombreImpresora, token]);

  function handleImprimir() {
    window.print();
  }

  async function handleImprimirTiquete() {
    if (!venta || !documento || !nombreImpresora) return;
    setImprimiendoTiquete(true);
    try {
      await imprimirRecibo(venta, documento, nombreImpresora);
      toast.success(
        debeAbrirCajon(venta) ? 'Tiquete enviado a la impresora y cajón abierto' : 'Tiquete enviado a la impresora'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir el tiquete.');
    } finally {
      setImprimiendoTiquete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de venta</DialogTitle>
        </DialogHeader>

        {!venta ? (
          <PantallaCargaLogo variante="en-linea" className="py-4" />
        ) : (
          <>
            <div id="factura-para-imprimir" className="space-y-5">
              {errorDocumento ? (
                <div className="space-y-2 rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                  <p>{errorDocumento}</p>
                  <Button type="button" variant="outline" size="sm" onClick={cargarDocumento}>
                    Reintentar
                  </Button>
                </div>
              ) : !documento ? (
                <PantallaCargaLogo variante="en-linea" className="py-4" />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                    <div className="flex items-start gap-3">
                      <img
                        src={logoUrl}
                        alt="Logo de la empresa"
                        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                      />
                      <div className="space-y-0.5 text-sm">
                        <p className="font-heading text-lg font-semibold text-navy">
                          {documento.emisor.nombre ?? 'Ferretería Gold'}
                        </p>
                        {documento.emisor.nit && <p className="text-text-muted">NIT {documento.emisor.nit}</p>}
                        {documento.emisor.responsabilidadIva && (
                          <p className="text-text-muted">{documento.emisor.responsabilidadIva}</p>
                        )}
                        {documento.emisor.actividadEconomica && (
                          <p className="text-text-muted">Actividad económica: {documento.emisor.actividadEconomica}</p>
                        )}
                        {(documento.emisor.direccion || documento.emisor.barrio || documento.emisor.ciudad) && (
                          <p className="text-text-muted">
                            {[documento.emisor.direccion, documento.emisor.barrio, documento.emisor.ciudad]
                              .filter(Boolean)
                              .join(' - ')}
                          </p>
                        )}
                        {(documento.emisor.telefono || documento.emisor.email) && (
                          <p className="text-text-muted">
                            {[documento.emisor.telefono && `Tel. ${documento.emisor.telefono}`, documento.emisor.email]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        {documento.emisor.resolucionDianTexto && (
                          <p className="text-xs text-text-muted">{documento.emisor.resolucionDianTexto}</p>
                        )}
                      </div>
                    </div>
                    <BadgeEstado estado={venta.estado} />
                  </div>

                  <AvisoClienteIncompleto comprador={documento.comprador} onCorregido={cargarDocumento} />

                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                    <div className="space-y-1.5">
                      <p>
                        <span className="text-text-muted">Factura: </span>
                        <span className="font-medium text-navy">{documento.numero}</span>
                      </p>
                      <p>
                        <span className="text-text-muted">Fecha: </span>
                        <span className="text-navy">{formatoFecha(documento.fecha)}</span>
                      </p>
                      {documento.vendedor && (
                        <p>
                          <span className="text-text-muted">Vendedor: </span>
                          <span className="text-navy">{documento.vendedor}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p>
                        <span className="text-text-muted">Cliente: </span>
                        <span className="text-navy">{documento.comprador.nombre}</span>
                      </p>
                      {documento.comprador.documento && (
                        <p>
                          <span className="text-text-muted">{documento.comprador.tipoDocumento ?? 'Documento'}: </span>
                          <span className="text-navy">{documento.comprador.documento}</span>
                        </p>
                      )}
                      {documento.comprador.direccion && (
                        <p>
                          <span className="text-text-muted">Dirección: </span>
                          <span className="text-navy">{documento.comprador.direccion}</span>
                        </p>
                      )}
                      {documento.comprador.telefono && (
                        <p>
                          <span className="text-text-muted">Teléfono: </span>
                          <span className="text-navy">{documento.comprador.telefono}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {venta.requiereFacturaElectronica && (
                    <div className="flex flex-col gap-1 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy">
                      <p className="font-semibold">
                        Factura electrónica solicitada
                        {venta.estadoFacturaElectronica === 'Pendiente' && ' — pendiente de envío a la DIAN'}
                        {venta.estadoFacturaElectronica === 'Transmitida' && ' — transmitida a la DIAN'}
                        {venta.estadoFacturaElectronica === 'Error' && ' — error al transmitir a la DIAN'}
                      </p>
                      {venta.emailFacturacion && <p className="text-text-muted">{venta.emailFacturacion}</p>}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cant.</TableHead>
                          <TableHead>Precio unit.</TableHead>
                          <TableHead>IVA</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documento.lineas.map((linea, indice) => (
                          <TableRow key={`${linea.producto}-${indice}`}>
                            <TableCell className="text-navy">{linea.producto}</TableCell>
                            <TableCell className="text-navy">{linea.cantidad}</TableCell>
                            <TableCell className="text-navy">{formatoMoneda.format(linea.precioUnitario)}</TableCell>
                            <TableCell className="text-navy">{linea.tarifaIva}%</TableCell>
                            <TableCell className="text-right font-medium text-navy">
                              {formatoMoneda.format(linea.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:justify-between">
                    <div className="space-y-1 text-sm">
                      {documento.pagos.length > 0 && (
                        <>
                          <p className="text-xs uppercase tracking-wide text-text-muted">Forma de pago</p>
                          {documento.pagos.map((pago) => (
                            <div key={pago.metodoPago} className="flex justify-between gap-6">
                              <span className="text-text-muted">{pago.metodoPago}</span>
                              <span className="text-navy">{formatoMoneda.format(pago.monto)}</span>
                            </div>
                          ))}
                        </>
                      )}
                      {documento.montoRecibido != null && (
                        <>
                          <div className="flex justify-between gap-6">
                            <span className="text-text-muted">Recibido</span>
                            <span className="text-navy">{formatoMoneda.format(documento.montoRecibido)}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-text-muted">Cambio</span>
                            <span className="text-navy">{formatoMoneda.format(documento.cambio ?? 0)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="w-full max-w-[240px] space-y-1.5 self-end text-right">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Subtotal</span>
                        <span className="text-navy">{formatoMoneda.format(documento.subtotalBase)}</span>
                      </div>
                      {documento.resumenIva
                        .filter((fila) => fila.tarifa > 0)
                        .map((fila) => (
                          <div key={fila.tarifa} className="flex justify-between text-sm">
                            <span className="text-text-muted">IVA {fila.tarifa}%</span>
                            <span className="text-navy">{formatoMoneda.format(fila.iva)}</span>
                          </div>
                        ))}
                      <div className="flex justify-between border-t border-border pt-1.5">
                        <span className="text-xs uppercase tracking-wide text-text-muted">Total</span>
                        <span className="text-xl font-bold text-navy">{formatoMoneda.format(documento.total)}</span>
                      </div>
                    </div>
                  </div>

                  {(documento.textoLegal || documento.politicaCambios) && (
                    <div className="space-y-1 border-t border-border pt-3 text-xs text-text-muted">
                      {documento.textoLegal && <p>{documento.textoLegal}</p>}
                      {documento.politicaCambios && <p>{documento.politicaCambios}</p>}
                    </div>
                  )}

                  <p className="text-center text-xs text-text-muted">
                    Gracias por su compra — {documento.emisor.nombre ?? 'Ferretería Gold'}
                  </p>
                </>
              )}
            </div>

            <DialogFooter>
              {nombreImpresora && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImprimirTiquete}
                  disabled={imprimiendoTiquete || !documento}
                >
                  {imprimiendoTiquete ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  {debeAbrirCajon(venta) ? 'Imprimir tiquete y abrir caja' : 'Imprimir tiquete'}
                </Button>
              )}
              <Button type="button" variant="gold" onClick={handleImprimir} disabled={!documento}>
                <Printer className="h-4 w-4" />
                Imprimir factura
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
