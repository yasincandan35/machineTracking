import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { api } from "../utils/api";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  try {
    const response = await api.post("/api/auth/login", {
      username,
      password,
    });

    console.log("🔐 Login API'den gelen veri:", response.data); // ← Burası önemli!

    login(response.data, rememberMe);
    navigate("/");
  } catch (err) {
    setError("Kullanıcı adı veya şifre hatalı.");
  }
};

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-red-500">EGEM Dashboard</h2>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="mb-4">
          <label className="block mb-1 text-sm">Kullanıcı Adı</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 text-sm">Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        <div className="flex items-center mb-6">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => setRememberMe(!rememberMe)}
            className="mr-2"
          />
          <span className="text-sm">Beni hatırla</span>
        </div>

        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 transition-colors py-2 rounded font-semibold"
        >
          Giriş Yap
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
