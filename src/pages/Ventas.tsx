import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Lock, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/services/api';
import { loginEmpleado } from '@/services/authService';
import { obtenerConfiguracion } from '@/services/configuracionService';
import { abrirCajon } from '@/services/impresionService';
import { obtenerProductos } from '@/services/inventarioService';
import { registrarVenta } from '@/services/ventaService';
import { buscarClientes, crearCliente } from '@/services/clienteService';
import { useSincronizacionStock } from '@/hooks/useSincronizacionStock';
import type { Producto } from '@/types/inventario';
import type { MetodoPago, MetodoPagoVenta, RegistrarVentaRequest, VentaResponse } from '@/types/ventas';
import type { Cliente, TipoDocumentoFiscal } from '@/types/clientes';
import { BuscadorProductos } from '@/components/BuscadorProductos';
import { DetalleFacturaDialog } from '@/components/DetalleFacturaDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TAMANO_PAGINA_PRODUCTOS = 500;

const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// Separador de miles (punto, formato es-CO) para los campos de dinero que el cajero escribe a
// mano (monto recibido, desglose de pago mixto): sin esto, escribir "180000" a ciegas es
// fastidioso y propenso a errores de dígitos; con el punto de miles se lee igual que el resto
// de montos ya formateados en pantalla (ej. el precio unitario o el total).
const formatoMiles = new Intl.NumberFormat('es-CO');

// El estado sigue guardando solo dígitos (ej. "180000"), nunca el texto formateado: así el
// resto del código (validaciones, Number(...), lo que se envía al backend) no cambia.
function formatearMiles(valorCrudo: string): string {
  const soloDigitos = valorCrudo.replace(/\D/g, '');
  if (soloDigitos === '') return '';
  return formatoMiles.format(Number(soloDigitos));
}

function desformatearMiles(valorFormateado: string): string {
  return valorFormateado.replace(/\D/g, '');
}

// Denominaciones de billetes/monedas más comunes en Colombia, para sugerir con qué "le pagó"
// el cliente y calcular la vuelta de una — exactamente lo que hace un cajero mentalmente.
const DENOMINACIONES_COP = [100000, 50000, 20000, 10000, 5000, 2000, 1000];

// Sugiere montos recibidos a partir del total: el total exacto (sin vueltas) y, para cada
// denominación mayor o igual al total, el primer múltiplo de esa denominación que alcanza a
// cubrirlo (ej. total $37.000 → sugiere $40.000, $50.000, $100.000). Máximo 4 sugerencias.
function sugerirMontosRecibidos(total: number): number[] {
  if (total <= 0) return [];
  const sugerencias = new Set<number>([total]);
  for (const denominacion of DENOMINACIONES_COP) {
    if (sugerencias.size >= 4) break;
    const redondeado = Math.ceil(total / denominacion) * denominacion;
    if (redondeado > total) sugerencias.add(redondeado);
  }
  return [...sugerencias].sort((a, b) => a - b).slice(0, 4);
}

const metodosPago: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'Efectivo', etiqueta: 'Efectivo' },
  { valor: 'Tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'Transferencia', etiqueta: 'Transferencia' },
];

const metodosPagoVenta: { valor: MetodoPagoVenta; etiqueta: string }[] = [
  ...metodosPago,
  { valor: 'Mixto', etiqueta: 'Mixto (varios métodos)' },
];

const tiposDocumentoFiscal: { valor: TipoDocumentoFiscal; etiqueta: string }[] = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'NIT', etiqueta: 'NIT' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'Pasaporte', etiqueta: 'Pasaporte' },
  { valor: 'Otro', etiqueta: 'Otro' },
];

// Datos fiscales que se piden solo cuando hace falta: para un cliente ya registrado que no
// tiene su perfil completo, o para registrar en el momento a un comprador sin registrar que
// pide factura electrónica (ver RegistrarVentaRequest/CrearClienteRequest en el backend).
interface DatosFacturaForm {
  tipoDocumentoFiscal: TipoDocumentoFiscal | '';
  numeroDocumentoFiscal: string;
  razonSocialFiscal: string;
  direccionFiscal: string;
  emailFacturacion: string;
}

const datosFacturaVacio: DatosFacturaForm = {
  tipoDocumentoFiscal: '',
  numeroDocumentoFiscal: '',
  razonSocialFiscal: '',
  direccionFiscal: '',
  emailFacturacion: '',
};

// Dos líneas vacías por defecto: un pago "Mixto" no tiene sentido con menos de dos métodos.
const lineasDesgloseIniciales = (): { metodoPago: MetodoPago | ''; monto: string }[] => [
  { metodoPago: '', monto: '' },
  { metodoPago: '', monto: '' },
];

type ModoComprador = 'registrado' | 'sinRegistro';

interface LineaCarrito {
  productoId: number;
  cantidad: string;
  stockActual: number;
}

const estadoInicialComprador = {
  modoComprador: 'sinRegistro' as ModoComprador,
  clienteId: '',
  nombreComprador: '',
  telefonoComprador: '',
  emailComprador: '',
  metodoPago: '' as MetodoPagoVenta | '',
};

export function Ventas() {
  const { token, usuario } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);

  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);

  const [dialogFinalizarAbierto, setDialogFinalizarAbierto] = useState(false);
  const [modoComprador, setModoComprador] = useState<ModoComprador>(estadoInicialComprador.modoComprador);
  const [clienteId, setClienteId] = useState(estadoInicialComprador.clienteId);
  const [nombreComprador, setNombreComprador] = useState(estadoInicialComprador.nombreComprador);
  const [telefonoComprador, setTelefonoComprador] = useState(estadoInicialComprador.telefonoComprador);
  const [emailComprador, setEmailComprador] = useState(estadoInicialComprador.emailComprador);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoVenta | ''>(estadoInicialComprador.metodoPago);
  const [montoRecibido, setMontoRecibido] = useState('');
  const [desglosePago, setDesglosePago] = useState(lineasDesgloseIniciales());
  // Con Transferencia no hay forma de que el sistema confirme por sí solo que la plata ya
  // llegó (suele ser Nequi u otra pasarela aparte): el cajero debe mirar el comprobante o el
  // pantallazo y marcar esta casilla antes de poder confirmar la venta.
  const [pagoTransferenciaRevisado, setPagoTransferenciaRevisado] = useState(false);

  // --- Factura electrónica ---
  const [requiereFacturaElectronica, setRequiereFacturaElectronica] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  // Autocomplete de "Cliente registrado": lo que el cajero escribe (nombre o cédula) y los
  // resultados que trae buscarClientes(). Mientras ya hay un clienteSeleccionado, estos quedan
  // sin usar (el campo se vuelve de solo lectura con un botón para "Cambiar").
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([]);
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);
  // Se piden cuando un comprador sin registrar marca "Solicitar factura electrónica" (ver
  // Cliente.Crear, que exige estos datos) o cuando el cajero decide registrarlo como cliente
  // desde acá mismo con el botón "Registrar como cliente", aunque no pida factura.
  const [direccionComprador, setDireccionComprador] = useState('');
  const [numeroIdentificacionComprador, setNumeroIdentificacionComprador] = useState('');
  const [mostrandoRegistroCliente, setMostrandoRegistroCliente] = useState(false);
  const [registrandoCliente, setRegistrandoCliente] = useState(false);
  const [datosFactura, setDatosFactura] = useState<DatosFacturaForm>(datosFacturaVacio);

  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [conflictoStock, setConflictoStock] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const registroEnCursoRef = useRef(false);

  const [ventaRecienCreada, setVentaRecienCreada] = useState<VentaResponse | null>(null);
  const [facturaAbierta, setFacturaAbierta] = useState(false);

  const [nombreImpresora, setNombreImpresora] = useState<string | null>(null);
  const [abriendoCajon, setAbriendoCajon] = useState(false);

  // El botón de "Abrir caja" (fuera de una venta) pide la contraseña del cajero antes de
  // mover dinero/abrir el cajón, para que no cualquiera con acceso al computador pueda
  // hacerlo con solo apretar un botón. En vez de inventar una contraseña o PIN aparte (otro
  // secreto que recordar y administrar), se reutiliza la misma contraseña con la que el
  // cajero ya inició sesión: se reenvía al endpoint normal de login (loginEmpleado); si
  // responde bien, la contraseña es correcta y se procede a abrir el cajón.
  const [mostrarConfirmacionCajon, setMostrarConfirmacionCajon] = useState(false);
  const [passwordCajon, setPasswordCajon] = useState('');
  const [verificandoPasswordCajon, setVerificandoPasswordCajon] = useState(false);
  const [errorPasswordCajon, setErrorPasswordCajon] = useState<string | null>(null);

  // En modo "Cliente registrado", busca por nombre o número de identificación a medida que el
  // cajero escribe (solo clientes activos: uno inactivo no debería poder seleccionarse para una
  // venta nueva). Mientras ya hay un cliente elegido no hace falta seguir buscando.
  useEffect(() => {
    if (modoComprador !== 'registrado' || clienteSeleccionado) {
      setResultadosCliente([]);
      return;
    }
    const termino = busquedaCliente.trim();
    if (termino.length < 2) {
      setResultadosCliente([]);
      return;
    }
    let cancelado = false;
    setBuscandoCliente(true);
    const timeoutId = setTimeout(() => {
      buscarClientes(termino, token, true)
        .then((clientes) => {
          if (!cancelado) setResultadosCliente(clientes);
        })
        .catch(() => {
          if (!cancelado) setResultadosCliente([]);
        })
        .finally(() => {
          if (!cancelado) setBuscandoCliente(false);
        });
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
  }, [modoComprador, busquedaCliente, clienteSeleccionado, token]);

  // Autocompleta los datos fiscales con los que ya tiene guardados el cliente encontrado, para
  // que el cajero no tenga que volver a escribirlos (puede corregirlos para esta venta puntual
  // si hace falta). Si el cliente no tiene algún campo, ese campo queda vacío para completarlo.
  useEffect(() => {
    if (modoComprador !== 'registrado' || !clienteSeleccionado) {
      if (modoComprador === 'registrado') setDatosFactura(datosFacturaVacio);
      return;
    }
    setDatosFactura({
      tipoDocumentoFiscal: clienteSeleccionado.tipoDocumentoFiscal ?? '',
      numeroDocumentoFiscal: clienteSeleccionado.numeroDocumentoFiscal ?? '',
      razonSocialFiscal: clienteSeleccionado.razonSocialFiscal ?? '',
      direccionFiscal: clienteSeleccionado.direccionFiscal ?? '',
      emailFacturacion: clienteSeleccionado.emailFacturacion ?? '',
    });
  }, [modoComprador, clienteSeleccionado]);

  // Si el cajero cambia el método de pago (p. ej. eligió Transferencia, marcó la revisión, y
  // luego se da cuenta de que en realidad fue Efectivo), la confirmación anterior ya no
  // aplica al nuevo método y debe volver a pedirse.
  useEffect(() => {
    if (metodoPago !== 'Transferencia') {
      setPagoTransferenciaRevisado(false);
    }
  }, [metodoPago]);

  function seleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setClienteId(String(cliente.id));
    setBusquedaCliente('');
    setResultadosCliente([]);
    setMostrarDropdownCliente(false);
  }

  function quitarClienteSeleccionado() {
    setClienteSeleccionado(null);
    setClienteId('');
    setBusquedaCliente('');
  }

  // Registra como Cliente (origen "Caja") al comprador que se está tipeando en modo "Sin
  // registrar", reutilizando los mismos campos que ya se piden para factura electrónica
  // (nombre/teléfono/correo siempre visibles; identificación/dirección se revelan al pulsar
  // este botón). Tras registrarlo, la venta sigue en modo "Cliente registrado" con él ya
  // elegido, así que de acá en adelante usa el mismo camino que cualquier cliente existente.
  async function handleRegistrarClienteDesdeVenta() {
    if (!mostrandoRegistroCliente) {
      setMostrandoRegistroCliente(true);
      return;
    }
    if (
      !nombreComprador.trim() ||
      !numeroIdentificacionComprador.trim() ||
      !telefonoComprador.trim() ||
      !emailComprador.trim() ||
      !direccionComprador.trim()
    ) {
      toast.error('Completa nombre, identificación, teléfono, correo y dirección para registrar el cliente.');
      return;
    }
    setRegistrandoCliente(true);
    try {
      const creado = await crearCliente(
        {
          numeroIdentificacion: numeroIdentificacionComprador.trim(),
          nombre: nombreComprador.trim(),
          email: emailComprador.trim(),
          telefono: telefonoComprador.trim(),
          direccion: direccionComprador.trim(),
          password: null,
        },
        token
      );
      toast.success(`Cliente "${creado.cliente.nombre}" registrado`, {
        description: creado.passwordTemporal
          ? `Contraseña temporal para la PWA: ${creado.passwordTemporal}`
          : 'Ya puedes continuar la venta con él.',
      });
      setModoComprador('registrado');
      setClienteSeleccionado(creado.cliente);
      setClienteId(String(creado.cliente.id));
      setMostrandoRegistroCliente(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar el cliente.');
    } finally {
      setRegistrandoCliente(false);
    }
  }

  useEffect(() => {
    obtenerConfiguracion(token)
      .then((config) => setNombreImpresora(config.nombreImpresoraTickets))
      .catch(() => {
        // Sin impresora configurada (o sin poder consultar la configuración) el botón de
        // "Abrir caja" simplemente no aparece; el resto de la pantalla de ventas no depende de esto.
      });
  }, [token]);

  async function handleAbrirCajon() {
    if (!nombreImpresora || abriendoCajon) return;
    setAbriendoCajon(true);
    try {
      await abrirCajon(nombreImpresora);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir el cajón.');
    } finally {
      setAbriendoCajon(false);
    }
  }

  function handlePedirConfirmacionCajon() {
    setPasswordCajon('');
    setErrorPasswordCajon(null);
    setMostrarConfirmacionCajon(true);
  }

  async function handleConfirmarPasswordCajon(evento: FormEvent) {
    evento.preventDefault();
    if (!usuario || verificandoPasswordCajon) return;
    if (!passwordCajon) {
      setErrorPasswordCajon('Ingresa tu contraseña.');
      return;
    }
    setVerificandoPasswordCajon(true);
    setErrorPasswordCajon(null);
    try {
      // No hay un endpoint aparte para "solo verificar contraseña": reautenticar contra el
      // mismo login es la forma más simple y segura de confirmarla sin duplicar lógica de
      // hashing/validación que ya vive en el backend.
      await loginEmpleado({ identificador: usuario.numeroIdentificacion, password: passwordCajon });
      setMostrarConfirmacionCajon(false);
      setPasswordCajon('');
      await handleAbrirCajon();
    } catch (err) {
      setErrorPasswordCajon(err instanceof ApiError ? err.message : 'Contraseña incorrecta.');
    } finally {
      setVerificandoPasswordCajon(false);
    }
  }

  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true);
    setErrorProductos(null);
    try {
      const respuesta = await obtenerProductos(1, TAMANO_PAGINA_PRODUCTOS, token);
      setProductos(respuesta.data.filter((producto) => producto.activo));
    } catch (err) {
      setErrorProductos(err instanceof ApiError ? err.message : 'No se pudieron cargar los productos.');
    } finally {
      setCargandoProductos(false);
    }
  }, [token]);

  // Cuando otro usuario vende algo (u otra acción que cambie el stock), esto actualiza el
  // stockActual de los productos ya cargados en esta pantalla sin recargar nada.
  useSincronizacionStock(setProductos);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  const productosPorId = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto])),
    [productos]
  );

  const carritoConDatos = useMemo(
    () =>
      carrito.map((linea) => {
        const producto = productosPorId.get(linea.productoId);
        const cantidad = Number(linea.cantidad);
        const cantidadInvalida = !Number.isFinite(cantidad) || cantidad < 1;
        const subtotal = producto && !cantidadInvalida ? producto.precio * cantidad : 0;
        return { ...linea, producto, cantidadInvalida, subtotal };
      }),
    [carrito, productosPorId]
  );

  const hayCantidadInvalida = carritoConDatos.some((linea) => linea.cantidadInvalida);
  const total = carritoConDatos.reduce((acumulado, linea) => acumulado + linea.subtotal, 0);
  const carritoVacio = carrito.length === 0;

  const montoRecibidoNumero = Number(montoRecibido);
  const montoRecibidoValido = montoRecibido.trim() !== '' && Number.isFinite(montoRecibidoNumero);
  const cambio = montoRecibidoValido ? montoRecibidoNumero - total : null;

  // Un pago "Mixto" se valida contra el total con el mismo criterio exacto que exige el
  // backend (Venta.ValidarDetallesPago): al menos dos líneas, cada una con método y monto
  // válidos, y la suma exactamente igual al total — sin tolerancia.
  const sumaDesglose = desglosePago.reduce((acumulado, linea) => acumulado + (Number(linea.monto) || 0), 0);
  const diferenciaDesglose = total - sumaDesglose;
  const desgloseCuadra = Math.abs(diferenciaDesglose) < 0.005;
  const lineasDesgloseValidas = desglosePago.every(
    (linea) => linea.metodoPago !== '' && Number(linea.monto) > 0
  );
  const desgloseValido = desglosePago.length >= 2 && lineasDesgloseValidas && desgloseCuadra;

  function actualizarLineaDesglose(indice: number, campo: 'metodoPago' | 'monto', valor: string) {
    setDesglosePago((actual) =>
      actual.map((linea, i) => (i === indice ? { ...linea, [campo]: valor } : linea))
    );
  }

  function agregarLineaDesglose() {
    setDesglosePago((actual) => [...actual, { metodoPago: '', monto: '' }]);
  }

  function quitarLineaDesglose(indice: number) {
    setDesglosePago((actual) => actual.filter((_, i) => i !== indice));
  }

  // Validación de UX: evita agregar o escribir más unidades de las
  // que el producto tiene en stock. Esto NO reemplaza la validación
  // real del backend, que sigue siendo la fuente de verdad: por
  // concurrencia, el stock puede cambiar entre que se arma el carrito
  // y se confirma la venta, así que el manejo del error 409 en
  // handleConfirmarVenta debe seguir existiendo.
  function agregarProductoAlCarrito(producto: Producto) {
    if (producto.stockActual <= 0) {
      toast.error(`"${producto.nombre}" no tiene stock disponible.`);
      return;
    }

    const existente = carrito.find((linea) => linea.productoId === producto.id);
    const cantidadActual = existente ? Number(existente.cantidad) || 0 : 0;

    if (cantidadActual + 1 > producto.stockActual) {
      toast.error(`Solo hay ${producto.stockActual} unidades disponibles de "${producto.nombre}"`);
      return;
    }

    setCarrito((actual) => {
      const existente = actual.find((linea) => linea.productoId === producto.id);
      if (existente) {
        return actual.map((linea) =>
          linea.productoId === producto.id
            ? { ...linea, cantidad: String((Number(linea.cantidad) || 0) + 1) }
            : linea
        );
      }
      return [...actual, { productoId: producto.id, cantidad: '1', stockActual: producto.stockActual }];
    });
  }

  function actualizarCantidad(productoId: number, valor: string) {
    const linea = carrito.find((l) => l.productoId === productoId);
    const cantidadIngresada = Number(valor);

    if (linea && Number.isFinite(cantidadIngresada) && cantidadIngresada > linea.stockActual) {
      const producto = productosPorId.get(productoId);
      toast.error(`Solo hay ${linea.stockActual} unidades disponibles de "${producto?.nombre ?? ''}"`);
      setCarrito((actual) =>
        actual.map((l) => (l.productoId === productoId ? { ...l, cantidad: String(linea.stockActual) } : l))
      );
      return;
    }

    setCarrito((actual) =>
      actual.map((linea) => (linea.productoId === productoId ? { ...linea, cantidad: valor } : linea))
    );
  }

  function eliminarLinea(productoId: number) {
    setCarrito((actual) => actual.filter((linea) => linea.productoId !== productoId));
  }

  function abrirDialogFinalizar() {
    setErrorFormulario(null);
    setConflictoStock(null);
    setDialogFinalizarAbierto(true);
  }

  function reiniciarVenta() {
    setCarrito([]);
    setModoComprador(estadoInicialComprador.modoComprador);
    setClienteId(estadoInicialComprador.clienteId);
    setNombreComprador(estadoInicialComprador.nombreComprador);
    setTelefonoComprador(estadoInicialComprador.telefonoComprador);
    setEmailComprador(estadoInicialComprador.emailComprador);
    setMetodoPago(estadoInicialComprador.metodoPago);
    setMontoRecibido('');
    setDesglosePago(lineasDesgloseIniciales());
    setPagoTransferenciaRevisado(false);
    setRequiereFacturaElectronica(false);
    setClienteSeleccionado(null);
    setBusquedaCliente('');
    setResultadosCliente([]);
    setMostrarDropdownCliente(false);
    setDireccionComprador('');
    setNumeroIdentificacionComprador('');
    setMostrandoRegistroCliente(false);
    setDatosFactura(datosFacturaVacio);
    setErrorFormulario(null);
    setConflictoStock(null);
    setDialogFinalizarAbierto(false);
  }

  async function handleConfirmarVenta(event: FormEvent) {
    event.preventDefault();
    if (registroEnCursoRef.current) return;

    setErrorFormulario(null);
    setConflictoStock(null);

    if (carritoVacio) {
      setErrorFormulario('Agrega al menos un producto para registrar la venta.');
      return;
    }
    if (hayCantidadInvalida) {
      setErrorFormulario('Corrige las cantidades inválidas antes de confirmar la venta.');
      return;
    }
    if (!metodoPago) {
      setErrorFormulario('Selecciona un método de pago.');
      return;
    }
    if (metodoPago === 'Efectivo' && (!montoRecibidoValido || montoRecibidoNumero < total)) {
      setErrorFormulario('Ingresa el monto recibido en efectivo; debe ser al menos el total de la venta.');
      return;
    }
    if (metodoPago === 'Mixto' && !desgloseValido) {
      setErrorFormulario(
        desglosePago.length < 2 || !lineasDesgloseValidas
          ? 'Completa al menos dos métodos de pago con su monto.'
          : 'La suma del desglose debe ser igual al total de la venta.'
      );
      return;
    }
    if (metodoPago === 'Transferencia' && !pagoTransferenciaRevisado) {
      setErrorFormulario('Confirma que revisaste el comprobante de la transferencia antes de continuar.');
      return;
    }
    if (modoComprador === 'registrado' && (!Number.isInteger(Number(clienteId)) || Number(clienteId) <= 0)) {
      setErrorFormulario('Busca y selecciona un cliente registrado.');
      return;
    }
    if (modoComprador === 'sinRegistro' && !nombreComprador.trim()) {
      setErrorFormulario('El nombre del comprador es obligatorio.');
      return;
    }

    const datosFacturaCompletos =
      datosFactura.tipoDocumentoFiscal !== '' &&
      datosFactura.numeroDocumentoFiscal.trim() !== '' &&
      datosFactura.razonSocialFiscal.trim() !== '';
    const clienteTieneDatosFiscales = clienteSeleccionado?.tieneDatosFacturacionElectronicaCompletos ?? false;

    if (requiereFacturaElectronica) {
      if (modoComprador === 'registrado' && !clienteTieneDatosFiscales && !datosFacturaCompletos) {
        setErrorFormulario(
          'Para solicitar factura electrónica, completa tipo y número de documento fiscal, y la razón social.'
        );
        return;
      }
      if (modoComprador === 'sinRegistro') {
        if (!numeroIdentificacionComprador.trim() || !telefonoComprador.trim() || !emailComprador.trim() || !direccionComprador.trim()) {
          setErrorFormulario(
            'Para registrar al comprador y solicitar factura electrónica, completa identificación, teléfono, correo y dirección.'
          );
          return;
        }
        if (!datosFacturaCompletos) {
          setErrorFormulario(
            'Completa tipo y número de documento fiscal, y la razón social, para solicitar factura electrónica.'
          );
          return;
        }
      }
    }

    // Un comprador sin registrar que pide factura electrónica queda registrado como Cliente
    // (origen "Caja") en este mismo momento, con sus datos fiscales ya guardados en el
    // perfil — así la próxima vez que compre no hay que volver a pedírselos.
    let clienteIdParaVenta = modoComprador === 'registrado' ? Number(clienteId) : undefined;
    if (modoComprador === 'sinRegistro' && requiereFacturaElectronica) {
      try {
        const clienteCreado = await crearCliente(
          {
            numeroIdentificacion: numeroIdentificacionComprador.trim(),
            nombre: nombreComprador.trim(),
            email: emailComprador.trim(),
            telefono: telefonoComprador.trim(),
            direccion: direccionComprador.trim(),
            password: null,
            tipoDocumentoFiscal: datosFactura.tipoDocumentoFiscal || null,
            numeroDocumentoFiscal: datosFactura.numeroDocumentoFiscal.trim() || null,
            razonSocialFiscal: datosFactura.razonSocialFiscal.trim() || null,
            direccionFiscal: datosFactura.direccionFiscal.trim() || null,
            emailFacturacion: datosFactura.emailFacturacion.trim() || null,
          },
          token
        );
        clienteIdParaVenta = clienteCreado.cliente.id;
      } catch (err) {
        setErrorFormulario(err instanceof ApiError ? err.message : 'No se pudo registrar al comprador.');
        return;
      }
    }

    const solicitud: RegistrarVentaRequest = {
      ...(clienteIdParaVenta !== undefined ? { clienteId: clienteIdParaVenta } : {}),
      ...(modoComprador === 'sinRegistro' && !requiereFacturaElectronica && nombreComprador.trim()
        ? { nombreComprador: nombreComprador.trim() }
        : {}),
      ...(modoComprador === 'sinRegistro' && !requiereFacturaElectronica && telefonoComprador.trim()
        ? { telefonoComprador: telefonoComprador.trim() }
        : {}),
      ...(modoComprador === 'sinRegistro' && !requiereFacturaElectronica && emailComprador.trim()
        ? { emailComprador: emailComprador.trim() }
        : {}),
      metodoPago,
      ...(metodoPago === 'Efectivo' ? { montoRecibido: montoRecibidoNumero } : {}),
      ...(metodoPago === 'Mixto'
        ? {
            detallesPago: desglosePago.map((linea) => ({
              metodoPago: linea.metodoPago as MetodoPago,
              monto: Number(linea.monto),
            })),
          }
        : {}),
      lineas: carritoConDatos.map((linea) => ({
        productoId: linea.productoId,
        cantidad: Number(linea.cantidad),
      })),
      ...(requiereFacturaElectronica
        ? {
            requiereFacturaElectronica: true,
            // Si el cliente registrado ya tiene datos fiscales completos, no hace falta
            // reenviarlos: VentaService los completa desde su perfil. Si no, o si es un
            // comprador recién registrado, van estos (ya guardados también en su perfil).
            ...(!clienteTieneDatosFiscales && datosFacturaCompletos
              ? {
                  tipoDocumentoFiscal: datosFactura.tipoDocumentoFiscal || null,
                  numeroDocumentoFiscal: datosFactura.numeroDocumentoFiscal.trim() || null,
                  razonSocialFiscal: datosFactura.razonSocialFiscal.trim() || null,
                  direccionFiscal: datosFactura.direccionFiscal.trim() || null,
                  emailFacturacion: datosFactura.emailFacturacion.trim() || null,
                }
              : {}),
          }
        : {}),
    };

    registroEnCursoRef.current = true;
    setRegistrando(true);
    try {
      const venta = await registrarVenta(solicitud, token);
      toast.success('Venta registrada correctamente', {
        description: `Venta #${venta.id} · ${formatoMoneda.format(venta.total)}`,
      });
      reiniciarVenta();
      await cargarProductos();
      setVentaRecienCreada(venta);
      setFacturaAbierta(true);
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'No se pudo registrar la venta.';
      if (err instanceof ApiError && err.status === 409) {
        setConflictoStock(mensaje || 'El stock cambió mientras se procesaba la venta. Intenta de nuevo.');
        toast.error('El stock cambió, intenta de nuevo');
      } else {
        setErrorFormulario(mensaje);
        toast.error(mensaje);
      }
    } finally {
      registroEnCursoRef.current = false;
      setRegistrando(false);
    }
  }

  async function handleReintentarTrasConflicto() {
    setConflictoStock(null);
    await cargarProductos();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BuscadorProductos
          productos={productos}
          cargandoProductos={cargandoProductos}
          errorProductos={errorProductos}
          token={token}
          onSeleccionarProducto={agregarProductoAlCarrito}
        />

        <Card className="border-border">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-navy">Venta actual</CardTitle>
              <CardDescription>Productos agregados a esta venta.</CardDescription>
            </div>
            {nombreImpresora && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePedirConfirmacionCajon}
                disabled={abriendoCajon}
              >
                {abriendoCajon ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Abrir caja
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {carritoVacio ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-text-muted">
                <ShoppingCart className="h-8 w-8" />
                <p>Agrega productos para iniciar la venta.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Precio unit.</TableHead>
                        <TableHead className="w-28">Cantidad</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carritoConDatos.map((linea) => (
                        <TableRow key={linea.productoId}>
                          <TableCell className="text-navy">{linea.producto?.nombre ?? '—'}</TableCell>
                          <TableCell className="text-text-muted">
                            {linea.producto ? formatoMoneda.format(linea.producto.precio) : '—'}
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`Cantidad para ${linea.producto?.nombre ?? 'el producto'}`}
                              type="number"
                              min="1"
                              max={linea.stockActual}
                              step="1"
                              value={linea.cantidad}
                              onChange={(e) => actualizarCantidad(linea.productoId, e.target.value)}
                              className={cn(linea.cantidadInvalida && 'border-error-text focus-visible:ring-error-text')}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium text-navy">
                            {formatoMoneda.format(linea.subtotal)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Eliminar producto"
                              onClick={() => eliminarLinea(linea.productoId)}
                            >
                              <Trash2 className="h-4 w-4 text-error-text" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-text-muted">Total</span>
                  <span className="text-lg font-semibold text-navy">{formatoMoneda.format(total)}</span>
                </div>

                <Button
                  type="button"
                  variant="gold"
                  className="w-full"
                  disabled={carritoVacio || hayCantidadInvalida}
                  onClick={abrirDialogFinalizar}
                >
                  Finalizar venta
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogFinalizarAbierto} onOpenChange={setDialogFinalizarAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar venta</DialogTitle>
            <DialogDescription>
              {carritoConDatos.length} producto(s) · Total {formatoMoneda.format(total)}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmarVenta} className="space-y-5">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={modoComprador === 'sinRegistro' ? 'gold' : 'outline'}
                onClick={() => setModoComprador('sinRegistro')}
                disabled={registrando}
              >
                Sin registrar
              </Button>
              <Button
                type="button"
                variant={modoComprador === 'registrado' ? 'gold' : 'outline'}
                onClick={() => setModoComprador('registrado')}
                disabled={registrando}
              >
                Cliente registrado
              </Button>
            </div>

            {modoComprador === 'registrado' ? (
              <div className="space-y-2">
                <Label htmlFor="busquedaCliente">Cliente</Label>
                {clienteSeleccionado ? (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-navy">{clienteSeleccionado.nombre}</p>
                      <p className="text-sm text-muted-foreground">
                        {clienteSeleccionado.numeroIdentificacion}
                        {clienteSeleccionado.tieneDatosFacturacionElectronicaCompletos
                          ? ' · Datos fiscales completos'
                          : ' · Sin datos fiscales completos'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={quitarClienteSeleccionado} disabled={registrando}>
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      id="busquedaCliente"
                      value={busquedaCliente}
                      onChange={(e) => {
                        setBusquedaCliente(e.target.value);
                        setMostrarDropdownCliente(true);
                      }}
                      onFocus={() => setMostrarDropdownCliente(true)}
                      onBlur={() => setTimeout(() => setMostrarDropdownCliente(false), 150)}
                      placeholder="Escribe el nombre o la cédula del cliente..."
                      disabled={registrando}
                      autoComplete="off"
                    />
                    {mostrarDropdownCliente && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {buscandoCliente ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
                        ) : resultadosCliente.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            {busquedaCliente.trim().length < 2
                              ? 'Escribe al menos 2 letras para buscar.'
                              : 'Sin resultados. Puedes registrarlo desde "Sin registrar".'}
                          </p>
                        ) : (
                          resultadosCliente.map((cliente) => (
                            <button
                              key={cliente.id}
                              type="button"
                              // onMouseDown (no onClick) + preventDefault: evita que el input
                              // pierda el foco (blur) antes de que el clic en el resultado
                              // llegue a registrarse. Con onClick, el blur del input oculta el
                              // dropdown justo antes de que el navegador dispare el evento de
                              // clic, así que a veces el resultado "no selecciona nada".
                              onMouseDown={(e) => {
                                e.preventDefault();
                                seleccionarCliente(cliente);
                              }}
                              className="flex w-full flex-col border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-background"
                            >
                              <span className="text-navy">{cliente.nombre}</span>
                              <span className="text-muted-foreground">{cliente.numeroIdentificacion}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreComprador">Nombre</Label>
                  <Input
                    id="nombreComprador"
                    value={nombreComprador}
                    onChange={(e) => setNombreComprador(e.target.value)}
                    disabled={registrando}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="telefonoComprador">
                      Teléfono {requiereFacturaElectronica || mostrandoRegistroCliente ? '' : '(opcional)'}
                    </Label>
                    <Input
                      id="telefonoComprador"
                      value={telefonoComprador}
                      onChange={(e) => setTelefonoComprador(e.target.value)}
                      disabled={registrando}
                      required={requiereFacturaElectronica || mostrandoRegistroCliente}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailComprador">
                      Correo {requiereFacturaElectronica || mostrandoRegistroCliente ? '' : '(opcional)'}
                    </Label>
                    <Input
                      id="emailComprador"
                      type="email"
                      value={emailComprador}
                      onChange={(e) => setEmailComprador(e.target.value)}
                      disabled={registrando}
                      required={requiereFacturaElectronica || mostrandoRegistroCliente}
                    />
                  </div>
                </div>
                {(requiereFacturaElectronica || mostrandoRegistroCliente) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="numeroIdentificacionComprador">Número de identificación</Label>
                      <Input
                        id="numeroIdentificacionComprador"
                        value={numeroIdentificacionComprador}
                        onChange={(e) => setNumeroIdentificacionComprador(e.target.value)}
                        disabled={registrando}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="direccionComprador">Dirección</Label>
                      <Input
                        id="direccionComprador"
                        value={direccionComprador}
                        onChange={(e) => setDireccionComprador(e.target.value)}
                        disabled={registrando}
                        required
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    {mostrandoRegistroCliente
                      ? 'Completa sus datos y guárdalo para futuras compras.'
                      : '¿Es un cliente frecuente? Puedes registrarlo sin salir de esta venta.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRegistrarClienteDesdeVenta}
                    disabled={registrando || registrandoCliente}
                    className="shrink-0"
                  >
                    {registrandoCliente ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mostrandoRegistroCliente ? (
                      'Guardar cliente'
                    ) : (
                      'Registrar como cliente'
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border p-3">
              <Checkbox
                id="requiereFacturaElectronica"
                checked={requiereFacturaElectronica}
                onCheckedChange={(valor) => setRequiereFacturaElectronica(valor === true)}
                disabled={registrando}
              />
              <div className="space-y-1">
                <Label htmlFor="requiereFacturaElectronica" className="cursor-pointer">
                  Solicitar factura electrónica
                </Label>
                <p className="text-sm text-muted-foreground">
                  {modoComprador === 'sinRegistro'
                    ? 'El comprador quedará registrado como cliente con estos datos.'
                    : 'Queda pendiente de envío a la DIAN; no se transmite automáticamente.'}
                </p>
              </div>
            </div>

            {requiereFacturaElectronica &&
              (modoComprador === 'sinRegistro' || !clienteSeleccionado?.tieneDatosFacturacionElectronicaCompletos) && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-navy">Datos para factura electrónica</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tipoDocumentoFiscalVenta">Tipo de documento</Label>
                      <Select
                        value={datosFactura.tipoDocumentoFiscal}
                        onValueChange={(valor) =>
                          setDatosFactura((previo) => ({ ...previo, tipoDocumentoFiscal: valor as TipoDocumentoFiscal }))
                        }
                      >
                        <SelectTrigger id="tipoDocumentoFiscalVenta" disabled={registrando}>
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposDocumentoFiscal.map((tipo) => (
                            <SelectItem key={tipo.valor} value={tipo.valor}>
                              {tipo.etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numeroDocumentoFiscalVenta">Número de documento</Label>
                      <Input
                        id="numeroDocumentoFiscalVenta"
                        value={datosFactura.numeroDocumentoFiscal}
                        onChange={(e) =>
                          setDatosFactura((previo) => ({ ...previo, numeroDocumentoFiscal: e.target.value }))
                        }
                        disabled={registrando}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="razonSocialFiscalVenta">Razón social / nombre completo</Label>
                    <Input
                      id="razonSocialFiscalVenta"
                      value={datosFactura.razonSocialFiscal}
                      onChange={(e) => setDatosFactura((previo) => ({ ...previo, razonSocialFiscal: e.target.value }))}
                      disabled={registrando}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="direccionFiscalVenta">Dirección fiscal (opcional)</Label>
                      <Input
                        id="direccionFiscalVenta"
                        value={datosFactura.direccionFiscal}
                        onChange={(e) => setDatosFactura((previo) => ({ ...previo, direccionFiscal: e.target.value }))}
                        disabled={registrando}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailFacturacionVenta">Correo de facturación (opcional)</Label>
                      <Input
                        id="emailFacturacionVenta"
                        type="email"
                        value={datosFactura.emailFacturacion}
                        onChange={(e) => setDatosFactura((previo) => ({ ...previo, emailFacturacion: e.target.value }))}
                        disabled={registrando}
                      />
                    </div>
                  </div>
                </div>
              )}

            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de pago</Label>
              <Select value={metodoPago} onValueChange={(valor) => setMetodoPago(valor as MetodoPagoVenta)}>
                <SelectTrigger id="metodoPago" disabled={registrando}>
                  <SelectValue placeholder="Selecciona un método" />
                </SelectTrigger>
                <SelectContent>
                  {metodosPagoVenta.map((metodo) => (
                    <SelectItem key={metodo.valor} value={metodo.valor}>
                      {metodo.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {metodoPago === 'Efectivo' && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-text-muted">Total a cobrar</span>
                  <span className="font-heading text-xl font-bold text-navy">{formatoMoneda.format(total)}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="montoRecibido">Monto recibido</Label>
                  <Input
                    id="montoRecibido"
                    type="text"
                    inputMode="numeric"
                    value={formatearMiles(montoRecibido)}
                    onChange={(e) => setMontoRecibido(desformatearMiles(e.target.value))}
                    disabled={registrando}
                    required
                    className={cn(
                      'h-12 text-lg font-semibold',
                      montoRecibidoValido && montoRecibidoNumero < total && 'border-error-text focus-visible:ring-error-text'
                    )}
                  />
                </div>

                {total > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sugerirMontosRecibidos(total).map((sugerido) => (
                      <Button
                        key={sugerido}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={registrando}
                        onClick={() => setMontoRecibido(String(sugerido))}
                      >
                        {formatoMoneda.format(sugerido)}
                      </Button>
                    ))}
                  </div>
                )}

                <div
                  className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2',
                    !montoRecibidoValido
                      ? 'bg-muted text-text-muted'
                      : montoRecibidoNumero < total
                        ? 'bg-error-bg text-error-text'
                        : 'bg-green/10 text-green'
                  )}
                >
                  <span className="text-sm font-medium">
                    {!montoRecibidoValido ? 'Vueltas' : montoRecibidoNumero < total ? 'Falta' : 'Vueltas (cambio)'}
                  </span>
                  <span className="text-xl font-bold">
                    {!montoRecibidoValido
                      ? formatoMoneda.format(0)
                      : montoRecibidoNumero < total
                        ? formatoMoneda.format(total - montoRecibidoNumero)
                        : formatoMoneda.format(cambio ?? 0)}
                  </span>
                </div>
              </div>
            )}

            {metodoPago === 'Transferencia' && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm text-text-muted">
                  Antes de confirmar, verifica el comprobante o pantallazo del pago (Nequi u otra pasarela).
                </p>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox
                    checked={pagoTransferenciaRevisado}
                    onCheckedChange={(valor) => setPagoTransferenciaRevisado(valor === true)}
                    disabled={registrando}
                  />
                  <span className="text-sm font-medium text-navy">Confirmo que revisé el comprobante de pago</span>
                </label>
              </div>
            )}

            {metodoPago === 'Mixto' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Desglose del pago</Label>
                  <Button type="button" variant="outline" size="sm" onClick={agregarLineaDesglose} disabled={registrando}>
                    Agregar método
                  </Button>
                </div>

                {desglosePago.map((linea, indice) => (
                  <div key={indice} className="flex items-center gap-2">
                    <Select
                      value={linea.metodoPago}
                      onValueChange={(valor) => actualizarLineaDesglose(indice, 'metodoPago', valor)}
                    >
                      <SelectTrigger disabled={registrando} className="w-36 shrink-0" aria-label="Método de pago">
                        <SelectValue placeholder="Método" />
                      </SelectTrigger>
                      <SelectContent>
                        {metodosPago.map((metodo) => (
                          <SelectItem key={metodo.valor} value={metodo.valor}>
                            {metodo.etiqueta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatearMiles(linea.monto)}
                      onChange={(e) => actualizarLineaDesglose(indice, 'monto', desformatearMiles(e.target.value))}
                      disabled={registrando}
                      placeholder="Monto"
                      aria-label="Monto de la línea"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar línea del desglose"
                      onClick={() => quitarLineaDesglose(indice)}
                      disabled={registrando || desglosePago.length <= 2}
                    >
                      <Trash2 className="h-4 w-4 text-error-text" />
                    </Button>
                  </div>
                ))}

                <p className={cn('text-sm font-medium', desgloseCuadra ? 'text-navy' : 'text-error-text')}>
                  {desgloseCuadra
                    ? 'El desglose cuadra con el total.'
                    : diferenciaDesglose > 0
                      ? `Falta ${formatoMoneda.format(diferenciaDesglose)}`
                      : `Sobra ${formatoMoneda.format(-diferenciaDesglose)}`}
                </p>
              </div>
            )}

            {conflictoStock && (
              <div className="flex flex-col gap-2 rounded-md border border-gold bg-gold/10 px-3 py-2 text-sm text-navy" role="alert">
                <div>
                  <p className="font-semibold">Conflicto de stock</p>
                  <p>{conflictoStock}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleReintentarTrasConflicto}>
                  <RefreshCw className="h-4 w-4" />
                  Recargar productos
                </Button>
              </div>
            )}

            {errorFormulario && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorFormulario}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogFinalizarAbierto(false)} disabled={registrando}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={registrando}>
                {registrando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                {registrando ? 'Confirmando venta...' : 'Confirmar venta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mostrarConfirmacionCajon}
        onOpenChange={(abierto) => {
          setMostrarConfirmacionCajon(abierto);
          if (!abierto) {
            setPasswordCajon('');
            setErrorPasswordCajon(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar apertura de caja</DialogTitle>
            <DialogDescription>Ingresa tu contraseña de inicio de sesión para abrir el cajón.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmarPasswordCajon} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password-cajon">Contraseña</Label>
              <Input
                id="password-cajon"
                type="password"
                autoFocus
                value={passwordCajon}
                onChange={(e) => setPasswordCajon(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {errorPasswordCajon && (
              <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                {errorPasswordCajon}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMostrarConfirmacionCajon(false)}
                disabled={verificandoPasswordCajon}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={verificandoPasswordCajon}>
                {verificandoPasswordCajon && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                {verificandoPasswordCajon ? 'Verificando...' : 'Abrir caja'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DetalleFacturaDialog venta={ventaRecienCreada} open={facturaAbierta} onOpenChange={setFacturaAbierta} />
    </div>
  );
}
