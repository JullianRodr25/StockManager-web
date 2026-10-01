import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../services/api';
import { solicitarRecuperacion } from '../services/authService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function OlvideContrasena() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const respuesta = await solicitarRecuperacion({ email });
      // El backend responde con el mismo mensaje exista o no el email; se muestra tal cual,
      // sin distinguir casos, para no filtrar qué correos están registrados.
      setMensaje(respuesta.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center">
        <Card className="w-full border-border bg-card/95 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl text-navy">¿Olvidaste tu contraseña?</CardTitle>
            <CardDescription>
              Escribí tu correo y, si está registrado, te enviaremos un enlace para restablecerla.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {mensaje ? (
              <div className="space-y-4">
                <div className="rounded-md border border-green/30 bg-green/10 px-3 py-2 text-sm text-navy" role="status">
                  {mensaje}
                </div>
                <Link to="/login" className="block text-center text-sm text-gold hover:underline">
                  Volver a iniciar sesión
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-navy">
                    Correo
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-error-bg px-3 py-2 text-sm text-error-text" role="alert">
                    {error}
                  </div>
                )}

                <Button type="submit" variant="gold" className="w-full font-heading text-sm uppercase tracking-wide" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar enlace'}
                </Button>

                <Link to="/login" className="block text-center text-sm text-text-muted hover:underline">
                  Volver a iniciar sesión
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
