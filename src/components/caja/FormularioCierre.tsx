import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatoMoneda } from '@/components/DetalleFacturaDialog';
import { ConteoEfectivo } from '@/components/caja/ConteoEfectivo';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { calcularContado, cantidadNumerica, GRUPOS_DENOMINACIONES } from '@/utils/denominaciones';
import type { CantidadesPorDenominacion } from '@/utils/denominaciones';
import type { CerrarTurnoRequest, TurnoCaja } from '@/types/caja';

interface FormularioCierreProps {
  turno: TurnoCaja;
  enviando: boolean;
  error: string | null;
  onConfirmar: (request: CerrarTurnoRequest) => void;
  onCancelar: () => void;
}

/**
 * Cierre del turno: conteo del efectivo y nota. Si el conteo es a ciegas (turno.esperadoVisible
 * es false) no se muestra el esperado ni la diferencia hasta que el turno queda cerrado; el
 * servidor es quien exige la nota cuando hay diferencia.
 */
export function FormularioCierre({ turno, enviando, error, onConfirmar, onCancelar }: FormularioCierreProps) {
  const [cantidades, setCantidades] = useState<CantidadesPorDenominacion>({});
  const [nota, setNota] = useState('');

  const contado = calcularContado(cantidades);
  const esperado = turno.esperadoVisible ? turno.efectivoEsperado : null;
  const diferencia = esperado !== null ? contado - esperado : null;

  function confirmar() {
    const conteo = GRUPOS_DENOMINACIONES.flatMap((g) => g.denominaciones)
      .map(({ valor }) => ({ denominacion: valor, cantidad: cantidadNumerica(cantidades[valor]) }))
      .filter((linea) => linea.cantidad > 0);

    onConfirmar({ conteo, nota: nota.trim() === '' ? null : nota.trim() });
  }

  return (
    <div className="space-y-5">
      <ConteoEfectivo
        cantidades={cantidades}
        onCambiarCantidad={(den, texto) => setCantidades((previo) => ({ ...previo, [den]: texto }))}
        deshabilitado={enviando}
      />

      {esperado !== null && diferencia !== null && (
        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Esperado</span>
            <span className="tabular-nums text-navy">{formatoMoneda.format(esperado)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-navy">
              {diferencia === 0 ? 'Cuadra' : diferencia < 0 ? 'Faltante' : 'Sobrante'}
            </span>
            <span
              className={
                diferencia === 0 ? 'tabular-nums text-navy' : 'tabular-nums text-error-text'
              }
            >
              {formatoMoneda.format(diferencia)}
            </span>
          </div>
        </div>
      )}

      {!turno.esperadoVisible && (
        <p className="text-xs text-text-muted">
          Conteo a ciegas: el esperado y la diferencia se muestran al cerrar la caja.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="notaCierre">
          Nota{diferencia !== null && diferencia !== 0 ? ' (obligatoria por la diferencia)' : ''}
        </Label>
        <textarea
          id="notaCierre"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={300}
          rows={2}
          disabled={enviando}
          placeholder="Si hay diferencia, explica qué pasó"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar} disabled={enviando}>
          Volver
        </Button>
        <Button type="button" variant="gold" onClick={confirmar} disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
              Cerrando...
            </>
          ) : (
            'Cerrar caja'
          )}
        </Button>
      </div>
    </div>
  );
}
