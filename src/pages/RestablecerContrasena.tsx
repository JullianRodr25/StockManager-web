import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../services/api';
import { restablecerContrasena } from '../services/authService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RestablecerContrasena() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      await restablecerContrasena({ token, nuevaPassword });
      toast.success('Contraseña actualizada. Ya podés iniciar sesión.');
      navigate('/login', { replace: true });
    } catch (err) {
      // El backend responde 400 si el enlace es inválido o expiró.
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center">
          <Card className="w-full border-border bg-card/95 shadow-xl">
            <CardContent className="space-y-4 pt-6 text-center">
              <p className="text-sm text-text-muted">
                Este enlace no es válido. Solicitá uno nuevo desde la pantalla de inicio de sesión.
              </p>
              <Link to="/olvide-contrasena" className="block text-sm text-gold hover:underline">
                Solicitar un nuevo enlace
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center">
        <Card className="w-full border-border bg-card/95 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl text-navy">Restablecer contraseña</CardTitle>
            <CardDescription>Elegí una nueva contraseña para tu cuenta.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nuevaPassword" className="text-navy">
                  Nueva contraseña
                </Label>
                <Input
                  id="nuevaPassword"
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarPassword" className="text-navy">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmarPassword"
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" variant="gold" className="w-full font-heading text-sm uppercase tracking-wide" disabled={enviando}>
                {enviando ? 'Guardando...' : 'Guardar nueva contraseña'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
