import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import FixedNavbarWithLogo from './components/Navbar/FixedNavbarWithLogo';
import Footer from './components/Footer/Footer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { hasPermission, PERMISSIONS } from './config/api';
import 'bootstrap/dist/css/bootstrap.min.css';

const Login = lazy(() => import('./pages/auth/login'));
const FirstLoginPasswordChange = lazy(() => import('./pages/auth/FirstLoginPasswordChange'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Home = lazy(() => import('./pages/Home/Home'));
const Materiels = lazy(() => import('./pages/Materiels/Materiels'));
const HistoriqueMateriel = lazy(() => import('./pages/HistoriqueMateriel/HistoriqueMateriel'));
const MailInfo = lazy(() => import('./pages/MailInfo/MailInfo'));
const Mouvements = lazy(() => import('./pages/Stock_info/Mouvements'));
const HistoriqueArrivees = lazy(() => import('./pages/HistoriqueArrivees/HistoriqueArrivees'));
const ProduitLocaux = lazy(() => import('./pages/ProduitLocaux/ProduitLocaux'));
const TicketList = lazy(() => import('./pages/Tickets/TicketList'));
const EmailHome = lazy(() => import('./pages/email/EmailHome'));
const Documents = lazy(() => import('./pages/Documents/Documents'));

const AppLayout = () => {
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="app-shell">
      <FixedNavbarWithLogo />
      <main className="main-content-wrapper">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

// Défense en profondeur : le backend est déjà censé filtrer par permission,
// mais on évite ici qu'une route sensible reste accessible par simple saisie d'URL.
const RequirePermission = ({ permission, children }) => {
  const { user } = useAuth();

  if (permission && !hasPermission(user?.role, permission)) {
    return <Navigate to="/Home" replace />;
  }

  return children;
};

const RootRedirect = () => {
  return <Navigate to="/login" replace />;
};

const PageFallback = () => <div>Chargement...</div>;

function AppInner() {
  return (
    <Router>
      <div>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<FirstLoginPasswordChange />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<AppLayout />}>
              <Route path="/Home" element={<Home />} />
              <Route
                path="/Materiels"
                element={<RequirePermission permission={PERMISSIONS.MATERIELS_READ}><Materiels /></RequirePermission>}
              />
              <Route
                path="/HistoriqueMateriel"
                element={<RequirePermission permission={PERMISSIONS.MATERIELS_READ}><HistoriqueMateriel /></RequirePermission>}
              />
              <Route
                path="/MailInfo"
                element={<RequirePermission permission={PERMISSIONS.USERS_READ}><MailInfo /></RequirePermission>}
              />
              <Route
                path="/Mouvements"
                element={<RequirePermission permission={PERMISSIONS.STOCKS_READ}><Mouvements /></RequirePermission>}
              />
              <Route
                path="/HistoriqueArrivees"
                element={<RequirePermission permission={PERMISSIONS.STOCKS_READ}><HistoriqueArrivees /></RequirePermission>}
              />
              <Route
                path="/ProduitLocaux"
                element={<RequirePermission permission={PERMISSIONS.STOCKS_READ}><ProduitLocaux /></RequirePermission>}
              />
              <Route
                path="/Tickets"
                element={<RequirePermission permission={PERMISSIONS.TICKETS_READ}><TicketList /></RequirePermission>}
              />
              <Route
                path="/EmailHome"
                element={<RequirePermission permission={PERMISSIONS.CONFIG_READ}><EmailHome /></RequirePermission>}
              />
              <Route
                path="/Documents"
                element={<RequirePermission permission={PERMISSIONS.DOCUMENTS_READ}><Documents /></RequirePermission>}
              />
            </Route>

            <Route path="*" element={<div>Page non trouvée (Erreur 404)</div>} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
