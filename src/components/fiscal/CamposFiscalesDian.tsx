import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioDaneSelect } from '@/components/fiscal/MunicipioDaneSelect';
import { TIPOS_PERSONA, digitoVerificacionNit } from '@/utils/fiscal';
import type { TipoPersona } from '@/utils/fiscal';

interface CamposFiscalesDianProps {
  idBase: string;
  tipoPersona: TipoPersona | '';
  codigoMunicipio: string;
  onTipoPersonaChange: (valor: TipoPersona) => void;
  onCodigoMunicipioChange: (codigo: string) => void;
  disabled?: boolean;
}

/**
 * Los dos datos que la DIAN exige además del documento y la razón social: si el adquirente es
 * persona natural o jurídica, y su municipio (código DANE). Se comparte entre el perfil del
 * cliente y el cobro de una venta con factura electrónica.
 */
export function CamposFiscalesDian({
  idBase,
  tipoPersona,
  codigoMunicipio,
  onTipoPersonaChange,
  onCodigoMunicipioChange,
  disabled,
}: CamposFiscalesDianProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-persona`}>Tipo de persona</Label>
        <Select value={tipoPersona} onValueChange={(v) => onTipoPersonaChange(v as TipoPersona)} disabled={disabled}>
          <SelectTrigger id={`${idBase}-persona`}>
            <SelectValue placeholder="Selecciona" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_PERSONA.map((t) => (
              <SelectItem key={t.valor} value={t.valor}>
                {t.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idBase}-municipio`}>Municipio (opcional)</Label>
        <MunicipioDaneSelect
          id={`${idBase}-municipio`}
          value={codigoMunicipio}
          onChange={onCodigoMunicipioChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/** Ayuda bajo el número de documento: el NIT se escribe sin dígito de verificación y se calcula. */
export function AyudaDigitoVerificacion({ tipoDocumento, numero }: { tipoDocumento: string; numero: string }) {
  if (tipoDocumento !== 'NIT') return null;
  const dv = digitoVerificacionNit(numero);
  return (
    <p className="text-xs text-text-muted">
      {dv === null
        ? 'Escribe el NIT sin dígito de verificación; se calcula solo.'
        : `Dígito de verificación: ${dv} (NIT completo ${numero.replace(/[.\s]/g, '').split('-')[0]}-${dv})`}
    </p>
  );
}
