import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LogoProvider } from './context/LogoContext';
import { RutaProtegida } from './components/RutaProtegida';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inventario } from './pages/Inventario';
import { EtiquetasPendientes } from './pages/EtiquetasPendientes';
import { Configuracion } from './pages/Configuracion';
import { PaginaProximamente } from './pages/PaginaProximamente';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <BrowserRouter>
      <LogoProvider>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RutaProtegida>
                  <AppLayout />
                </RutaProtegida>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route
                path="/inventario/etiquetas"
                element={
                  <RutaProtegida rolesPermitidos={['Admin']}>
                    <EtiquetasPendientes />
                  </RutaProtegida>
                }
              />
              <Route path="/ventas" element={<PaginaProximamente titulo="Ventas" />} />
              <Route path="/pedidos" element={<PaginaProximamente titulo="Pedidos" />} />
              <Route path="/clientes" element={<PaginaProximamente titulo="Clientes" />} />
              <Route path="/proveedores" element={<PaginaProximamente titulo="Proveedores" />} />
              <Route path="/reportes" element={<PaginaProximamente titulo="Reportes" />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Route>
          </Routes>
        </AuthProvider>
      </LogoProvider>
    </BrowserRouter>
  );
}

export default App;


