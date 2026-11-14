import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { esCodigoMunicipioValido } from '@/utils/fiscal';

type Municipio = readonly [codigo: string, nombre: string, departamento: string];

const MAX_RESULTADOS = 8;

/** Minúsculas y sin tildes, para que "bogota" encuentre "Bogotá". */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

interface MunicipioDaneSelectProps {
  /** Código DANE elegido ('' si ninguno). */
  value: string;
  onChange: (codigo: string) => void;
  disabled?: boolean;
  id?: string;
}

/**
 * Elige el municipio y devuelve su código DANE. El catálogo se carga la primera vez que se usa.
 * Como el catálogo es una ayuda y podría estar incompleto, siempre queda la salida de escribir
 * el código de 5 dígitos a mano.
 */
export function MunicipioDaneSelect({ value, onChange, disabled, id }: MunicipioDaneSelectProps) {
  const [catalogo, setCatalogo] = useState<readonly Municipio[] | null>(null);
  const [termino, setTermino] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(-1);
  const [manual, setManual] = useState(false);

  // Se necesita el catálogo para listar y también para mostrar el nombre de un código ya guardado.
  useEffect(() => {
    if (catalogo !== null || (!abierto && !value)) return;
    let vigente = true;
    void import('@/data/municipiosDane').then((m) => vigente && setCatalogo(m.MUNICIPIOS_DANE));
    return () => {
      vigente = false;
    };
  }, [abierto, value, catalogo]);

  const seleccionado = useMemo(() => catalogo?.find((m) => m[0] === value) ?? null, [catalogo, value]);

  const resultados = useMemo(() => {
    if (!catalogo) return [];
    const consulta = normalizar(termino.trim());
    if (!consulta) return [];
    return catalogo
      .filter((m) => normalizar(m[1]).includes(consulta) || normalizar(m[2]).includes(consulta) || m[0].startsWith(consulta))
      .slice(0, MAX_RESULTADOS);
  }, [catalogo, termino]);

  function elegir(m: Municipio) {
    onChange(m[0]);
    setTermino('');
    setAbierto(false);
    setResaltado(-1);
  }

  if (value && !manual) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-navy">
        <span>
          {seleccionado ? (
            <>
              <span className="font-medium">{seleccionado[1]}</span>
              <span className="text-text-muted"> · {seleccionado[2]}</span>
            </>
          ) : (
            <span className="font-medium">Municipio</span>
          )}
          <span className="ml-2 text-xs text-text-muted">DANE {value}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={disabled}
          onClick={() => onChange('')}
          aria-label="Quitar municipio"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (manual) {
    return (
      <div className="space-y-1">
        <Input
          id={id}
          inputMode="numeric"
          maxLength={5}
          placeholder="Código DANE de 5 dígitos (ej. 11001)"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          disabled={disabled}
          aria-invalid={value !== '' && !esCodigoMunicipioValido(value)}
        />
        <button type="button" className="text-xs text-text-muted underline" onClick={() => setManual(false)}>
          Buscar por nombre
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Buscar municipio o departamento..."
        value={termino}
        disabled={disabled}
        onChange={(e) => {
          setTermino(e.target.value);
          setResaltado(-1);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          setAbierto(false);
          setResaltado(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setResaltado((r) => Math.min(r + 1, resultados.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setResaltado((r) => Math.max(r - 1, 0));
          } else if (e.key === 'Enter') {
            // Dentro de un formulario Enter no debe enviarlo: solo elige el resaltado.
            e.preventDefault();
            const elegido = resaltado >= 0 ? resultados[resaltado] : resultados.length === 1 ? resultados[0] : undefined;
            if (elegido) elegir(elegido);
          } else if (e.key === 'Escape' && abierto) {
            e.stopPropagation();
            setAbierto(false);
          }
        }}
      />
      {abierto && termino.trim() !== '' && (
        <div
          className="max-h-56 overflow-y-auto rounded-md border border-border bg-card text-sm"
          onMouseDown={(e) => e.preventDefault()}
        >
          {resultados.length === 0 ? (
            <p className="px-3 py-2 text-text-muted">
              {catalogo ? 'Sin resultados. Puedes escribir el código DANE a mano.' : 'Cargando...'}
            </p>
          ) : (
            resultados.map((m, i) => (
              <button
                key={m[0]}
                type="button"
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  elegir(m);
                }}
                onClick={(e) => {
                  // Solo activación por teclado; el ratón ya eligió en mousedown.
                  if (e.detail === 0) elegir(m);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-background',
                  i === resaltado && 'bg-background ring-1 ring-inset ring-gold'
                )}
              >
                <span>
                  <span className="font-medium text-navy">{m[1]}</span>
                  <span className="text-text-muted"> · {m[2]}</span>
                </span>
                <span className="text-xs text-text-muted">{m[0]}</span>
              </button>
            ))
          )}
        </div>
      )}
      <button type="button" className="text-xs text-text-muted underline" onClick={() => setManual(true)}>
        Mi municipio no aparece: escribir el código DANE
      </button>
    </div>
  );
}
