import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { Key, Eye, EyeOff, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

const SECTION_OPTIONS = [
  { key: "home", label: "Ana Sayfa" },
  { key: "analysis", label: "Analiz" },
  { key: "reports", label: "Raporlar" },
  { key: "feedback", label: "Geri Bildirim" },
  { key: "projectTimeline", label: "Proje Zaman Çizelgesi" },
  { key: "temperatureHumidity", label: "Sıcaklık & Nem" },
  { key: "settings", label: "Ayarlar" },
  { key: "add", label: "Kart Ekle" },
  { key: "profile", label: "Profil" },
  { key: "jobPassport", label: "İş Pasaportu" },
  { key: "maintenanceManual", label: "Bakım Manuel" },
  { key: "maintenanceReports", label: "Bakım Raporları" },
  { key: "maintenanceAdmin", label: "Bakım Yönetimi" },
  { key: "admin", label: "Yönetim Paneli" },
  { key: "database", label: "Veritabanı" },
  { key: "shifts", label: "Vardiya Yönetimi" },
  { key: "machineScreen", label: "Makine Ekranı" }
];

const BASE_ALLOWED_SECTION_KEYS = ["home", "analysis", "reports", "feedback", "projectTimeline", "settings", "add", "profile"];
const ENGINEER_SECTION_KEYS = [...BASE_ALLOWED_SECTION_KEYS, "jobPassport", "database", "shifts"];
const SHIFT_ENGINEER_SECTION_KEYS = [...BASE_ALLOWED_SECTION_KEYS, "shifts"];
const TECHNICAL_SECTION_KEYS = [...BASE_ALLOWED_SECTION_KEYS, "database", "shifts"];
const QUALITY_SECTION_KEYS = [...BASE_ALLOWED_SECTION_KEYS, "temperatureHumidity"];
const ADMIN_SECTION_KEYS = SECTION_OPTIONS.map(section => section.key);
const MACHINE_SECTION_KEYS = ["machineScreen"];
const MAINTENANCE_STAFF_SECTION_KEYS = ["maintenanceManual", "profile"];
const MAINTENANCE_MANAGER_SECTION_KEYS = ["maintenanceManual", "maintenanceReports", "maintenanceAdmin", "profile"];

const getSectionLabel = (key) => SECTION_OPTIONS.find((section) => section.key === key)?.label || key;

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "user",
    assignedMachineId: "",
    isDemo: false,
  });
  const [activeTab, setActiveTab] = useState("users");
  const [notificationRecipients, setNotificationRecipients] = useState([]);
  const [notificationRecipientsLoading, setNotificationRecipientsLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [roleForm, setRoleForm] = useState({
    name: "",
    displayName: "",
    tokenLifetimeMinutes: "480",
    canCreateUsers: false,
    canDeleteUsers: false,
    canManageRoles: false,
    canUpdateWastageAfterQualityControl: false,
    allowedSections: [...BASE_ALLOWED_SECTION_KEYS],
  });
  const [roleFormError, setRoleFormError] = useState("");
  const [roleFormSuccess, setRoleFormSuccess] = useState("");
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [availableSections, setAvailableSections] = useState(SECTION_OPTIONS.map((section) => section.key));
  const sectionDisplayList = useMemo(() => {
    const known = SECTION_OPTIONS.filter((section) => availableSections.includes(section.key));
    const unknown = availableSections
      .filter((key) => !SECTION_OPTIONS.some((section) => section.key === key))
      .map((key) => ({ key, label: key }));
    return [...known, ...unknown];
  }, [availableSections]);

  useEffect(() => {
    setRoleForm((prev) => ({
      ...prev,
      allowedSections: prev.allowedSections.filter((section) =>
        availableSections.includes(section)
      ),
    }));
  }, [availableSections]);
  
  // Şifre yönetimi state'leri
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { token, refreshCount } = useAuth();

  // Sıralama state'leri
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc' | null

  // Sıralama fonksiyonu
  const handleSort = useCallback((column) => {
    if (sortColumn === column) {
      // Aynı kolona tıklandığında yön değiştir
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      // Yeni kolona tıklandığında artan sıralama
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const fallbackRoleOptions = useMemo(
    () => [
      { id: -1, name: "user", displayName: "User", tokenLifetimeMinutes: 480, allowedSections: [...BASE_ALLOWED_SECTION_KEYS] },
      { id: -2, name: "manager", displayName: "Manager", tokenLifetimeMinutes: 720, allowedSections: [...BASE_ALLOWED_SECTION_KEYS] },
      { id: -3, name: "engineer", displayName: "Engineer", tokenLifetimeMinutes: 480, allowedSections: [...ENGINEER_SECTION_KEYS] },
      { id: -4, name: "technical", displayName: "Technical", tokenLifetimeMinutes: 480, allowedSections: [...TECHNICAL_SECTION_KEYS] },
      { id: -5, name: "shiftengineer", displayName: "Vardiya Mühendisi", tokenLifetimeMinutes: 480, allowedSections: [...SHIFT_ENGINEER_SECTION_KEYS] },
      { id: -6, name: "qualityengineer", displayName: "Kalite Mühendisi", tokenLifetimeMinutes: 720, allowedSections: [...QUALITY_SECTION_KEYS] },
      { id: -7, name: "admin", displayName: "Admin", tokenLifetimeMinutes: 1440, allowedSections: [...ADMIN_SECTION_KEYS] },
      { id: -8, name: "machine", displayName: "Makine", tokenLifetimeMinutes: 43200, allowedSections: [...MACHINE_SECTION_KEYS] },
      { id: -9, name: "maintenanceStaff", displayName: "Bakım Personeli", tokenLifetimeMinutes: 480, allowedSections: [...MAINTENANCE_STAFF_SECTION_KEYS] },
      { id: -10, name: "maintenanceManager", displayName: "Bakım Müdürü/Mühendisi", tokenLifetimeMinutes: 720, allowedSections: [...MAINTENANCE_MANAGER_SECTION_KEYS] },
    ],
    []
  );

  const roleOptions = useMemo(() => {
    if (!roles || roles.length === 0) {
      return fallbackRoleOptions;
    }
    return roles
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((role) => {
        const fallback = fallbackRoleOptions.find((item) => item.name === role.name);
        const allowed = Array.isArray(role.allowedSections) && role.allowedSections.length > 0
          ? role.allowedSections
          : fallback?.allowedSections || BASE_ALLOWED_SECTION_KEYS;
        return {
          ...role,
          displayName: role.displayName || role.name,
          allowedSections: allowed,
        };
      });
  }, [roles, fallbackRoleOptions]);

  // Sıralanmış kullanıcı listesi (roleOptions'tan sonra tanımlanmalı)
  const sortedUsers = useMemo(() => {
    try {
      if (!users || !Array.isArray(users) || users.length === 0) {
        return [];
      }
      
      if (!sortColumn) {
        return users;
      }

      const sorted = [...users].sort((a, b) => {
        let aValue = a[sortColumn];
        let bValue = b[sortColumn];

        // Rol için displayName kullan
        if (sortColumn === 'role') {
          if (!roleOptions || !Array.isArray(roleOptions) || roleOptions.length === 0) {
            // roleOptions henüz yüklenmemişse normal string karşılaştırma yap
            return String(aValue || '').localeCompare(String(bValue || ''), 'tr-TR', { sensitivity: 'base' });
          }
          const aRole = roleOptions.find(r => r.name === a.role);
          const bRole = roleOptions.find(r => r.name === b.role);
          aValue = aRole?.displayName || aRole?.name || a.role || '';
          bValue = bRole?.displayName || bRole?.name || b.role || '';
          return aValue.localeCompare(bValue, 'tr-TR', { sensitivity: 'base' });
        }

        // Tarih alanları için Date objesi oluştur
        if (sortColumn === 'createdAt' || sortColumn === 'lastLogin' || sortColumn === 'lastSeen') {
          aValue = aValue ? new Date(aValue).getTime() : 0;
          bValue = bValue ? new Date(bValue).getTime() : 0;
          const diff = aValue - bValue;
          return diff;
        }

        // Boolean karşılaştırma (isOnline, isActive)
        if (sortColumn === 'isOnline' || sortColumn === 'isActive') {
          if (aValue === bValue) return 0;
          return aValue ? 1 : -1;
        }

        // String karşılaştırma
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue, 'tr-TR', { sensitivity: 'base' });
        }

        // Number karşılaştırma
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return aValue - bValue;
        }

        // Null/undefined kontrolü
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Varsayılan string karşılaştırma
        return String(aValue).localeCompare(String(bValue), 'tr-TR');
      });

      return sortDirection === 'desc' ? sorted.reverse() : sorted;
    } catch (error) {
      console.error('Sıralama hatası:', error);
      return users || [];
    }
  }, [users, sortColumn, sortDirection, roleOptions]);

  // Sıralama ikonu gösterme fonksiyonu
  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const resetRoleForm = useCallback(() => {
    const defaultSections = availableSections.length > 0 ? availableSections : BASE_ALLOWED_SECTION_KEYS;
    setRoleForm({
      name: "",
      displayName: "",
      tokenLifetimeMinutes: "480",
      canCreateUsers: false,
      canDeleteUsers: false,
      canManageRoles: false,
      canUpdateWastageAfterQualityControl: false,
      allowedSections: [...defaultSections],
    });
    setEditingRoleId(null);
    setRoleFormError("");
    setRoleFormSuccess("");
  }, [availableSections]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/auth/users");
      setUsers(response.data);
    } catch (err) {
      console.error("Kullanıcılar alınamadı:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleToggleSection = useCallback((sectionKey) => {
    setRoleForm((prev) => {
      const exists = prev.allowedSections.includes(sectionKey);
      const updated = exists
        ? prev.allowedSections.filter((key) => key !== sectionKey)
        : [...prev.allowedSections, sectionKey];
      return {
        ...prev,
        allowedSections: updated,
      };
    });
  }, []);

  const fetchMachines = useCallback(async () => {
    try {
      const response = await api.get("/machines");
      setMachines(response.data || []);
    } catch (err) {
      console.error("Makine listesi alınamadı:", err);
    } finally {
      setMachinesLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    setRolesError("");
    try {
      const response = await api.get("/rolesettings");
      const fetchedRoles = (response.data || []).map((role) => {
        const fallback = fallbackRoleOptions.find((item) => item.name === role.name);
        const allowed = Array.isArray(role.allowedSections) && role.allowedSections.length > 0
          ? role.allowedSections
          : fallback?.allowedSections || BASE_ALLOWED_SECTION_KEYS;
        return {
          ...role,
          allowedSections: allowed,
        };
      });
      // Eksik kalan varsayılan rolleri de ekle (özellikle bakım rolleri)
      const merged = [
        ...fetchedRoles,
        ...fallbackRoleOptions.filter((fallback) => !fetchedRoles.some((r) => r.name === fallback.name)),
      ];
      setRoles(merged);
    } catch (err) {
      console.error("Rol listesi alınamadı:", err);
      setRolesError("Roller yüklenirken hata oluştu.");
    } finally {
      setRolesLoading(false);
    }
  }, [fallbackRoleOptions]);

  const fetchAvailableSections = useCallback(async () => {
    try {
      const response = await api.get("/rolesettings/sections");
      if (Array.isArray(response.data) && response.data.length > 0) {
        const merged = [...new Set([...response.data, ...SECTION_OPTIONS.map((section) => section.key)])];
        setAvailableSections(merged);
      }
    } catch (err) {
      console.error("Sekme listesi alınamadı:", err);
    }
  }, []);

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

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchAvailableSections();
  }, [fetchAvailableSections]);

  useEffect(() => {
    if (
      newUser.role === "machine" &&
      (!newUser.assignedMachineId || newUser.assignedMachineId === "") &&
      machines.length > 0
    ) {
      setNewUser((prev) => ({
        ...prev,
        assignedMachineId:
          machines[0] && machines[0].id !== undefined && machines[0].id !== null
            ? String(machines[0].id)
            : "",
      }));
    }
  }, [newUser.role, newUser.assignedMachineId, machines]);

  useEffect(() => {
    if (roleOptions.length === 0) {
      return;
    }

    const hasRole = roleOptions.some((role) => role.name === newUser.role);
    if (!hasRole) {
      setNewUser((prev) => ({
        ...prev,
        role: roleOptions[0].name,
      }));
    }
  }, [roleOptions, newUser.role]);

  const editableRoles = useMemo(() => {
    if (!roles || roles.length === 0) {
      return [];
    }
    return roles
      .slice()
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
  }, [roles]);

  const formatTokenLifetime = useCallback((minutes) => {
    if (minutes === undefined || minutes === null || minutes === 0) {
      return "Sınırsız";
    }
    if (minutes < 60) {
      return `${minutes} dk`;
    }
    const hours = minutes / 60;
    if (hours < 24) {
      return `${hours % 1 === 0 ? hours : hours.toFixed(1)} saat`;
    }
    const days = hours / 24;
    return `${days % 1 === 0 ? days : days.toFixed(1)} gün`;
  }, []);

  const startEditRole = useCallback((role) => {
    if (!role) return;
    setEditingRoleId(role.id);
    const fallback = fallbackRoleOptions.find((item) => item.name === role.name);
    const allowed = Array.isArray(role.allowedSections) && role.allowedSections.length > 0
      ? role.allowedSections
      : fallback?.allowedSections || BASE_ALLOWED_SECTION_KEYS;
    setRoleForm({
      name: role.name,
      displayName: role.displayName || "",
      tokenLifetimeMinutes:
        role.tokenLifetimeMinutes === null || role.tokenLifetimeMinutes === undefined || role.tokenLifetimeMinutes === 0
          ? "0"
          : String(role.tokenLifetimeMinutes),
      canCreateUsers: Boolean(role.canCreateUsers),
      canDeleteUsers: Boolean(role.canDeleteUsers),
      canManageRoles: Boolean(role.canManageRoles),
      canUpdateWastageAfterQualityControl: Boolean(role.canUpdateWastageAfterQualityControl),
      allowedSections: allowed.filter((section) => availableSections.includes(section)),
    });
    setRoleFormError("");
    setRoleFormSuccess("");
  }, [availableSections, fallbackRoleOptions]);

  const handleRoleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setRoleFormError("");
      setRoleFormSuccess("");

      const trimmedName = (roleForm.name || "").trim().toLowerCase();
      if (!trimmedName) {
        setRoleFormError("Rol ismi boş olamaz.");
        return;
      }

      const trimmedDisplay = roleForm.displayName ? roleForm.displayName.trim() : "";

      const minutesValue = roleForm.tokenLifetimeMinutes === "" ? 0 : Number(roleForm.tokenLifetimeMinutes);
      if (Number.isNaN(minutesValue) || minutesValue < 0) {
        setRoleFormError("Token süresi 0 veya pozitif bir sayı olmalıdır.");
        return;
      }

      const sanitizedSections = (roleForm.allowedSections || []).filter((section) =>
        availableSections.includes(section)
      );
      if (sanitizedSections.length === 0) {
        setRoleFormError("En az bir sekme seçmelisiniz.");
        return;
      }

      const payload = {
        name: trimmedName,
        displayName: trimmedDisplay || undefined,
        tokenLifetimeMinutes: minutesValue,
        canCreateUsers: roleForm.canCreateUsers,
        canDeleteUsers: roleForm.canDeleteUsers,
        canManageRoles: roleForm.canManageRoles,
        canUpdateWastageAfterQualityControl: roleForm.canUpdateWastageAfterQualityControl,
        allowedSections: sanitizedSections,
      };

      try {
        if (editingRoleId) {
          await api.put(`/rolesettings/${editingRoleId}`, payload);
          setRoleFormSuccess("Rol güncellendi.");
        } else {
          await api.post("/rolesettings", payload);
          setRoleFormSuccess("Rol oluşturuldu.");
        }
        await fetchRoles();
        resetRoleForm();
      } catch (err) {
        console.error("Rol kaydedilemedi:", err.response?.data || err.message);
        const errorMsg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Rol kaydedilirken bir hata oluştu.";
        setRoleFormError(errorMsg);
      }
    },
    [editingRoleId, roleForm, fetchRoles, resetRoleForm, availableSections]
  );

  const handleRoleDelete = useCallback(
    async (role) => {
      if (!role || !role.id) return;
      if (!window.confirm(`${role.displayName || role.name} rolünü silmek istediğinize emin misiniz?`)) {
        return;
      }

      try {
        await api.delete(`/rolesettings/${role.id}`);
        await fetchRoles();
        if (editingRoleId === role.id) {
          resetRoleForm();
        }
      } catch (err) {
        console.error("Rol silinemedi:", err.response?.data || err.message);
        const message =
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Rol silinirken hata oluştu.";
        alert(message);
      }
    },
    [editingRoleId, fetchRoles, resetRoleForm]
  );

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    try {
      const selectedRole = newUser.role && newUser.role !== "" ? newUser.role : roleOptions[0]?.name || "user";

      const payload = {
        username: newUser.username.trim(),
        password: newUser.password,
        email: newUser.email.trim(),
        role: selectedRole,
        isDemo: Boolean(newUser.isDemo),
      };

      if (newUser.role === "machine") {
        const assignedId =
          newUser.assignedMachineId && newUser.assignedMachineId !== ""
            ? Number(newUser.assignedMachineId)
            : machines.length > 0 && machines[0] && machines[0].id !== undefined && machines[0].id !== null
            ? Number(machines[0].id)
            : NaN;

        if (assignedId === undefined || assignedId === null || Number.isNaN(assignedId)) {
          setFormError("Lütfen makine rolü için bir makine seçin.");
          return;
        }
        payload.assignedMachineId = assignedId;
      }

      const response = await api.post("/auth/register", payload);
      setFormSuccess(response.data?.message || "Kullanıcı başarıyla eklendi.");
      setNewUser({
        username: "",
        password: "",
        email: "",
        role: "user",
        assignedMachineId: "",
      });
      fetchUsers();
    } catch (err) {
      console.error("Kullanıcı ekleme hatası:", err.response?.data || err.message);
      const errorData = err.response?.data || {};
      const errorMsg = errorData.message || errorData.error || errorData.innerError || "Kullanıcı eklenemedi. Belki kullanıcı adı veya e-posta zaten kayıtlıdır?";
      console.error("Detaylı hata:", errorData.details || errorData);
      setFormError(errorMsg);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/auth/users/${id}`);
      fetchUsers();
    } catch (err) {
      console.error("Silme hatası:", err);
    }
  };

  const handleRoleChange = async (id, newRole, machineIdOverride = null) => {
    try {
      if (!newRole) {
        alert("Rol boş olamaz.");
        return;
      }
      const normalizedRole = newRole.toLowerCase();
      const payload = { role: normalizedRole };

      if (normalizedRole === "machine") {
        const machineId =
          machineIdOverride ??
          users.find((u) => u.id === id)?.assignedMachineId ??
          machines[0]?.id;

        if (machineId === undefined || machineId === null || Number.isNaN(Number(machineId))) {
          alert("Makine rolü için önce makine tanımlayın.");
          return;
        }
        payload.assignedMachineId = Number(machineId);
      }

      await api.put(`/auth/users/${id}/role`, payload);
      fetchUsers();
    } catch (err) {
      console.error("Rol güncelleme hatası:", err);
      alert("Rol güncellenirken hata oluştu.");
    }
  };

  const handleMachineAssign = async (id, machineId) => {
    if (machineId === undefined || machineId === null || Number.isNaN(Number(machineId))) {
      alert("Lütfen bir makine seçin.");
      return;
    }
    await handleRoleChange(id, "machine", Number(machineId));
  };

  const handleToggleActive = async (id) => {
    try {
      await api.patch(`/auth/users/${id}/toggle-active`);
      fetchUsers();
    } catch (err) {
      console.error("Aktiflik güncelleme hatası:", err);
    }
  };

  // Bildirim alıcılarını getir
  const fetchNotificationRecipients = useCallback(async (category = null) => {
    if (!token) return;
    setNotificationRecipientsLoading(true);
    try {
      const url = category 
        ? `/api/maintenance/notification-recipients?category=${category}`
        : "/api/maintenance/notification-recipients";
      const response = await api.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setNotificationRecipients(response.data || []);
    } catch (err) {
      console.error("Bildirim alıcıları alınamadı:", err);
    } finally {
      setNotificationRecipientsLoading(false);
    }
  }, [token]);

  // Bildirim alıcısı ekle
  const handleAddNotificationRecipient = async (userId, category) => {
    if (!token) return;
    try {
      await api.post(
        "/api/maintenance/notification-recipients",
        { userId, notificationCategory: category },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      fetchNotificationRecipients(category);
    } catch (err) {
      console.error("Bildirim alıcısı eklenemedi:", err);
      alert("Bildirim alıcısı eklenemedi. Kullanıcı zaten listede olabilir.");
    }
  };

  // Bildirim alıcısını kaldır
  const handleRemoveNotificationRecipient = async (id) => {
    if (!window.confirm("Bu kullanıcıyı bildirim alıcıları listesinden kaldırmak istediğinize emin misiniz?")) return;
    if (!token) return;
    try {
      await api.delete(`/api/maintenance/notification-recipients/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchNotificationRecipients(selectedNotificationCategory);
    } catch (err) {
      console.error("Bildirim alıcısı kaldırılamadı:", err);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Şifre en az 6 karakter olmalıdır!");
      return;
    }

    try {
      await api.put(`/auth/users/${selectedUserId}/password`, { newPassword });
      
      setShowPasswordModal(false);
      setNewPassword("");
      setSelectedUserId(null);
      alert("Şifre başarıyla güncellendi!");
    } catch (err) {
      console.error("Şifre güncelleme hatası:", err);
      alert("Şifre güncellenemedi!");
    }
  };

  const openPasswordModal = (userId, username) => {
    setSelectedUserId(userId);
    setShowPasswordModal(true);
    setNewPassword("");
  };

  return (
    <div className="w-full">
      <div className="p-3 sm:p-6 w-full max-w-full overflow-x-hidden">
        <h1 className="text-xl sm:text-2xl font-bold text-red-600 mb-4">Yönetici Paneli</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              activeTab === "users"
                ? "bg-red-600 text-white shadow"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Kullanıcı Yönetimi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              activeTab === "roles"
                ? "bg-red-600 text-white shadow"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Rol Yönetimi
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("maintenance-notifications");
              if (activeTab !== "maintenance-notifications") {
                fetchNotificationRecipients(selectedNotificationCategory);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
              activeTab === "maintenance-notifications"
                ? "bg-red-600 text-white shadow"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Bildirim Yönetimi
          </button>
        </div>

        {activeTab === "users" ? (
          <>
            <form onSubmit={handleAddUser} className="mb-6 bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white">Yeni Kullanıcı Ekle</h2>
              {formError && <p className="text-sm sm:text-base text-red-600 dark:text-red-400 mb-2">{formError}</p>}
              {formSuccess && <p className="text-sm sm:text-base text-green-600 dark:text-green-400 mb-2">{formSuccess}</p>}
              <div className="flex flex-col gap-3 sm:gap-4">
                <input
                  type="text"
                  placeholder="Kullanıcı Adı"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full p-2 sm:p-3 text-sm sm:text-base rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  required
                />
                <input
                  type="email"
                  placeholder="E-posta"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full p-2 sm:p-3 text-sm sm:text-base rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  required
                />
                <input
                  type="password"
                  placeholder="Şifre"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full p-2 sm:p-3 text-sm sm:text-base rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              autoComplete="new-password"
                  required
                />
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: e.target.value,
                      assignedMachineId:
                        e.target.value === "machine"
                          ? machines.length > 0 && machines[0] && machines[0].id !== undefined && machines[0].id !== null
                            ? String(machines[0].id)
                            : ""
                          : "",
                    }))
                  }
                  className="w-full p-2 sm:p-3 text-sm sm:text-base rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  {roleOptions.map((role) => (
                    <option key={role.name} value={role.name}>
                      {role.displayName || role.name}
                    </option>
                  ))}
                </select>
                {newUser.role === "machine" && (
                  <select
                    value={newUser.assignedMachineId}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        assignedMachineId: e.target.value,
                      }))
                    }
                    className="w-full p-2 sm:p-3 text-sm sm:text-base rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    disabled={machinesLoading || machines.length === 0}
                    required
                  >
                    <option value="">{machinesLoading ? "Makineler yükleniyor..." : "Makine seçin"}</option>
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.machineName}
                      </option>
                    ))}
                  </select>
                )}
                <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(newUser.isDemo)}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, isDemo: e.target.checked }))}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  Demo Hesap (iş bilgileri ve geri bildirim içerikleri maskelensin)
                </label>
                <button type="submit" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 px-4 py-2 sm:py-2.5 rounded text-white text-sm sm:text-base">
                  Ekle
                </button>
              </div>
            </form>

            {loading ? (
              <p className="text-gray-700 dark:text-gray-300">Kullanıcılar yükleniyor...</p>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full table-auto bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
                    <thead className="bg-red-600">
                      <tr>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('username')}
                          title="Kullanıcı adına göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Kullanıcı Adı
                            {getSortIcon('username')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('email')}
                          title="E-posta adresine göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            E-posta
                            {getSortIcon('email')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('role')}
                          title="Role göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Rol
                            {getSortIcon('role')}
                          </div>
                        </th>
                        <th className="px-4 py-2 text-left text-white">Makine</th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('isOnline')}
                          title="Duruma göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Durum
                            {getSortIcon('isOnline')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('createdAt')}
                          title="Oluşturulma tarihine göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Oluşturulma
                            {getSortIcon('createdAt')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('lastLogin')}
                          title="Son giriş tarihine göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Son Giriş
                            {getSortIcon('lastLogin')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('lastSeen')}
                          title="Son görülme tarihine göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Son Görülme
                            {getSortIcon('lastSeen')}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 text-left text-white cursor-pointer hover:bg-red-700 transition-colors select-none"
                          onClick={() => handleSort('isActive')}
                          title="Aktif duruma göre sırala"
                        >
                          <div className="flex items-center gap-2">
                            Aktif
                            {getSortIcon('isActive')}
                          </div>
                        </th>
                        <th className="px-4 py-2 text-left text-white">Şifre</th>
                        <th className="px-4 py-2 text-left text-white">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedUsers && Array.isArray(sortedUsers) && sortedUsers.length > 0 ? (
                        sortedUsers.filter(user => user && user.id).map((user) => (
                        <tr key={user.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 text-gray-900 dark:text-white">{user.username}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">{user.email}</td>
                          <td className="px-4 py-2">
                            <select
                              value={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                            >
                              {roleOptions.map((role) => (
                                <option key={role.name} value={role.name}>
                                  {role.displayName || role.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            {user.role === "machine" ? (
                              <select
                                value={user.assignedMachineId ?? ""}
                                onChange={(e) => handleMachineAssign(user.id, Number(e.target.value))}
                                className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                              >
                                <option value="">Makine seçin</option>
                                {machines.map((machine) => (
                                  <option key={machine.id} value={machine.id}>
                                    {machine.machineName}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.isOnline
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {user.isOnline ? "🟢 Online" : "⚫ Offline"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white text-sm">
                            {user.createdAt ? new Date(user.createdAt).toLocaleString("tr-TR") : ""}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white text-sm">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString("tr-TR") : "Hiç giriş yapmamış"}
                          </td>
                          <td className="px-4 py-2 text-gray-900 dark:text-white text-sm">
                            {user.lastSeen ? new Date(user.lastSeen).toLocaleString("tr-TR") : "Son görülmedi"}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => handleToggleActive(user.id)}
                              className={`px-3 py-1 rounded text-white text-sm ${user.isActive ? "bg-green-600" : "bg-gray-600"}`}
                            >
                              {user.isActive ? "Aktif" : "Pasif"}
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => openPasswordModal(user.id, user.username)}
                              className="bg-blue-500 hover:bg-blue-600 px-3 py-1 text-sm rounded text-white flex items-center gap-1"
                            >
                              <Key size={14} />
                              Şifre
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
                        ))
                      ) : (
                        <tr>
                          <td colSpan="11" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            Kullanıcı bulunamadı
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden space-y-4">
                  {sortedUsers && Array.isArray(sortedUsers) && sortedUsers.length > 0 ? (
                    sortedUsers.filter(user => user && user.id).map((user) => (
                      <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{user.username}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{user.email}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.isOnline
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {user.isOnline ? "🟢 Online" : "⚫ Offline"}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Rol:</span>
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm flex-1 max-w-[150px]"
                          >
                            {roleOptions.map((role) => (
                              <option key={role.name} value={role.name}>
                                {role.displayName || role.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {user.role === "machine" && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Makine:</span>
                            <select
                              value={user.assignedMachineId ?? ""}
                              onChange={(e) => handleMachineAssign(user.id, Number(e.target.value))}
                              className="bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm flex-1 max-w-[150px]"
                            >
                              <option value="">Makine seçin</option>
                              {machines.map((machine) => (
                                <option key={machine.id} value={machine.id}>
                                  {machine.machineName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Durum:</span>
                          <button
                            onClick={() => handleToggleActive(user.id)}
                            className={`px-3 py-1 rounded text-white text-xs ${user.isActive ? "bg-green-600" : "bg-gray-600"}`}
                          >
                            {user.isActive ? "Aktif" : "Pasif"}
                          </button>
                        </div>

                        {user.createdAt && (
                          <div className="flex flex-col">
                            <span className="text-gray-600 dark:text-gray-400">Oluşturulma:</span>
                            <span className="text-gray-900 dark:text-white text-xs mt-0.5">
                              {new Date(user.createdAt).toLocaleString("tr-TR")}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col">
                          <span className="text-gray-600 dark:text-gray-400">Son Giriş:</span>
                          <span className="text-gray-900 dark:text-white text-xs mt-0.5">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString("tr-TR") : "Hiç giriş yapmamış"}
                          </span>
                        </div>

                        {user.lastSeen && (
                          <div className="flex flex-col">
                            <span className="text-gray-600 dark:text-gray-400">Son Görülme:</span>
                            <span className="text-gray-900 dark:text-white text-xs mt-0.5">
                              {new Date(user.lastSeen).toLocaleString("tr-TR")}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => openPasswordModal(user.id, user.username)}
                          className="flex-1 bg-blue-500 hover:bg-blue-600 px-3 py-2 text-sm rounded text-white flex items-center justify-center gap-1"
                        >
                          <Key size={14} />
                          Şifre
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="flex-1 bg-red-500 hover:bg-red-600 px-3 py-2 text-sm rounded text-white"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                    ))
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center text-gray-500 dark:text-gray-400">
                      Kullanıcı bulunamadı
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{editingRoleId ? "Rolü Güncelle" : "Yeni Rol Oluştur"}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Token süresini dakika cinsinden belirleyebilirsin. 0 değeri sınırsız süre anlamına gelir.
              </p>
              {roleFormError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{roleFormError}</p>}
              {roleFormSuccess && <p className="text-sm text-green-600 dark:text-green-400 mb-2">{roleFormSuccess}</p>}

              <form onSubmit={handleRoleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol Anahtarı</label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          name: e.target.value.toLowerCase().replace(/\s+/g, ""),
                        }))
                      }
                      placeholder="örn: admin"
                      className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Görünen Ad</label>
                    <input
                      type="text"
                      value={roleForm.displayName}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      placeholder="örn: Admin"
                      className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token Süresi (dk)</label>
                    <input
                      type="number"
                      min="0"
                      value={roleForm.tokenLifetimeMinutes}
                      onChange={(e) =>
                        setRoleForm((prev) => ({
                          ...prev,
                          tokenLifetimeMinutes: e.target.value,
                        }))
                      }
                      className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Yetkiler</label>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm">
                        <input
                          type="checkbox"
                          checked={roleForm.canCreateUsers}
                          onChange={(e) =>
                            setRoleForm((prev) => ({
                              ...prev,
                              canCreateUsers: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Kullanıcı oluşturabilir
                      </label>
                      <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm">
                        <input
                          type="checkbox"
                          checked={roleForm.canDeleteUsers}
                          onChange={(e) =>
                            setRoleForm((prev) => ({
                              ...prev,
                              canDeleteUsers: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Kullanıcı silebilir
                      </label>
                      <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm">
                        <input
                          type="checkbox"
                          checked={roleForm.canManageRoles}
                          onChange={(e) =>
                            setRoleForm((prev) => ({
                              ...prev,
                              canManageRoles: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Rol tanımlarını yönetebilir
                      </label>
                      <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm">
                        <input
                          type="checkbox"
                          checked={roleForm.canUpdateWastageAfterQualityControl}
                          onChange={(e) =>
                            setRoleForm((prev) => ({
                              ...prev,
                              canUpdateWastageAfterQualityControl: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Kalite kontrol sonrası fire girişi yapabilir
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Görüntülenebilecek Sekmeler
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sectionDisplayList.map((section) => (
                      <label
                        key={section.key}
                        className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={roleForm.allowedSections.includes(section.key)}
                          onChange={() => handleToggleSection(section.key)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        {section.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm sm:text-base w-full sm:w-auto">
                    {editingRoleId ? "Güncelle" : "Rol Oluştur"}
                  </button>
                  {editingRoleId && (
                    <button
                      type="button"
                      onClick={resetRoleForm}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm sm:text-base w-full sm:w-auto"
                    >
                      İptal
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-lg shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tanımlı Roller</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tüm roller ve token süreleri listelenir.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchRoles}
                  className="px-3 py-2 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Yenile
                </button>
              </div>

              {rolesLoading ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Roller yükleniyor...</p>
              ) : rolesError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{rolesError}</p>
              ) : editableRoles.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Henüz tanımlanmış rol bulunmuyor.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {editableRoles.map((role) => (
                    <div key={role.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/40 flex flex-col gap-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">{role.displayName || role.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 break-all">Anahtar: {role.name}</p>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Token süresi: </span>
                        {formatTokenLifetime(role.tokenLifetimeMinutes)}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <p className="font-medium">Yetkiler:</p>
                        <ul className="text-xs space-y-1">
                          <li>{role.canCreateUsers ? "• Kullanıcı oluşturabilir" : "• Kullanıcı oluşturamaz"}</li>
                          <li>{role.canDeleteUsers ? "• Kullanıcı silebilir" : "• Kullanıcı silemez"}</li>
                          <li>{role.canManageRoles ? "• Rol tanımlarını yönetebilir" : "• Rol tanımlarını yönetemez"}</li>
                          <li>{role.canUpdateWastageAfterQualityControl ? "• Kalite kontrol sonrası fire girişi yapabilir" : "• Kalite kontrol sonrası fire girişi yapamaz"}</li>
                        </ul>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <p className="font-medium">Sekmeler:</p>
                        <div className="flex flex-wrap gap-1">
                          {(role.allowedSections && role.allowedSections.length > 0 ? role.allowedSections : ["(Tanımlı değil)"]).map((sectionKey) => (
                            <span
                              key={sectionKey}
                              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-full"
                            >
                              {sectionKey === "(Tanımlı değil)" ? sectionKey : getSectionLabel(sectionKey)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => startEditRole(role)}
                          className="flex-1 px-3 py-2 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleRoleDelete(role)}
                          className="flex-1 px-3 py-2 text-sm rounded bg-red-500 hover:bg-red-600 text-white"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "maintenance-notifications" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-lg shadow">
              <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Bildirim Alıcıları Yönetimi
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Her bildirim kategorisi için farklı kullanıcılar belirleyebilirsiniz.
              </p>

              {/* Kategori Seçimi */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bildirim Kategorisi
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "maintenance", label: "🔧 Bakım Bildirimleri" },
                    { value: "production", label: "🏭 Üretim Bildirimleri" },
                    { value: "quality", label: "✅ Kalite Bildirimleri" }
                  ].map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setSelectedNotificationCategory(cat.value);
                        fetchNotificationRecipients(cat.value);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedNotificationCategory === cat.value
                          ? "bg-blue-600 text-white shadow"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kullanıcı Ekleme */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kullanıcı Ekle ({selectedNotificationCategory === "maintenance" ? "Bakım" : selectedNotificationCategory === "production" ? "Üretim" : "Kalite"} Bildirimleri)
                </label>
                <select
                  id="recipientUserSelect"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onChange={(e) => {
                    const userId = parseInt(e.target.value);
                    if (userId) {
                      handleAddNotificationRecipient(userId, selectedNotificationCategory);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">Kullanıcı seçin...</option>
                  {users
                    .filter(u => u.isActive && !notificationRecipients.some(r => r.userId === u.id && r.notificationCategory === selectedNotificationCategory && r.isActive))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.role}) - {user.email || "Email yok"}
                      </option>
                    ))}
                </select>
              </div>

              {/* Liste */}
              {notificationRecipientsLoading ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</p>
              ) : notificationRecipients.filter(r => r.isActive && r.notificationCategory === selectedNotificationCategory).length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bu kategori için henüz bildirim alıcısı eklenmemiş. Yukarıdaki listeden kullanıcı seçerek ekleyebilirsiniz.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Kullanıcı Adı</th>
                        <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Email</th>
                        <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">Rol</th>
                        <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationRecipients
                        .filter(r => r.isActive && r.notificationCategory === selectedNotificationCategory)
                        .map((recipient) => (
                          <tr key={recipient.id} className="border-b border-gray-200 dark:border-gray-700">
                            <td className="py-2 px-3 text-gray-900 dark:text-white">{recipient.userName}</td>
                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{recipient.userEmail || "-"}</td>
                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{recipient.userRole || "-"}</td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() => {
                                  handleRemoveNotificationRecipient(recipient.id);
                                }}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                              >
                                Kaldır
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Şifre Sıfırla
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yeni Şifre:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 sm:p-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                  placeholder="En az 6 karakter"
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword("");
                  setSelectedUserId(null);
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-gray-500 hover:bg-gray-600 text-white rounded"
              >
                İptal
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={!newPassword || newPassword.length < 6}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded"
              >
                Şifre Güncelle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
