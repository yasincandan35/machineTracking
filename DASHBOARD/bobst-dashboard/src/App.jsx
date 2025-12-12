import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ColorProvider } from "./contexts/ColorContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { PushNotificationProvider } from "./contexts/PushNotificationContext";
import NotificationContainer from "./components/Notification";
import PrivateRoute from "./routes/PrivateRoute";
import AdminRoute from "./routes/AdminRoute";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel"; // admin sayfan varsa
import RegisterPage from './pages/RegisterPage';
import ShiftManagement from './pages/ShiftManagement';
import MachineScreenPage from './pages/MachineScreenPage';
import MaintenancePage from './components/MaintenancePage';

// Bakım modunu açmak/kapatmak için bu flag'i değiştirin
const MAINTENANCE_MODE = false; // false yaparak normal moda dönebilirsiniz

function App() {
  // Bakım modu aktifse sadece bakım sayfasını göster
  if (MAINTENANCE_MODE) {
    return <MaintenancePage />;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <ColorProvider>
          <NotificationProvider>
            <PushNotificationProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/register" element={<RegisterPage />} />
                {/* Giriş yapılmadan erişilebilen tek sayfa */}
                <Route path="/login" element={<LoginPage />} />

                {/* Giriş yapmış herkes */}
                <Route element={<PrivateRoute />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/machine-screen" element={<MachineScreenPage />} />

                  {/* Sadece admin olanlar */}
                  <Route element={<AdminRoute />}>
                    <Route path="/admin" element={<AdminPanel />} />
                  </Route>
                </Route>
              </Routes>
              <NotificationContainer />
            </BrowserRouter>
            </PushNotificationProvider>
          </NotificationProvider>
        </ColorProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
