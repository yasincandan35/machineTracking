import React, { useEffect, useState, useCallback } from "react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "user",
  });

  const { token, refreshCount } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/api/auth/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data);
    } catch (err) {
      console.error("Kullanıcılar alınamadı:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Kullanıcıları otomatik offline yap (30 saniye aktif olmayanları)
  const markInactiveUsersOffline = () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    
    setUsers(prevUsers => 
      prevUsers.map(user => {
        if (user.isOnline && user.lastSeen) {
          const lastSeen = new Date(user.lastSeen);
          if (lastSeen < thirtySecondsAgo) {
            return { ...user, isOnline: false };
          }
        }
        return user;
      })
    );
  };

  // Her 10 saniyede bir offline kullanıcıları kontrol et
  useEffect(() => {
    const interval = setInterval(markInactiveUsersOffline, 10 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers, refreshCount]); // refreshCount değişince de yenile

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    try {
      await api.post("/api/auth/register", newUser);
      setFormSuccess("Kullanıcı başarıyla eklendi.");
      setNewUser({ username: "", password: "", email: "", role: "user" });
      fetchUsers();
    } catch (err) {
      setFormError("Kullanıcı eklenemedi. Belki kullanıcı adı zaten kayıtlıdır?");
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/api/auth/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchUsers();
    } catch (err) {
      console.error("Silme hatası:", err);
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      await api.put(`/api/auth/users/${id}/role`, JSON.stringify(newRole), {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      fetchUsers();
    } catch (err) {
      console.error("Rol güncelleme hatası:", err);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await api.patch(`/api/auth/users/${id}/toggle-active`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchUsers();
    } catch (err) {
      console.error("Aktiflik güncelleme hatası:", err);
    }
  };

  return (
    <div className="w-full">
      <div className="p-6 w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Yönetici Paneli</h1>

        {/* Kullanıcı Ekleme Formu */}
        <form onSubmit={handleAddUser} className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Yeni Kullanıcı Ekle</h2>
          {formError && <p className="text-red-600 dark:text-red-400 mb-2">{formError}</p>}
          {formSuccess && <p className="text-green-600 dark:text-green-400 mb-2">{formSuccess}</p>}
          <div className="flex flex-col md:flex-row gap-4">
            <input type="text" placeholder="Kullanıcı Adı" value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex-1 text-gray-900 dark:text-white" required />
            <input type="email" placeholder="E-posta" value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex-1 text-gray-900 dark:text-white" required />
            <input type="password" placeholder="Şifre" value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 flex-1 text-gray-900 dark:text-white" required />
            <select value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white">Ekle</button>
          </div>
        </form>

        {/* Kullanıcı Listesi */}
        {loading ? (
          <p className="text-gray-700 dark:text-gray-300">Kullanıcılar yükleniyor...</p>
        ) : (
          <table className="w-full table-auto bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
            <thead className="bg-red-600">
              <tr>
                <th className="px-4 py-2 text-left text-white">Kullanıcı Adı</th>
                <th className="px-4 py-2 text-left text-white">E-posta</th>
                <th className="px-4 py-2 text-left text-white">Rol</th>
                <th className="px-4 py-2 text-left text-white">Durum</th>
                <th className="px-4 py-2 text-left text-white">Oluşturulma</th>
                <th className="px-4 py-2 text-left text-white">Son Giriş</th>
                <th className="px-4 py-2 text-left text-white">Son Görülme</th>
                <th className="px-4 py-2 text-left text-white">Aktif</th>
                <th className="px-4 py-2 text-left text-white">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{user.username}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{user.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.isOnline 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {user.isOnline ? '🟢 Online' : '⚫ Offline'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString('tr-TR') : ''}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString('tr-TR') : 'Hiç giriş yapmamış'}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    {user.lastSeen ? new Date(user.lastSeen).toLocaleString('tr-TR') : 'Son görülmedi'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleToggleActive(user.id)}
                      className={`px-3 py-1 rounded text-white ${user.isActive ? "bg-green-600" : "bg-gray-600"}`}
                    >
                      {user.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="bg-red-500 hover:bg-red-600 px-3 py-1 text-sm rounded text-white"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
