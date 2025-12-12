import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const PrivateRoute = () => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <div className="text-center mt-10 text-lg">Yükleniyor...</div>; // veya bir spinner
  }

  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
