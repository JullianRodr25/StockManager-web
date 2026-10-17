import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLogo } from '../context/LogoContext';
import { ApiError } from '../services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { FondoAurora } from '@/components/layout/FondoAurora';

export function Login() {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { login } = useAuth();
  const { logoUrl } = useLogo();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await login(identificador, password);
      navigate('/', { replace: true });
    } catch (err) {
      // El backend siempre devuelve el mismo mensaje genérico para
      // credenciales inválidas (por diseño, para no filtrar si el
      // identificador existe o no) — se muestra tal cual.
      const mensaje =
        err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-8">
      <FondoAurora />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center">
        <Card className="w-full border-0">
          <CardHeader className="space-y-4">
            <img
              src={logoUrl}
              alt="Logo de Ferretería Gold"
              className="mx-auto h-16 w-16 rounded-full border-2 border-primary object-cover shadow-[0_0_28px_var(--glow)]"
            />
            <div className="space-y-1 text-center">
              <CardTitle className="text-3xl text-foreground">Ferretería Gold</CardTitle>
              <CardDescription>Acceso para empleados de Ferretería Gold</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identificador" className="text-foreground">
                  Cédula o correo
                </Label>
                <Input
                  id="identificador"
                  type="text"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Contraseña
                </Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <Link to="/olvide-contrasena" className="block text-right text-xs text-gold-text hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" variant="gold" className="h-11 w-full font-heading text-sm font-extrabold uppercase tracking-wide" disabled={enviando}>
                {enviando ? 'Ingresando...' : 'Ingresar'}
              </Button>

              <p className="text-center text-xs tracking-widest text-text-muted">
                SERVICIOS, SUMINISTROS Y SOLUCIONES
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
