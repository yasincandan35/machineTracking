import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../utils/api";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(""); // istersen kullanma
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await api.post("/api/auth/register", {
        username,
        password,
        email, // backend istiyorsa gönderilir
      });

      console.log("✅ Kayıt başarılı:", response.data);
      navigate("/login");
    } catch (err) {
      console.error("❌ Kayıt hatası:", err.response?.data || err.message);
      setError(err.response?.data?.message || "Kayıt sırasında bir hata oluştu.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-red-500">Kayıt Ol</h2>

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
          <label className="block mb-1 text-sm">E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1 text-sm">Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 transition-colors py-2 rounded font-semibold"
        >
          Kayıt Ol
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;
