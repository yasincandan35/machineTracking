import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const AdminRoute = () => {
  const { user } = useAuth();

  // Kullanıcı yoksa ya da admin değilse → login'e at
  if (!user || user.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  // admin ise erişim ver
  return <Outlet />;
};

export default AdminRoute;
