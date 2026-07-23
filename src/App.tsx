import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RutaProtegida } from './components/RutaProtegida';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PaginaProximamente } from './pages/PaginaProximamente';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route path="/inventario" element={<PaginaProximamente titulo="Inventario" />} />
            <Route path="/ventas" element={<PaginaProximamente titulo="Ventas" />} />
            <Route path="/pedidos" element={<PaginaProximamente titulo="Pedidos" />} />
            <Route path="/clientes" element={<PaginaProximamente titulo="Clientes" />} />
            <Route path="/proveedores" element={<PaginaProximamente titulo="Proveedores" />} />
            <Route path="/reportes" element={<PaginaProximamente titulo="Reportes" />} />
            <Route path="/configuracion" element={<PaginaProximamente titulo="Configuración" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

