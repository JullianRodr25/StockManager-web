import { useCallback, useEffect, useState } from 'react';
import { Loader2, Printer, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { generarEtiquetas, obtenerEtiquetasPendientes } from '@/services/inventarioService';
import type { EtiquetaGenerada, EtiquetaPendiente } from '@/types/inventario';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

export function EtiquetasPendientes() {
  const { token } = useAuth();

  const [pendientes, setPendientes] = useState<EtiquetaPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);
  const [etiquetasGeneradas, setEtiquetasGeneradas] = useState<EtiquetaGenerada[] | null>(null);

  const cargarPendientes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await obtenerEtiquetasPendientes(token);
      setPendientes(respuesta.etiquetas);
      setSeleccionados(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las etiquetas pendientes.');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  function alternarSeleccion(productoId: number, marcado: boolean) {
    setSeleccionados((previo) => {
      const nuevo = new Set(previo);
      if (marcado) {
        nuevo.add(productoId);
      } else {
        nuevo.delete(productoId);
      }
      return nuevo;
    });
  }

  function alternarSeleccionTodos(marcado: boolean) {
    setSeleccionados(marcado ? new Set(pendientes.map((p) => p.productoId)) : new Set());
  }

  const todosSeleccionados = pendientes.length > 0 && seleccionados.size === pendientes.length;

  async function handleGenerarEtiquetas() {
    if (seleccionados.size === 0) return;

    setGenerando(true);
    setErrorGenerar(null);
    try {
      const respuesta = await generarEtiquetas(Array.from(seleccionados), token);
      setEtiquetasGeneradas(respuesta.etiquetas);
      toast.success(`${respuesta.total} etiqueta(s) generada(s) correctamente`);
      await cargarPendientes();
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudieron generar las etiquetas.';
      setErrorGenerar(mensaje);
      toast.error(mensaje);
    } finally {
      setGenerando(false);
    }
  }

  function handleImprimir() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-navy">Etiquetas pendientes</CardTitle>
          <Button variant="gold" disabled={seleccionados.size === 0 || generando} onClick={handleGenerarEtiquetas}>
            {generando ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Tag className="h-4 w-4" />
            )}
            Generar etiquetas seleccionadas
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {error}
            </div>
          )}

          {cargando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted motion-reduce:animate-none" />
            </div>
          ) : pendientes.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              No hay productos con etiquetas pendientes por generar.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              <div className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  checked={todosSeleccionados}
                  onCheckedChange={(marcado) => alternarSeleccionTodos(marcado === true)}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Seleccionar todos ({pendientes.length})
                </span>
              </div>
              {pendientes.map((producto) => (
                <label
                  key={producto.productoId}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-background/60"
                >
                  <Checkbox
                    checked={seleccionados.has(producto.productoId)}
                    onCheckedChange={(marcado) => alternarSeleccion(producto.productoId, marcado === true)}
                  />
                  <span className="flex-1 text-sm text-navy">{producto.nombre}</span>
                  <span className="text-xs text-text-muted">{producto.codigoBarras}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {errorGenerar && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {errorGenerar}
        </div>
      )}

      {etiquetasGeneradas && etiquetasGeneradas.length > 0 && (
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-navy">Etiquetas generadas</CardTitle>
            <Button variant="outline" onClick={handleImprimir}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </CardHeader>
          <CardContent>
            <div id="etiquetas-para-imprimir" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {etiquetasGeneradas.map((etiqueta) => (
                <div
                  key={etiqueta.productoId}
                  className="flex flex-col items-center gap-2 rounded-md border border-border p-3"
                >
                  <img
                    src={`data:image/png;base64,${etiqueta.imagenBase64}`}
                    alt={`Etiqueta código de barras ${etiqueta.codigoBarras}`}
                    className="h-auto w-full"
                  />
                  <span className="text-xs text-text-muted">{etiqueta.codigoBarras}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
