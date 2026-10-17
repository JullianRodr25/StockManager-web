import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, Loader2, Lock, Printer, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useCaja } from '@/context/CajaContext';
import { ApiError } from '@/services/api';
import {
  abrirTurno,
  cerrarTurno,
  forzarCierreTurno,
  obtenerHistorialTurnos,
  obtenerTurno,
} from '@/services/cajaService';
import { obtenerConfiguracion } from '@/services/configuracionService';
import { imprimirCierreCaja } from '@/services/impresionService';
import { formatoFecha, formatoMoneda } from '@/components/DetalleFacturaDialog';
import { FormularioCierre } from '@/components/caja/FormularioCierre';
import { ResumenCierre, ResumenTurno } from '@/components/caja/ResumenTurno';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CerrarTurnoRequest, TurnoCaja, TurnoCajaResumen } from '@/types/caja';
import type { ConfiguracionGeneral } from '@/types/configuracion';

const TAMANO_HISTORIAL = 20;

function mensajeDe(err: unknown, porDefecto: string): string {
  return err instanceof ApiError ? err.message : porDefecto;
}

export function Caja() {
  const { usuario, token } = useAuth();
  const { turno, cargando, establecerTurno, refrescar } = useCaja();
  const esAdmin = usuario?.rol === 'Admin';

  const [configuracion, setConfiguracion] = useState<ConfiguracionGeneral | null>(null);

  // Apertura
  const [baseInput, setBaseInput] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const [errorApertura, setErrorApertura] = useState<string | null>(null);

  // Cierre del turno propio
  const [cerrando, setCerrando] = useState(false);
  const [enviandoCierre, setEnviandoCierre] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [cierreReciente, setCierreReciente] = useState<TurnoCaja | null>(null);

  // Historial y detalle
  const [historial, setHistorial] = useState<TurnoCajaResumen[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<TurnoCaja | null>(null);
  const [cargandoDetalleId, setCargandoDetalleId] = useState<number | null>(null);

  // Cierre forzado por un Admin sobre el turno de otro empleado
  const [turnoParaForzar, setTurnoParaForzar] = useState<TurnoCaja | null>(null);
  const [forzando, setForzando] = useState(false);
  const [errorForzar, setErrorForzar] = useState<string | null>(null);

  // Al entrar se vuelve a consultar el turno: los totales cambian con cada venta y el que quedó
  // en el contexto puede estar desactualizado.
  useEffect(() => {
    refrescar();
  }, [refrescar]);

  useEffect(() => {
    obtenerConfiguracion(token)
      .then(setConfiguracion)
      .catch(() => {
        // Sin configuración solo se pierde el poder imprimir el ticket.
      });
  }, [token]);

  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    setErrorHistorial(null);
    try {
      const respuesta = await obtenerHistorialTurnos(1, TAMANO_HISTORIAL, token);
      setHistorial(respuesta.data);
    } catch (err) {
      setErrorHistorial(mensajeDe(err, 'No se pudo cargar el historial de cajas.'));
    } finally {
      setCargandoHistorial(false);
    }
  }, [token]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  async function handleAbrir(e: FormEvent) {
    e.preventDefault();
    const base = baseInput.trim() === '' ? 0 : Number(baseInput);
    if (!Number.isFinite(base) || base < 0) {
      setErrorApertura('La base debe ser un valor mayor o igual a 0.');
      return;
    }

    setAbriendo(true);
    setErrorApertura(null);
    try {
      const nuevo = await abrirTurno({ baseInicial: base }, token);
      establecerTurno(nuevo);
      setBaseInput('');
      setCierreReciente(null);
      toast.success('Caja abierta');
      cargarHistorial();
    } catch (err) {
      setErrorApertura(mensajeDe(err, 'No se pudo abrir la caja.'));
    } finally {
      setAbriendo(false);
    }
  }

  async function handleCerrar(request: CerrarTurnoRequest) {
    setEnviandoCierre(true);
    setErrorCierre(null);
    try {
      const cierre = await cerrarTurno(request, token);
      establecerTurno(null);
      setCerrando(false);
      setCierreReciente(cierre);
      toast.success('Caja cerrada');
      cargarHistorial();
    } catch (err) {
      setErrorCierre(mensajeDe(err, 'No se pudo cerrar la caja.'));
    } finally {
      setEnviandoCierre(false);
    }
  }

  async function handleForzarCierre(request: CerrarTurnoRequest) {
    if (!turnoParaForzar) return;
    setForzando(true);
    setErrorForzar(null);
    try {
      const cierre = await forzarCierreTurno(turnoParaForzar.id, request, token);
      setTurnoParaForzar(null);
      setDetalle(cierre);
      toast.success('Turno cerrado');
      cargarHistorial();
    } catch (err) {
      setErrorForzar(mensajeDe(err, 'No se pudo cerrar el turno.'));
    } finally {
      setForzando(false);
    }
  }

  async function handleVerTurno(resumen: TurnoCajaResumen) {
    setCargandoDetalleId(resumen.id);
    try {
      setDetalle(await obtenerTurno(resumen.id, token));
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo cargar el turno.'));
    } finally {
      setCargandoDetalleId(null);
    }
  }

  async function handleImprimir(cierre: TurnoCaja) {
    const impresora = configuracion?.nombreImpresoraTickets;
    if (!impresora) {
      toast.error('Configura el nombre de la impresora en Configuración para imprimir.');
      return;
    }
    try {
      await imprimirCierreCaja(cierre, configuracion?.nombreEmpresa ?? null, impresora);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo imprimir el cierre.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-navy">Caja</h2>
        <p className="text-sm text-text-muted">
          Abre tu turno con la base, y al terminar cuenta el efectivo para cerrar la caja.
        </p>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          Cargando tu caja...
        </div>
      ) : turno ? (
        <Card className="max-w-xl border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-navy">
              <Wallet className="h-5 w-5" />
              {cerrando ? 'Cerrar caja' : 'Turno en curso'}
              {!cerrando && <Badge variant="outline">Abierto</Badge>}
            </CardTitle>
            <CardDescription>
              {turno.empleadoNombre} · abierto el {formatoFecha(turno.fechaApertura)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cerrando ? (
              <FormularioCierre
                turno={turno}
                enviando={enviandoCierre}
                error={errorCierre}
                onConfirmar={handleCerrar}
                onCancelar={() => {
                  setCerrando(false);
                  setErrorCierre(null);
                }}
              />
            ) : (
              <>
                {turno.esperadoVisible ? (
                  <ResumenTurno turno={turno} />
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-navy">
                      <span className="text-text-muted">Base inicial</span>
                      <span className="tabular-nums">{formatoMoneda.format(turno.baseInicial)}</span>
                    </div>
                    <p className="flex items-center gap-2 text-xs text-text-muted">
                      <Lock className="h-3.5 w-3.5" />
                      Conteo a ciegas: los totales se muestran al cerrar la caja.
                    </p>
                  </div>
                )}
                <Button type="button" variant="gold" onClick={() => setCerrando(true)}>
                  Cerrar caja
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {cierreReciente && (
            <Card className="max-w-xl border-border">
              <CardHeader>
                <CardTitle className="text-navy">Caja cerrada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ResumenCierre turno={cierreReciente} />
                <div className="flex gap-2">
                  <Button type="button" variant="gold" onClick={() => handleImprimir(cierreReciente)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir cierre
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCierreReciente(null)}>
                    Listo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="max-w-xl border-border">
            <CardHeader>
              <CardTitle className="text-navy">Abrir caja</CardTitle>
              <CardDescription>
                Indica el efectivo con el que arrancas (la base). Sin caja abierta no se pueden recibir pagos en
                efectivo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAbrir} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="baseInicial">Base inicial</Label>
                  <Input
                    id="baseInicial"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={baseInput}
                    onChange={(e) => setBaseInput(e.target.value)}
                    disabled={abriendo}
                    className="sin-flechas max-w-xs"
                  />
                </div>

                {errorApertura && (
                  <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                    {errorApertura}
                  </div>
                )}

                <Button type="submit" variant="gold" disabled={abriendo}>
                  {abriendo ? 'Abriendo...' : 'Abrir caja'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-navy">Historial de cajas</CardTitle>
          <CardDescription>
            {esAdmin ? 'Turnos de todos los empleados.' : 'Tus turnos anteriores.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargandoHistorial ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Cargando historial...
            </div>
          ) : errorHistorial ? (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {errorHistorial}
            </div>
          ) : historial.length === 0 ? (
            <p className="text-sm text-text-muted">Todavía no hay turnos registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-navy">{t.empleadoNombre}</TableCell>
                    <TableCell className="text-navy">{formatoFecha(t.fechaApertura)}</TableCell>
                    <TableCell className="text-navy">
                      {t.fechaCierre ? formatoFecha(t.fechaCierre) : <Badge variant="outline">Abierto</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-navy">
                      {t.efectivoContado !== null ? formatoMoneda.format(t.efectivoContado) : '—'}
                    </TableCell>
                    <TableCell
                      className={
                        t.diferencia
                          ? 'text-right tabular-nums text-error-text'
                          : 'text-right tabular-nums text-navy'
                      }
                    >
                      {t.diferencia !== null ? formatoMoneda.format(t.diferencia) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.estado === 'Cerrado' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerTurno(t)}
                          disabled={cargandoDetalleId === t.id}
                          aria-label={`Ver cierre de ${t.empleadoNombre}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        esAdmin &&
                        t.empleadoId !== Number(usuario?.id) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                setErrorForzar(null);
                                setTurnoParaForzar(await obtenerTurno(t.id, token));
                              } catch (err) {
                                toast.error(mensajeDe(err, 'No se pudo cargar el turno.'));
                              }
                            }}
                          >
                            Forzar cierre
                          </Button>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detalle !== null} onOpenChange={(abierto) => !abierto && setDetalle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cierre de caja</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4">
              <ResumenCierre turno={detalle} />
              <Button type="button" variant="gold" onClick={() => handleImprimir(detalle)}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir cierre
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={turnoParaForzar !== null} onOpenChange={(abierto) => !abierto && setTurnoParaForzar(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cerrar turno de {turnoParaForzar?.empleadoNombre}</DialogTitle>
          </DialogHeader>
          {turnoParaForzar && (
            <FormularioCierre
              turno={turnoParaForzar}
              enviando={forzando}
              error={errorForzar}
              onConfirmar={handleForzarCierre}
              onCancelar={() => setTurnoParaForzar(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
