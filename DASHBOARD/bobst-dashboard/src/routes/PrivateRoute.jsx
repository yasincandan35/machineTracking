import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const PrivateRoute = () => {
  const { token, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="text-center mt-10 text-lg">Yükleniyor...</div>; // veya bir spinner
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Machine rolündeki kullanıcılar için "/" path'ine gidildiğinde machine-screen'e yönlendir
  if (user?.role === 'machine' && location.pathname === '/') {
    return <Navigate to="/machine-screen" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
