import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ColorProvider } from "./contexts/ColorContext";
import PrivateRoute from "./routes/PrivateRoute";
import AdminRoute from "./routes/AdminRoute";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel"; // admin sayfan varsa
import RegisterPage from './pages/RegisterPage';


function App() {
  return (
    <AuthProvider>
      <ColorProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            {/* Giriş yapılmadan erişilebilen tek sayfa */}
            <Route path="/login" element={<LoginPage />} />

            {/* Giriş yapmış herkes */}
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<Dashboard />} />

              {/* Sadece admin olanlar */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPanel />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ColorProvider>
    </AuthProvider>
  );
}

export default App;
