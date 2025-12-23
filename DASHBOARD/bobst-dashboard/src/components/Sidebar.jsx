import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Home, Settings, Plus, ClipboardList, Shield, User, LogOut, Database, MessageSquare, Clock, FileText, BarChart3, ThermometerSun, Monitor, Wrench, Calendar } from "lucide-react";
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

const Sidebar = ({ current, onChange = () => {}, isHovered, setIsHovered, backgroundColor = '#1f2937', isLiquidGlass: isLiquidGlassProp = false, currentLanguage = 'tr', isMobileMenuOpen = false, onMobileMenuClose = () => {} }) => {
  const { user, logout } = useAuth();
  const { theme, isFluid, isLiquidGlass, liquidGlassVariant } = useTheme();
  const isLiquidGlassSilver = isLiquidGlass && liquidGlassVariant === 'silver';
  const navigate = useNavigate();
  const sidebarWidth = isHovered ? "15rem" : "4.5rem";
  const desktopOverflowClass = isHovered ? "overflow-y-auto" : "overflow-y-hidden";
  const mobileOverflowClass = isMobileMenuOpen ? "overflow-y-auto" : "overflow-y-hidden";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const allowedSections = user?.roleSettings?.allowedSections;
  const isSectionAllowed = (sectionKey) =>
    !allowedSections || allowedSections.length === 0 || allowedSections.includes(sectionKey);

  const menuItems = [
    { key: "home", icon: Home, label: "home", action: () => onChange("home") },
    { key: "analysis", icon: BarChart3, label: "analysis", action: () => onChange("analysis") },
    { key: "reports", icon: ClipboardList, label: "reports", action: () => onChange("reports") },
    { key: "feedback", icon: MessageSquare, label: "feedback", action: () => onChange("feedback") },
    { key: "projectTimeline", icon: Clock, label: "projectTimeline", action: () => onChange("projectTimeline") },
    { key: "temperatureHumidity", icon: ThermometerSun, label: "temperatureHumidity", action: () => onChange("temperatureHumidity") },
    { key: "settings", icon: Settings, label: "settings", action: () => onChange("settings") },
    { key: "add", icon: Plus, label: "add", action: () => onChange("add") },
    { key: "profile", icon: User, label: "profile", action: () => onChange("profile") },
    { key: "jobPassport", icon: FileText, label: "jobPassport", action: () => onChange("jobPassport") },
    { key: "maintenanceManual", icon: Wrench, label: "maintenanceManual", action: () => onChange("maintenanceManual") },
    { key: "maintenance", icon: Wrench, label: "maintenance", action: () => onChange("maintenance") },
          { key: "admin", icon: Shield, label: "adminPanel", action: () => onChange("admin") },
          { key: "database", icon: Database, label: "database", action: () => onChange("database") },
    { key: "shifts", icon: Clock, label: "shiftManagement", action: () => onChange("shifts") },
    { key: "machineScreen", icon: Monitor, label: "machineScreen", action: () => navigate("/machine-screen") },
  ];

  const visibleMenuItems = [];
  const seenKeys = new Set();
  menuItems.forEach((item) => {
    if (!seenKeys.has(item.key) && isSectionAllowed(item.key)) {
      seenKeys.add(item.key);
      visibleMenuItems.push(item);
    }
  });

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full ${isLiquidGlassSilver ? 'text-black' : 'text-white'} ${desktopOverflowClass} overflow-x-hidden z-50 transition-all duration-400 ease-in-out sidebar-desktop ${
          isFluid ? '' : isLiquidGlass ? 'glass-card' : ''
        }`}
        style={{ 
          width: sidebarWidth,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          ...(isFluid ? {
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          } : {
            backgroundColor: isLiquidGlass ? 'transparent' : backgroundColor
          })
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      <SidebarLogo />

      {visibleMenuItems.map(({ key, icon: Icon, label, action }) => (
        <button
          key={key}
          onClick={action}
          className={`w-full text-left flex items-center gap-2 p-6 transition-all duration-200 ${
            isFluid
              ? (current === key 
                ? "bg-white/20 backdrop-blur-sm border-l-4 border-cyan-400" 
                : "hover:bg-white/10 hover:backdrop-blur-sm")
              : isLiquidGlass 
                ? (current === key 
                  ? "bg-white/20 backdrop-blur-sm border-l-4 border-blue-400" 
                  : "hover:bg-white/10 hover:backdrop-blur-sm")
                : (current === key ? "bg-gray-700" : "hover:bg-gray-800")
          }`}
        >
          <Icon className="w-6 h-6" />
          {isHovered && <span>{getTranslation(label, currentLanguage)}</span>}
        </button>
      ))}

      <button
        onClick={handleLogout}
        className={`w-full text-left flex items-center gap-2 p-6 mt-auto transition-all duration-200 ${
          isFluid
            ? "hover:bg-red-500/20 hover:backdrop-blur-sm hover:border-l-4 hover:border-red-400"
            : isLiquidGlass 
              ? "hover:bg-red-500/20 hover:backdrop-blur-sm hover:border-l-4 hover:border-red-400" 
              : "hover:bg-red-800"
        }`}
      >
        <LogOut className="w-6 h-6" />
        {isHovered && <span>{getTranslation('logout', currentLanguage)}</span>}
      </button>
      </div>
      
      {/* Mobile Sidebar - Sadece CSS ile kontrol edilir */}
      <div
        className={`fixed left-0 top-0 h-full ${isLiquidGlassSilver ? 'text-black' : 'text-white'} ${mobileOverflowClass} overflow-x-hidden z-50 transition-all duration-400 ease-in-out sidebar-mobile ${
          isFluid ? '' : isLiquidGlass ? 'glass-card' : ''
        }`}
        style={{ 
          width: "4rem",
          paddingTop: 'env(safe-area-inset-top, 0px)',
          ...(isFluid ? {
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          } : {
            backgroundColor: isLiquidGlass ? 'transparent' : backgroundColor
          })
        }}
      >
        <div className="sidebar-logo">
          <SidebarLogo />
        </div>

        {visibleMenuItems.map(({ key, icon: Icon, label, action }) => (
          <button
            key={key}
            onClick={() => {
              action();
              onMobileMenuClose();
            }}
            className={`w-full text-left flex items-center gap-2 p-6 transition-all duration-200 ${
              isFluid
                ? (current === key 
                  ? "bg-white/20 backdrop-blur-sm border-l-4 border-cyan-400" 
                  : "hover:bg-white/10 hover:backdrop-blur-sm")
                : isLiquidGlass 
                  ? (current === key 
                    ? "bg-white/20 backdrop-blur-sm border-l-4 border-blue-400" 
                    : "hover:bg-white/10 hover:backdrop-blur-sm")
                  : (current === key ? "bg-gray-700" : "hover:bg-gray-800")
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="menu-text">{getTranslation(label, currentLanguage)}</span>
          </button>
        ))}

        <button
          onClick={() => {
            handleLogout();
            onMobileMenuClose();
          }}
          className={`w-full text-left flex items-center gap-2 p-6 mt-auto transition-all duration-200 ${
            isFluid
              ? "hover:bg-red-500/20 hover:backdrop-blur-sm hover:border-l-4 hover:border-red-400"
              : isLiquidGlass 
                ? "hover:bg-red-500/20 hover:backdrop-blur-sm hover:border-l-4 hover:border-red-400" 
                : "hover:bg-red-800"
          }`}
        >
          <LogOut className="w-6 h-6" />
          <span className="menu-text">{getTranslation('logout', currentLanguage)}</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;