import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Login from './pages/auth/login';
import FirstLoginPasswordChange from './pages/auth/FirstLoginPasswordChange';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import FixedNavbarWithLogo from './components/Navbar/FixedNavbarWithLogo'; 
import Home from './pages/Home/Home';
import Materiels from './pages/Materiels/Materiels';
import HistoriqueMateriel from './pages/HistoriqueMateriel/HistoriqueMateriel';
import MailInfo from './pages/MailInfo/MailInfo';
import Mouvements from './pages/Stock_info/Mouvements';
import HistoriqueArrivees from './pages/HistoriqueArrivees/HistoriqueArrivees';
import ProduitLocaux from './pages/ProduitLocaux/ProduitLocaux';
import TicketList from './pages/Tickets/TicketList';
import EmailHome from './pages/email/EmailHome';
import Documents from './pages/Documents/Documents';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css'; 

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
    <>
      <FixedNavbarWithLogo />
      <main className="main-content-wrapper">
        <Outlet />
      </main>
    </>
  );
};

const RootRedirect = () => {
  return <Navigate to="/login" replace />;
};

function AppInner() {
  return (
    <Router>
      <div> 
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<FirstLoginPasswordChange />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<AppLayout />}>
            <Route path="/Home" element={<Home />} />
            <Route path="/Materiels" element={<Materiels />} />
            <Route path="/HistoriqueMateriel" element={<HistoriqueMateriel />} />
            <Route path="/MailInfo" element={<MailInfo />} />
            <Route path="/Mouvements" element={<Mouvements />} />
            <Route path="/HistoriqueArrivees" element={<HistoriqueArrivees />} />
            <Route path="/ProduitLocaux" element={<ProduitLocaux />} />
            <Route path="/Tickets" element={<TicketList />} />
            <Route path="/EmailHome" element={<EmailHome />} />
            <Route path="/Documents" element={<Documents />} />
          </Route>
          
          <Route path="*" element={<div>Page non trouvée (Erreur 404)</div>} />
        </Routes>
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
