import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { api } from "../utils/api";
import VirtualKeyboard from "../machineScreen/src/components/VirtualKeyboard.jsx";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true); // Machine rolü için her zaman true olacak
  const [error, setError] = useState("");
  
  // Virtual Keyboard states
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState(null);
  const [keyboardValue, setKeyboardValue] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [keyboardMode, setKeyboardMode] = useState('full'); // 'number' | 'full'
  
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const navigate = useNavigate();
  const { login } = useAuth();

  // Mobil cihaz kontrolü (telefon değil, tablet/büyük ekran)
  const isTabletOrLargeTouch = () => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 768; // 768px altı mobil
    const isPhone = isMobile && isSmallScreen;
    
    // Sadece tablet veya büyük dokunmatik ekranlarda aç (telefon değil)
    return hasTouch && !isPhone;
  };

  // Virtual Keyboard functions
  const openVirtualKeyboard = (target, currentValue = '', event) => {
    // Mobil telefonlarda açma
    if (!isTabletOrLargeTouch()) {
      return; // Telefonun kendi klavyesi açılsın
    }
    
    // Klavyeyi ekranın alt kısmına sabitle
    setKeyboardPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight - 50 // Ekranın altına yerleştir
    });
    setKeyboardTarget(target);
    setKeyboardValue(currentValue);
    setKeyboardMode('full'); // Login için full keyboard
    setShowVirtualKeyboard(true);
  };

  const closeVirtualKeyboard = () => {
    setShowVirtualKeyboard(false);
    setKeyboardTarget(null);
    setKeyboardValue('');
  };

  const handleKeyboardInput = (value, shouldClose = false) => {
    if (keyboardTarget === 'username') {
      setUsername(value);
      setKeyboardValue(value); // Klavye değerini güncelle
    } else if (keyboardTarget === 'password') {
      setPassword(value);
      setKeyboardValue(value); // Klavye değerini güncelle
    }
    
    if (shouldClose) {
      closeVirtualKeyboard();
    }
  };
  
  // Klavye açıldığında mevcut değeri set et
  useEffect(() => {
    if (showVirtualKeyboard) {
      if (keyboardTarget === 'username') {
        setKeyboardValue(username);
      } else if (keyboardTarget === 'password') {
        setKeyboardValue(password);
      }
    }
  }, [showVirtualKeyboard, keyboardTarget, username, password]);

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  closeVirtualKeyboard(); // Klavyeyi kapat

  try {
    const response = await api.post("/auth/login", {
      username,
      password,
    });

    console.log("🔐 Login API'den gelen veri:", response.data); // ← Burası önemli!

    // Machine rolü için rememberMe her zaman true
    const shouldRemember = response.data.role === "machine" ? true : rememberMe;
    login(response.data, shouldRemember);
    if (response.data.role === "machine") {
      navigate("/machine-screen");
    } else {
      navigate("/");
    }
  } catch (err) {
    setError("Kullanıcı adı veya şifre hatalı.");
  }
};

  return (
    <div 
      className="min-h-screen bg-gray-900 text-white flex items-center justify-center"
      style={{ width: '100vw', margin: 0, padding: 0, overflowX: 'hidden' }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-red-500">EGEM Dashboard</h2>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="mb-4">
          <label className="block mb-1 text-sm">Kullanıcı Adı</label>
          <input
            ref={usernameRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={(e) => {
              // Sadece tablet/büyük dokunmatik ekranlarda sanal klavye aç
              if (isTabletOrLargeTouch()) {
                e.preventDefault();
                openVirtualKeyboard('username', username, e);
              }
            }}
            className="w-full p-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 text-sm">Şifre</label>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={(e) => {
              // Sadece tablet/büyük dokunmatik ekranlarda sanal klavye aç
              if (isTabletOrLargeTouch()) {
                e.preventDefault();
                openVirtualKeyboard('password', password, e);
              }
            }}
            className="w-full p-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        {/* Machine rolü için remember me checkbox'ı gizle - her zaman aktif */}
        {username.toLowerCase() !== "lemanic3" && (
          <div className="flex items-center mb-6">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
              className="mr-2"
            />
            <span className="text-sm">Beni hatırla</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 transition-colors py-2 rounded font-semibold"
        >
          Giriş Yap
        </button>
      </form>
      
      {/* Virtual Keyboard */}
      <VirtualKeyboard
        isVisible={showVirtualKeyboard}
        onClose={closeVirtualKeyboard}
        onInput={handleKeyboardInput}
        currentValue={keyboardValue}
        placeholder={keyboardTarget === 'username' ? 'Kullanıcı Adı' : 'Şifre'}
        mode={keyboardMode}
        position={keyboardPosition}
        onSwitchMode={(newMode) => {
          setKeyboardMode(newMode);
          setShowVirtualKeyboard(true);
        }}
      />
      
      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-gray-500 text-sm">Designed & Developed by YYC</p>
      </div>
    </div>
  );
};

export default LoginPage;
