import { useMemo, useState } from 'react';
import { ArrowDownUp, Loader2, Search, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TarjetaCuentaAbierta } from '@/components/TarjetaCuentaAbierta';
import type { VentaResumenResponse } from '@/types/ventas';

interface ListaCuentasAbiertasProps {
  cuentas: VentaResumenResponse[];
  cargando: boolean;
  error: string | null;
  /** Id de la cuenta que se está cargando (para bloquear las demás y mostrar el spinner). */
  cuentaCargandoId: number | null;
  nombreDeCuenta: (cuenta: VentaResumenResponse) => string;
  onContinuar: (cuenta: VentaResumenResponse) => void;
}

/** Lista filtrable de cuentas con saldo pendiente, las más antiguas primero por defecto. */
export function ListaCuentasAbiertas({
  cuentas,
  cargando,
  error,
  cuentaCargandoId,
  nombreDeCuenta,
  onContinuar,
}: ListaCuentasAbiertasProps) {
  const [filtro, setFiltro] = useState('');
  const [antiguasPrimero, setAntiguasPrimero] = useState(true);

  const visibles = useMemo(() => {
    const termino = filtro.trim().toLowerCase();
    const filtradas = termino
      ? cuentas.filter((cuenta) => nombreDeCuenta(cuenta).toLowerCase().includes(termino))
      : cuentas;
    return [...filtradas].sort((a, b) => {
      const diferencia = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      return antiguasPrimero ? diferencia : -diferencia;
    });
  }, [cuentas, filtro, antiguasPrimero, nombreDeCuenta]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Cargando cuentas abiertas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
        {error}
      </div>
    );
  }

  if (cuentas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
        <Wallet className="h-8 w-8 text-text-muted" aria-hidden="true" />
        <p className="font-medium text-navy">No hay cuentas abiertas</p>
        <p className="text-sm text-text-muted">Abre una cuenta desde el panel de la derecha para empezar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por nombre..."
            aria-label="Filtrar cuentas abiertas por nombre"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setAntiguasPrimero((valor) => !valor)}>
          <ArrowDownUp className="h-4 w-4" />
          {antiguasPrimero ? 'Más antiguas primero' : 'Más recientes primero'}
        </Button>
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">Ninguna cuenta coincide con "{filtro.trim()}".</p>
      ) : (
        visibles.map((cuenta) => (
          <TarjetaCuentaAbierta
            key={cuenta.id}
            cuenta={cuenta}
            nombre={nombreDeCuenta(cuenta)}
            cargando={cuentaCargandoId === cuenta.id}
            deshabilitada={cuentaCargandoId !== null}
            onContinuar={onContinuar}
          />
        ))
      )}
    </div>
  );
}
