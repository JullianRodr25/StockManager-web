import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, CreditCard, Package, ShoppingBag, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  obtenerConteoNoLeidas,
  obtenerNotificaciones,
} from '@/services/notificacionService';
import type { NotificacionInterna } from '@/types/notificaciones';

// Cada cuánto se refresca el conteo del badge en segundo plano (aunque la campana esté
// cerrada), para que un empleado que deja la pestaña abierta vea alertas nuevas sin recargar.
const INTERVALO_REFRESCO_MS = 60_000;

const ICONOS_POR_TIPO: Record<NotificacionInterna['tipo'], typeof Package> = {
  StockBajo: Package,
  PedidoNuevo: ShoppingBag,
  CuentaPorPagarProximaAVencer: CreditCard,
};

// A dónde navega el botón "Ir a ver", según la entidad de negocio que originó la notificación.
function rutaParaNotificacion(notificacion: NotificacionInterna): string {
  switch (notificacion.entidadTipo) {
    case 'Producto':
      return '/inventario';
    case 'Pedido':
      return '/pedidos';
    case 'CuentaPorPagar':
      return '/proveedores/cuentas-por-pagar';
    default:
      return '/';
  }
}

function formatearFechaRelativa(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  const segundos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 1000));

  if (segundos < 60) return 'hace un momento';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export function NotificacionesBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [abierta, setAbierta] = useState(false);
  const [notificaciones, setNotificaciones] = useState<NotificacionInterna[]>([]);
  const [conteo, setConteo] = useState(0);
  const [cargando, setCargando] = useState(false);

  const refrescarConteo = useCallback(async () => {
    try {
      setConteo(await obtenerConteoNoLeidas(token));
    } catch {
      // Fallo silencioso: el badge simplemente no se actualiza en este ciclo, no es
      // suficientemente importante como para molestar al usuario con un toast.
    }
  }, [token]);

  useEffect(() => {
    refrescarConteo();
    const intervalo = setInterval(refrescarConteo, INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [refrescarConteo]);

  const cargarNotificaciones = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await obtenerNotificaciones(token, true, 20);
      setNotificaciones(datos);
    } catch {
      toast.error('No se pudieron cargar las notificaciones.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    if (abierta) {
      cargarNotificaciones();
    }
  }, [abierta, cargarNotificaciones]);

  async function cerrarNotificacion(id: number) {
    // Optimista: la quitamos de la lista de inmediato: es lo que espera el usuario al
    // presionar "cerrar por el momento", y si la llamada falla igual queda marcada leída
    // en el próximo refresco (no vale la pena revertir la UI por esto).
    setNotificaciones((actuales) => actuales.filter((n) => n.id !== id));
    setConteo((actual) => Math.max(0, actual - 1));
    try {
      await marcarNotificacionLeida(id, token);
    } catch {
      toast.error('No se pudo cerrar la notificación.');
      cargarNotificaciones();
      refrescarConteo();
    }
  }

  async function irAVer(notificacion: NotificacionInterna) {
    setAbierta(false);
    navigate(rutaParaNotificacion(notificacion));
    // Ir a revisar el origen de la notificación cuenta como atenderla, igual que cerrarla.
    setNotificaciones((actuales) => actuales.filter((n) => n.id !== notificacion.id));
    setConteo((actual) => Math.max(0, actual - 1));
    try {
      await marcarNotificacionLeida(notificacion.id, token);
    } catch {
      // La navegación ya ocurrió; si falla el marcado, el próximo refresco la vuelve a traer.
    }
  }

  async function marcarTodas() {
    const idsActuales = notificaciones.map((n) => n.id);
    setNotificaciones([]);
    setConteo(0);
    try {
      await marcarTodasLeidas(token);
    } catch {
      toast.error('No se pudieron marcar todas como leídas.');
      cargarNotificaciones();
      refrescarConteo();
    }
    void idsActuales;
  }

  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5 text-navy" />
            <span className="sr-only">Notificaciones</span>
          </Button>
          {conteo > 0 && (
            <Badge
              variant="destructive"
              className="pointer-events-none absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[0.65rem]"
            >
              {conteo > 9 ? '9+' : conteo}
            </Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-semibold text-navy">Notificaciones</h2>
          {notificaciones.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={marcarTodas}>
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas leídas
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {cargando && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Cargando...</p>
          )}

          {!cargando && notificaciones.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              No tienes notificaciones pendientes.
            </p>
          )}

          {!cargando &&
            notificaciones.map((notificacion) => {
              const Icono = ICONOS_POR_TIPO[notificacion.tipo] ?? Bell;
              return (
                <div
                  key={notificacion.id}
                  className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-background"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-navy">
                    <Icono className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy">{notificacion.titulo}</p>
                    <p className="mt-0.5 text-sm text-text-muted">{notificacion.mensaje}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        {formatearFechaRelativa(notificacion.fechaCreacion)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => irAVer(notificacion)}
                        >
                          Ir a ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => cerrarNotificacion(notificacion.id)}
                          aria-label="Cerrar por el momento"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
