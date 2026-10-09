import { useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/services/api';
import { registrarEmpleado } from '@/services/authService';
import { ROLES_ASIGNABLES, etiquetaDeRol } from '@/utils/permisos';
import type { RolUsuario } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LONGITUD_MINIMA_PASSWORD = 8; // Igual que el backend (RegistrarEmpleadoRequest).

interface NuevoUsuarioCardProps {
  token: string | null;
}

interface FormularioUsuario {
  numeroIdentificacion: string;
  nombre: string;
  email: string;
  password: string;
  confirmacion: string;
  rol: RolUsuario;
}

const FORMULARIO_VACIO: FormularioUsuario = {
  numeroIdentificacion: '',
  nombre: '',
  email: '',
  password: '',
  confirmacion: '',
  rol: 'Empleado',
};

/** Valida en el cliente lo evidente para ahorrar un viaje; el backend vuelve a validar todo. */
function validar(f: FormularioUsuario): string | null {
  if (!f.numeroIdentificacion.trim() || !f.nombre.trim() || !f.email.trim()) {
    return 'Completa la identificación, el nombre y el correo.';
  }
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'El correo no tiene un formato válido.';
  if (f.password.length < LONGITUD_MINIMA_PASSWORD) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`;
  }
  if (f.password !== f.confirmacion) return 'Las contraseñas no coinciden.';
  return null;
}

/** Formulario para que un administrador cree usuarios del personal y elija su rol. */
export function NuevoUsuarioCard({ token }: NuevoUsuarioCardProps) {
  const [formulario, setFormulario] = useState<FormularioUsuario>(FORMULARIO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campo = <K extends keyof FormularioUsuario>(nombre: K, valor: FormularioUsuario[K]) =>
    setFormulario((actual) => ({ ...actual, [nombre]: valor }));

  const descripcionRol = ROLES_ASIGNABLES.find((r) => r.valor === formulario.rol)?.descripcion;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problema = validar(formulario);
    if (problema) {
      setError(problema);
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await registrarEmpleado(
        {
          numeroIdentificacion: formulario.numeroIdentificacion.trim(),
          nombre: formulario.nombre.trim(),
          email: formulario.email.trim(),
          password: formulario.password,
          rol: formulario.rol,
        },
        token
      );
      toast.success('Usuario creado', {
        description: `${formulario.nombre.trim()} · ${etiquetaDeRol(formulario.rol)}`,
      });
      setFormulario(FORMULARIO_VACIO);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-navy">Nuevo usuario</CardTitle>
        <CardDescription>
          Crea una cuenta para el personal y elige qué puede hacer. Inicia sesión con su identificación o su correo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="usuarioIdentificacion">Número de identificación</Label>
              <Input
                id="usuarioIdentificacion"
                value={formulario.numeroIdentificacion}
                onChange={(e) => campo('numeroIdentificacion', e.target.value)}
                disabled={guardando}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuarioNombre">Nombre</Label>
              <Input
                id="usuarioNombre"
                value={formulario.nombre}
                onChange={(e) => campo('nombre', e.target.value)}
                disabled={guardando}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuarioEmail">Correo</Label>
            <Input
              id="usuarioEmail"
              type="email"
              value={formulario.email}
              onChange={(e) => campo('email', e.target.value)}
              disabled={guardando}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="usuarioPassword">Contraseña</Label>
              <PasswordInput
                id="usuarioPassword"
                value={formulario.password}
                onChange={(e) => campo('password', e.target.value)}
                disabled={guardando}
                autoComplete="new-password"
              />
              <p className="text-xs text-text-muted">Mínimo {LONGITUD_MINIMA_PASSWORD} caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usuarioConfirmacion">Confirmar contraseña</Label>
              <PasswordInput
                id="usuarioConfirmacion"
                value={formulario.confirmacion}
                onChange={(e) => campo('confirmacion', e.target.value)}
                disabled={guardando}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuarioRol">Rol</Label>
            <Select value={formulario.rol} onValueChange={(valor) => campo('rol', valor as RolUsuario)}>
              <SelectTrigger id="usuarioRol" disabled={guardando}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES_ASIGNABLES.map(({ valor }) => (
                  <SelectItem key={valor} value={valor}>
                    {etiquetaDeRol(valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {descripcionRol && <p className="text-xs text-text-muted">{descripcionRol}</p>}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="gold" disabled={guardando}>
              {guardando && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              Crear usuario
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
