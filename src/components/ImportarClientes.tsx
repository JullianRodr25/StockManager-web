import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/services/api';
import { importarClientes } from '@/services/clienteService';
import type { ImportarClientesResponse } from '@/types/clientes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ImportarClientesProps {
  token: string | null;
  /** Se llama cuando la importación se guardó, para que la pantalla recargue la lista. */
  onImportado: () => void;
}

// Una respuesta sin cuerpo JSON (ej. un proxy devolviendo otra cosa con 200) llegaría como
// undefined; se normaliza para que siempre haya un resultado con forma válida que mostrar.
function normalizar(respuesta: Partial<ImportarClientesResponse> | undefined): ImportarClientesResponse {
  return {
    totalFilas: respuesta?.totalFilas ?? 0,
    creados: respuesta?.creados ?? 0,
    yaExistentes: respuesta?.yaExistentes ?? 0,
    otraCategoria: respuesta?.otraCategoria ?? 0,
    aplicado: respuesta?.aplicado ?? false,
    avisos: Array.isArray(respuesta?.avisos) ? respuesta.avisos : [],
    errores: Array.isArray(respuesta?.errores) ? respuesta.errores : [],
  };
}

function TablaFilas({ filas, tono }: { filas: { fila: number; mensaje: string }[]; tono: 'error' | 'aviso' }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Fila</TableHead>
            <TableHead>Mensaje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => (
            <TableRow key={`${f.fila}-${f.mensaje}`}>
              <TableCell className="text-navy">{f.fila > 0 ? f.fila : 'General'}</TableCell>
              <TableCell className={tono === 'error' ? 'text-error-text' : 'text-text-muted'}>{f.mensaje}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Botón + diálogo para migrar clientes desde el Excel de terceros del programa contable.
 * Flujo en dos pasos, igual que la importación de productos: primero se valida SIN guardar y se
 * muestra la vista previa; solo si no hay errores se puede confirmar y guardar.
 */
export function ImportarClientes({ token, onImportado }: ImportarClientesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState<ImportarClientesResponse | null>(null);
  const [archivoPendiente, setArchivoPendiente] = useState<File | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  function mostrarError(err: unknown) {
    const mensaje = err instanceof ApiError ? err.message : 'No se pudo importar el archivo.';
    setResultado(null);
    setArchivoPendiente(null);
    setMensajeError(mensaje);
    setAbierto(true);
    toast.error(mensaje);
  }

  // Paso 1: validar sin guardar.
  async function handleArchivoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setProcesando(true);
    setMensajeError(null);
    setResultado(null);
    setArchivoPendiente(null);
    try {
      const vistaPrevia = normalizar(await importarClientes(archivo, token, true));
      setResultado(vistaPrevia);
      // Solo se puede confirmar si todo es válido y hay algo que crear.
      setArchivoPendiente(vistaPrevia.errores.length === 0 && vistaPrevia.creados > 0 ? archivo : null);
      setAbierto(true);
    } catch (err) {
      mostrarError(err);
    } finally {
      setProcesando(false);
    }
  }

  // Paso 2: el usuario confirmó; se envía el mismo archivo para guardar.
  async function handleConfirmar() {
    if (!archivoPendiente) return;

    setProcesando(true);
    try {
      const aplicado = normalizar(await importarClientes(archivoPendiente, token, false));
      setResultado(aplicado);
      setArchivoPendiente(null);
      if (aplicado.aplicado) {
        toast.success(`Importación aplicada: ${aplicado.creados} clientes creados`);
        onImportado();
      } else {
        // El archivo cambió de estado entre la vista previa y la confirmación: no se guardó nada.
        toast.warning('No se guardó nada: el archivo tiene errores.');
      }
    } catch (err) {
      mostrarError(err);
    } finally {
      setProcesando(false);
    }
  }

  function handleCerrar(siAbierto: boolean) {
    if (procesando) return;
    setAbierto(siAbierto);
    if (!siAbierto) setArchivoPendiente(null);
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleArchivoSeleccionado} />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={procesando}>
        {procesando ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        Importar Excel
      </Button>

      <Dialog open={abierto} onOpenChange={handleCerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resultado?.aplicado
                ? 'Importación aplicada'
                : archivoPendiente
                  ? 'Vista previa de la importación'
                  : 'Resultado de la importación'}
            </DialogTitle>
            <DialogDescription>
              Excel de terceros del programa contable. Solo se crean los de categoría CLIENTE; los que
              ya existen (misma identificación) no se modifican.
            </DialogDescription>
          </DialogHeader>

          {mensajeError && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {mensajeError}
            </div>
          )}

          {resultado && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Filas</p>
                  <p className="text-lg font-semibold text-navy">{resultado.totalFilas}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Se crean</p>
                  <p className="text-lg font-semibold text-green">{resultado.creados}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Ya existían</p>
                  <p className="text-lg font-semibold text-text-muted">{resultado.yaExistentes}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-text-muted">Otra categoría</p>
                  <p className="text-lg font-semibold text-text-muted">{resultado.otraCategoria}</p>
                </div>
              </div>

              {archivoPendiente && (
                <p className="text-sm text-text-muted">
                  Todavía no se ha guardado nada. Los clientes sin teléfono o dirección quedan con "Sin dato"
                  para completarlos después, y nadie recibe contraseña: entran con "Olvidé mi contraseña" o con
                  la que les asigne un administrador.
                </p>
              )}
              {!archivoPendiente && !resultado.aplicado && resultado.errores.length === 0 && (
                <p className="text-sm text-text-muted">El archivo no tiene clientes nuevos para crear.</p>
              )}
            </div>
          )}

          {resultado && resultado.errores.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-error-text">
                {resultado.errores.length} fila(s) con errores — no se guardó ningún cliente. Corrige el
                archivo y vuelve a subirlo.
              </p>
              <TablaFilas filas={resultado.errores} tono="error" />
            </div>
          )}

          {resultado && resultado.avisos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-navy">Avisos ({resultado.avisos.length}) — no impiden importar</p>
              <TablaFilas filas={resultado.avisos} tono="aviso" />
            </div>
          )}

          <DialogFooter>
            {archivoPendiente ? (
              <>
                <Button variant="outline" onClick={() => handleCerrar(false)} disabled={procesando}>
                  Cancelar
                </Button>
                <Button variant="gold" onClick={handleConfirmar} disabled={procesando}>
                  {procesando ? 'Importando...' : `Confirmar e importar ${resultado?.creados ?? ''} clientes`}
                </Button>
              </>
            ) : (
              <Button variant="gold" onClick={() => handleCerrar(false)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
