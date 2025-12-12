import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Home, Settings, Plus, ClipboardList, Shield, User, LogOut, Database } from "lucide-react";
import { getTranslation } from "../utils/translations";

function SidebarLogo() {
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setBounce(true);
      setTimeout(() => setBounce(false), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex justify-center p-4 transition-transform ${bounce ? "animate-elasticBounce" : ""}`}>
      <img src="/logo.png" alt="Logo" className="w-10 h-10" />
    </div>
  );
}

const Sidebar = ({ current, onChange = () => {}, isHovered, setIsHovered, backgroundColor = '#1f2937', currentLanguage = 'tr' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const sidebarWidth = isHovered ? "15rem" : "4.5rem";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    { key: "home", icon: Home, label: "home", action: () => onChange("home") },
    { key: "reports", icon: ClipboardList, label: "reports", action: () => onChange("reports") },
    { key: "settings", icon: Settings, label: "settings", action: () => onChange("settings") },
    { key: "add", icon: Plus, label: "add", action: () => onChange("add") },
    { key: "profile", icon: User, label: "profile", action: () => navigate("/profile") },
    ...(user?.role === "admin"
      ? [
          { key: "admin", icon: Shield, label: "adminPanel", action: () => onChange("admin") },
          { key: "database", icon: Database, label: "database", action: () => onChange("database") }
        ]
      : []),
  ];

  return (
    <div
      className="fixed left-0 top-0 h-full text-white overflow-hidden z-50 transition-all duration-400 ease-in-out"
      style={{ 
        width: sidebarWidth,
        backgroundColor: backgroundColor
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <SidebarLogo />

      {menuItems.map(({ key, icon: Icon, label, action }) => (
        <button
          key={key}
          onClick={action}
          className={`w-full text-left flex items-center gap-2 p-6 ${current === key ? "bg-gray-700" : "hover:bg-gray-800"}`}
        >
          <Icon className="w-6 h-6" />
          {isHovered && <span>{getTranslation(label, currentLanguage)}</span>}
        </button>
      ))}

      <button
        onClick={handleLogout}
        className="w-full text-left flex items-center gap-2 p-6 hover:bg-red-800 mt-auto"
      >
        <LogOut className="w-6 h-6" />
        {isHovered && <span>{getTranslation('logout', currentLanguage)}</span>}
      </button>
    </div>
  );
};

export default Sidebar;