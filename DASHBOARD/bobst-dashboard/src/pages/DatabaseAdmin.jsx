import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, Database, AlertTriangle, Plus, Trash2, RefreshCcw, Megaphone } from "lucide-react";

export default function DatabaseAdmin() {
  const { user } = useAuth();
  
  // Mevcut state'ler
  const [machines, setMachines] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [columns, setColumns] = useState([]);
  const [newColumn, setNewColumn] = useState({ name: "", type: "INT", required: false });
  const [columnList, setColumnList] = useState([]);
  const [newMachine, setNewMachine] = useState({ machineName: "", tableName: "" });
  const [editingMachine, setEditingMachine] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Yeni state'ler - Rol bazında default tab
  const [activeTab, setActiveTab] = useState(user?.role === 'engineer' ? 'stopReasons' : 'machines');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [newCategory, setNewCategory] = useState({ 
    name: '', 
    displayName: '', 
    icon: 'Settings', 
    color: '#22c55e', 
    backgroundColor: 'rgba(34, 197, 94, 0.2)' 
  });
  const [newReason, setNewReason] = useState({ 
    name: '', 
    categoryId: null 
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingReason, setEditingReason] = useState(null);
  const [dataDefinitions, setDataDefinitions] = useState([]);
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [definitionSearch, setDefinitionSearch] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ message: "", isActive: true });
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const hasSelectedMachine = Boolean(selectedTable);

  // Tab menüsü - Rol bazında
  const tabs = [
    ...(user?.role === 'admin' ? [{ key: 'machines', label: 'Makine Yönetimi', icon: Database }] : []),
    ...(user?.role === 'admin' || user?.role === 'engineer' ? [
      { key: 'stopReasons', label: 'Duruş Sebepleri', icon: AlertTriangle },
      { key: 'announcements', label: 'Makina Duyuru', icon: Megaphone }
    ] : [])
  ];

  // Mevcut useEffect'ler...
  useEffect(() => {
    setLoading(true);
    api.get("/machines").then((res) => {
      console.log('🔍 Makine listesi backend\'den:', res.data);
      if (Array.isArray(res.data)) {
        setMachines(res.data);
      } else {
        console.error("Makine listesi array değil:", res.data);
        setMachines([]);
      }
    }).catch((err) => {
      console.error("Makine listesi alınamadı:", err);
      setMachines([]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    // Bu özellik şimdilik kaldırıldı - sadece makine listesi gösteriliyor
    setColumns([]);
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable) {
      loadDataDefinitions(selectedTable);
    } else {
      setDataDefinitions([]);
    }
  }, [selectedTable]);

  // Duruş sebepleri için yeni useEffect'ler
  useEffect(() => {
    if (activeTab === 'stopReasons' && selectedTable && machines.length > 0) {
      loadStopReasonCategories();
    }
  }, [activeTab, selectedTable, machines]);

  useEffect(() => {
    if (selectedCategory) {
      loadStopReasons(selectedCategory.id);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (activeTab === 'announcements') {
      loadAnnouncements();
    }
  }, [activeTab]);

  // Duruş sebepleri fonksiyonları
  const loadStopReasonCategories = async () => {
    // Seçili makine yoksa yükle
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      // Artık tüm API'ler tek backend'den geliyor
      const response = await api.get('/stoppagereasons/categories', {
        params: { machine: selectedTable }
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Kategoriler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStopReasons = async (categoryId) => {
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      // Artık tüm API'ler tek backend'den geliyor
      const response = await api.get(`/stoppagereasons/reasons/${categoryId}`, {
        params: { machine: selectedTable }
      });
      setReasons(response.data);
    } catch (error) {
      console.error('Sebepler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name || !newCategory.displayName) {
      alert('Kategori adı ve görünen ad zorunludur');
      return;
    }
    
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      // Artık tüm API'ler tek backend'den geliyor
      await api.post('/stoppagereasons/categories', {
        categoryCode: newCategory.name,
        displayName: newCategory.displayName,
        machine: selectedTable
      });
      setNewCategory({ name: '', displayName: '' });
      loadStopReasonCategories();
    } catch (error) {
      console.error('Kategori eklenemedi:', error);
      const message = error?.response?.data?.message || 'Kategori eklenemedi';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddReason = async () => {
    if (!newReason.name) {
      alert('Sebep adı zorunludur');
      return;
    }
    
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      // Artık tüm API'ler tek backend'den geliyor
      await api.post('/stoppagereasons/reasons', {
        categoryId: selectedCategory.id,
        reasonName: newReason.name,
        sortOrder: 0,
        machine: selectedTable
      });
      
      setNewReason({ name: '', categoryId: selectedCategory.id });
      loadStopReasons(selectedCategory.id);
    } catch (error) {
      console.error('Sebep eklenemedi:', error);
      const message = error?.response?.data?.message || 'Sebep eklenemedi';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  // Makine duyuruları
  const loadAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      if (!selectedTable) {
        setAnnouncements([]);
        return;
      }
      const response = await api.get("/machineannouncements", {
        params: { machine: selectedTable }
      });
      setAnnouncements(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Duyurular yüklenemedi:", error);
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!announcementForm.message.trim()) {
      alert("Duyuru metni boş olamaz");
      return;
    }

    try {
      setAnnouncementsLoading(true);
      await api.post(
        "/machineannouncements",
        {
          message: announcementForm.message.trim(),
          isActive: announcementForm.isActive,
        },
        { params: { machine: selectedTable } }
      );
      setAnnouncementForm({ message: "", isActive: true });
      await loadAnnouncements();
    } catch (error) {
      console.error("Duyuru eklenemedi:", error);
      const message = error?.response?.data?.message || "Duyuru eklenemedi. Lütfen tekrar deneyin.";
      alert(message);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;

    try {
      setAnnouncementsLoading(true);
      await api.delete(`/machineannouncements/${id}`, {
        params: { machine: selectedTable }
      });
      await loadAnnouncements();
    } catch (error) {
      console.error("Duyuru silinemedi:", error);
      alert("Duyuru silinemedi. Lütfen tekrar deneyin.");
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Bu kategoriyi ve tüm alt sebeplerini silmek istediğinize emin misiniz?')) {
      return;
    }
    
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      // Artık tüm API'ler tek backend'den geliyor
      await api.delete(`/stoppagereasons/categories/${categoryId}?force=true&machine=${selectedTable}`);
      loadStopReasonCategories();
      if (selectedCategory && selectedCategory.id === categoryId) {
        setSelectedCategory(null);
        setReasons([]);
      }
    } catch (error) {
      console.error('Kategori silinemedi:', error);
      const message = error?.response?.status === 409 && error?.response?.data?.message
        ? error.response.data.message
        : 'Kategori silinemedi';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReason = async (reasonId) => {
    if (!window.confirm('Bu sebebi silmek istediğinize emin misiniz?')) {
      return;
    }
    
    if (!selectedTable) return;
    
    try {
      setLoading(true);
      // Artık tüm API'ler tek backend'den geliyor
      await api.delete(`/stoppagereasons/reasons/${reasonId}?force=true&machine=${selectedTable}`);
      loadStopReasons(selectedCategory.id);
    } catch (error) {
      console.error('Sebep silinemedi:', error);
      const message = error?.response?.status === 409 && error?.response?.data?.message
        ? error.response.data.message
        : 'Sebep silinemedi';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const loadDataDefinitions = async (tableName) => {
    if (!tableName) return;
    try {
      setDefinitionsLoading(true);
      const response = await api.get("/plcconfig/data-definitions", {
        params: { machine: tableName }
      });
      if (Array.isArray(response.data)) {
        setDataDefinitions(response.data);
      } else {
        setDataDefinitions([]);
      }
    } catch (error) {
      console.error("Veri tanımları yüklenemedi:", error);
      alert("Veri tanımları alınamadı. Lütfen tekrar deneyin.");
    } finally {
      setDefinitionsLoading(false);
    }
  };

  const handleRefreshDefinitions = () => {
    if (selectedTable) {
      loadDataDefinitions(selectedTable);
    }
  };

  const handleDefinitionFieldChange = (id, field, value) => {
    setDataDefinitions((prev) =>
      prev.map((definition) =>
        definition.id === id ? { ...definition, [field]: value } : definition
      )
    );
  };

  const handleDefinitionFieldBlur = async (definitionId) => {
    if (!selectedTable) return;

    const definition = dataDefinitions.find((item) => item.id === definitionId);
    if (!definition) return;

    const normalizedTable = definition.saveTableName?.trim() || null;
    const normalizedColumn = definition.saveColumnName?.trim() || null;

    try {
      setDefinitionsLoading(true);
      await api.put(`/plcconfig/data-definitions/${definitionId}`, {
        saveTableName: normalizedTable,
        saveColumnName: normalizedColumn,
        machine: selectedTable
      });

      setDataDefinitions((prev) =>
        prev.map((item) =>
          item.id === definitionId
            ? {
                ...item,
                saveTableName: normalizedTable,
                saveColumnName: normalizedColumn
              }
            : item
        )
      );
    } catch (error) {
      console.error("Veri tanımı güncellenemedi:", error);
      alert("Tablo ya da kolon adı güncellenemedi. Lütfen değerleri kontrol edin.");
      await loadDataDefinitions(selectedTable);
    } finally {
      setDefinitionsLoading(false);
    }
  };

  const handleToggleSaveToDatabase = async (definition, newValue) => {
    if (!selectedTable) return;

    const tableName = definition.saveTableName?.trim();
    const columnName = definition.saveColumnName?.trim();

    if (newValue && (!tableName || !columnName)) {
      alert("Kaydı aktifleştirmeden önce tablo ve kolon adını girin.");
      return;
    }

    try {
      setDefinitionsLoading(true);
      await api.put(`/plcconfig/data-definitions/${definition.id}`, {
        saveToDatabase: newValue ? 1 : 0,
        machine: selectedTable
      });

      setDataDefinitions((prev) =>
        prev.map((item) =>
          item.id === definition.id ? { ...item, saveToDatabase: newValue ? 1 : 0 } : item
        )
      );
    } catch (error) {
      console.error("Veri kaydı ayarı güncellenemedi:", error);
      alert("Veri kaydı ayarı güncellenemedi. Lütfen tekrar deneyin.");
      await loadDataDefinitions(selectedTable);
    } finally {
      setDefinitionsLoading(false);
    }
  };

  const handleApplyDefaultDestination = async (definition) => {
    if (!selectedTable) return;

    const defaultTable = "dataRecords";
    const defaultColumn = definition.name;

    try {
      setDefinitionsLoading(true);
      await api.put(`/plcconfig/data-definitions/${definition.id}`, {
        saveTableName: defaultTable,
        saveColumnName: defaultColumn,
        machine: selectedTable
      });

      setDataDefinitions((prev) =>
        prev.map((item) =>
          item.id === definition.id
            ? { ...item, saveTableName: defaultTable, saveColumnName: defaultColumn }
            : item
        )
      );
    } catch (error) {
      console.error("Varsayılan hedef atanamadı:", error);
      alert("Varsayılan hedef atanamadı. Lütfen tekrar deneyin.");
      await loadDataDefinitions(selectedTable);
    } finally {
      setDefinitionsLoading(false);
    }
  };

  const filteredDefinitions = dataDefinitions.filter((definition) => {
    if (!definitionSearch) return true;
    const keyword = definitionSearch.toLowerCase();
    return (
      definition.name?.toLowerCase().includes(keyword) ||
      definition.saveColumnName?.toLowerCase().includes(keyword) ||
      definition.saveTableName?.toLowerCase().includes(keyword)
    );
  });

  // Mevcut fonksiyonlar...
  const handleDeleteColumn = (col) => {
    if (!window.confirm(`${col} kolonunu silmek istiyor musunuz?`)) return;
    setLoading(true);
    api
      .post("/api/database/drop-column", { tableName: selectedTable, columnName: col })
      .then(() => setColumns((prev) => prev.filter((c) => c !== col)))
      .finally(() => setLoading(false));
  };

  const handleDeleteTable = () => {
    if (!window.confirm(`${selectedTable} tablosunu ve ilişkili makineyi silmek istiyor musunuz?`)) return;
    setLoading(true);
    api
      .post("/api/database/drop-table", { tableName: selectedTable })
      .then(() => {
        setSelectedTable("");
        return api.get("/api/database/machines");
      })
      .then((res) => {
        if (Array.isArray(res.data)) setMachines(res.data);
      })
      .finally(() => setLoading(false));
  };

  const handleAddColumnToList = () => {
    if (!newColumn.name) return alert("Kolon adı boş olamaz");
    setColumnList((prev) => [...prev, newColumn]);
    setNewColumn({ name: "", type: "INT", required: false });
  };

  const handleAddColumnToExistingTable = () => {
    if (!newColumn.name || !selectedTable) return alert("Kolon adı ve tablo seçimi zorunludur");
    setLoading(true);
    api
      .post("/api/database/add-column", { tableName: selectedTable, column: newColumn })
      .then(() => {
        setColumns((prev) => [...prev, newColumn.name]);
        setNewColumn({ name: "", type: "INT", required: false });
      })
      .finally(() => setLoading(false));
  };

  const handleAddMachine = async () => {
    if (!newMachine.machineName || !newMachine.tableName) {
      alert("Makine adı ve tablo adı zorunludur");
      return;
    }
    
    setLoading(true);
    try {
      // TableName'e "_tracking" ekle (eğer yoksa)
      let tableName = newMachine.tableName.trim();
      if (!tableName.endsWith("_tracking")) {
        tableName = tableName + "_tracking";
      }
      
      if (!tableName) {
        alert("Tablo adı boş olamaz");
        return;
      }
      
      // Yeni API endpoint'i kullan: /api/machines
      const response = await api.post("/machines", {
        machineName: newMachine.machineName.trim(),
        tableName: tableName
      });
      
      // Başarı mesajı göster
      const message = response.data?.message || "Makine başarıyla eklendi";
      alert(message);
      
      // Formu temizle
      setNewMachine({ machineName: "", tableName: "" });
      setColumnList([]);
      
      // Makine listesini yenile
      const machinesResponse = await api.get("/machines");
      if (Array.isArray(machinesResponse.data)) {
        setMachines(machinesResponse.data);
      }
    } catch (err) {
      console.error("Makine eklenemedi:", err);
      const errorMessage = err?.response?.data?.message || "Makine eklenemedi. Lütfen tablo adının benzersiz olduğuna emin olun.";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Erişim kontrolü
  if (!user || (user.role !== 'admin' && user.role !== 'engineer')) {
    return (
      <div className="p-6 min-h-screen bg-white dark:bg-gray-900">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Erişim Reddedildi</h3>
          <p className="text-red-600 dark:text-red-300">Bu sayfaya erişim yetkiniz bulunmamaktadır. Sadece Admin ve Engineer rolleri erişebilir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-gray-900">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Veritabanı Yönetimi</h2>

      {/* Tab Menüsü */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500'
                  : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold mb-4">
          <Loader2 className="animate-spin" />
          İşlem yapılıyor, lütfen bekleyin...
        </div>
      )}

      {/* Makine Yönetimi Sekmesi */}
      {activeTab === 'machines' && (
        <>
          <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Yeni Makine Ekle</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <input
                type="text"
                placeholder="Makine adı (ör: Bobst Lemanic 5)"
                className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={newMachine.machineName}
                onChange={(e) => setNewMachine({ ...newMachine, machineName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Tablo adı (ör: lemanic3)"
                className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={newMachine.tableName}
                onChange={(e) => setNewMachine({ ...newMachine, tableName: e.target.value })}
              />
            </div>

            <button onClick={handleAddMachine} className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" />
              Makine Ekle
            </button>
            
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-200">
              ℹ️ <strong>Bilgi:</strong> Tablo adını girin (örn: "lemanic3" veya "lemanic3_tracking"). Sistem otomatik olarak "_tracking" ekler. Veritabanı adı otomatik belirlenir (örn: "lemanic_3_tracking"). Eğer tablo yoksa otomatik oluşturulur. PLC bağlantılarını admin panel'den yapılandırabilirsiniz.
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 mb-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Mevcut Makineler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((machine) => (
                <div
                  key={machine.id}
                  className={`border p-3 rounded cursor-pointer transition-colors ${
                    selectedTable === machine.tableName 
                      ? "bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-600" 
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => setSelectedTable(machine.tableName)}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white">{machine.machineName}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tablo: {machine.tableName}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'machines' && selectedTable && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Veri Kaydı Yönetimi</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Seçili makinedeki PLC tag&apos;lerinin hangi tabloya kaydedileceğini ve kolon adlarını yönetin.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <input
                type="text"
                value={definitionSearch}
                onChange={(e) => setDefinitionSearch(e.target.value)}
                placeholder="Tag ara..."
                className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 min-w-[220px]"
              />
              <button
                onClick={handleRefreshDefinitions}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-4 py-2 rounded transition-colors"
              >
                <RefreshCcw className="w-4 h-4" />
                Yenile
              </button>
            </div>
          </div>

          {definitionsLoading && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold mb-3">
              <Loader2 className="animate-spin w-4 h-4" />
              Kayıt ayarları yükleniyor...
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left border border-gray-200 dark:border-gray-700 rounded">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                <tr>
                  <th className="px-3 py-2 font-semibold border-b border-gray-200 dark:border-gray-700">Tag</th>
                  <th className="px-3 py-2 font-semibold border-b border-gray-200 dark:border-gray-700">Veri Tipi</th>
                  <th className="px-3 py-2 font-semibold border-b border-gray-200 dark:border-gray-700">Kaydet</th>
                  <th className="px-3 py-2 font-semibold border-b border-gray-200 dark:border-gray-700">Tablo Adı</th>
                  <th className="px-3 py-2 font-semibold border-b border-gray-200 dark:border-gray-700">Kolon Adı</th>
                  <th className="px-3 py-2 font-semibold border-b border-gray-200 dark:border-gray-700">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredDefinitions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-gray-600 dark:text-gray-400"
                    >
                      Kayıt için tanımlı tag bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredDefinitions.map((definition) => (
                    <tr
                      key={definition.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">
                        {definition.name}
                        {definition.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {definition.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {definition.dataType}
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={Boolean(definition.saveToDatabase)}
                            onChange={(e) => handleToggleSaveToDatabase(definition, e.target.checked)}
                          />
                          <span>{definition.saveToDatabase ? "Aktif" : "Pasif"}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={definition.saveTableName ?? ""}
                          onChange={(e) =>
                            handleDefinitionFieldChange(definition.id, "saveTableName", e.target.value)
                          }
                          onBlur={() => handleDefinitionFieldBlur(definition.id)}
                          placeholder="örn: dataRecords"
                          className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={definition.saveColumnName ?? ""}
                          onChange={(e) =>
                            handleDefinitionFieldChange(definition.id, "saveColumnName", e.target.value)
                          }
                          onBlur={() => handleDefinitionFieldBlur(definition.id)}
                          placeholder="örn: machineSpeed"
                          className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleApplyDefaultDestination(definition)}
                          className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-3 py-1 rounded transition-colors"
                        >
                          Varsayılanı Uygula
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            ℹ️ Kaydı aktifleştirmeden önce tablo ve kolon adlarını doğru girdiğinizden emin olun. Varsayılan ayar
            olarak tablo adı <code className="font-mono">dataRecords</code>, kolon adı ilgili tag adıdır.
          </p>
        </div>
      )}
      
      {/* Makine Düzenleme Modal'ı */}
      {editingMachine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Makine Düzenle
            </h3>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Makine Adı:
                </label>
                <input
                  type="text"
                  value={editingMachine.machineName}
                  onChange={(e) => setEditingMachine({ ...editingMachine, machineName: e.target.value })}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tablo Adı:
                </label>
                <input
                  type="text"
                  value={editingMachine.tableName}
                  disabled
                  className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 cursor-not-allowed"
                />
              </div>
              
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditingMachine(null)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
              >
                İptal
              </button>
              <button
                onClick={handleUpdateMachine}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Makina Duyuru Sekmesi */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Makine Seçimi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {machines.map((machine) => (
                <button
                  key={machine.id}
                  onClick={() => setSelectedTable(machine.tableName)}
                  className={`text-left border rounded p-3 transition-colors ${
                    selectedTable === machine.tableName
                      ? "bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-600"
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white">{machine.machineName}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tablo: {machine.tableName}</div>
                </button>
              ))}
            </div>
            {!hasSelectedMachine && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200">
                Lütfen önce bir makine seçiniz.
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
              <Megaphone className="w-5 h-5" />
              Yeni Duyuru Ekle
            </h3>
            <div className="space-y-3">
              <textarea
                rows={3}
                placeholder="Kayan barda gösterilecek duyuru metni"
                className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                disabled={!hasSelectedMachine}
              />
              <label className="inline-flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={announcementForm.isActive}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, isActive: e.target.checked })}
                  disabled={!hasSelectedMachine}
                />
                Aktif olsun
              </label>
              <button
                onClick={handleAddAnnouncement}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-60"
                disabled={announcementsLoading || !hasSelectedMachine}
              >
                <Plus className="w-4 h-4" />
                Duyuru Ekle
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Duyuru Listesi</h3>
              <button
                onClick={loadAnnouncements}
                className="inline-flex items-center gap-2 text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                disabled={!hasSelectedMachine}
              >
                <RefreshCcw className={`w-4 h-4 ${announcementsLoading ? 'animate-spin' : ''}`} />
                Yenile
              </button>
            </div>

            {announcementsLoading && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium mb-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Duyurular yükleniyor...
              </div>
            )}

            {!hasSelectedMachine ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-800 dark:text-yellow-200">
                Lütfen önce bir makine seçiniz.
              </div>
            ) : announcements.length === 0 && !announcementsLoading ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200">
                Henüz duyuru eklenmemiş.
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 dark:border-gray-700 rounded p-3 flex items-start justify-between gap-3 bg-white dark:bg-gray-800"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{item.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('tr-TR') : ''}
                        {item.createdBy ? ` • ${item.createdBy}` : ''}
                        {item.isActive === false ? ' • Pasif' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(item.id)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Duruş Sebepleri Sekmesi */}
      {activeTab === 'stopReasons' && (
        <div className="space-y-6">
          {/* Makine Seçimi */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Makine Seçimi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((machine) => (
                <div
                  key={machine.id}
                  className={`border p-3 rounded cursor-pointer transition-all ${
                    selectedTable === machine.tableName 
                      ? "bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-600" 
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => setSelectedTable(machine.tableName)}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white">{machine.machineName}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tablo: {machine.tableName}</p>
                </div>
              ))}
            </div>
            
            {!selectedTable && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-yellow-800 dark:text-yellow-200">⚠️ Lütfen önce bir makine seçin</p>
              </div>
            )}
          </div>

          {/* Seçilen makine için duruş sebep yönetimi */}
          {selectedTable && (
            <>
              {/* Kategori Ekleme */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Plus className="w-5 h-5" />
                  {machines.find(m => m.tableName === selectedTable)?.machineName} - Yeni Kategori Ekle
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Kategori Adı (ör: unwinder)"
                    className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Görünen Ad (ör: Unwinder)"
                    className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    value={newCategory.displayName}
                    onChange={(e) => setNewCategory({ ...newCategory, displayName: e.target.value })}
                  />
                </div>
                
                <button 
                  onClick={handleAddCategory}
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Kategori Ekle
                </button>
              </div>

              {/* Kategoriler Listesi */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                  {machines.find(m => m.tableName === selectedTable)?.machineName} - Kategoriler
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className={`border p-4 rounded cursor-pointer transition-all ${
                        selectedCategory?.id === category.id 
                          ? "bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-600" 
                          : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => setSelectedCategory(category)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{category.displayName}</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Kod: {category.categoryCode}</p>
                      {user?.role === 'admin' && category.createdBy && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Ekleyen: {category.createdBy}
                          {category.createdAt && ` • ${new Date(category.createdAt).toLocaleDateString('tr-TR')}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Seçilen Kategorinin Sebepleri */}
              {selectedCategory && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    {selectedCategory.displayName} - Duruş Sebepleri
                  </h3>

                  {/* Sebep Ekleme */}
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded">
                    <h4 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">Yeni Sebep Ekle</h4>
                    <div className="flex gap-4 mb-2">
                      <input
                        type="text"
                        placeholder="Sebep Adı (ör: Bobbin Bekleme)"
                        className="border border-gray-300 dark:border-gray-600 p-2 rounded flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        value={newReason.name}
                        onChange={(e) => setNewReason({ ...newReason, name: e.target.value, categoryId: selectedCategory.id })}
                      />
                      <button 
                        onClick={handleAddReason}
                        className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Sebep Ekle
                      </button>
                    </div>
                  </div>

                  {/* Sebepler Listesi */}
                  <div className="space-y-2">
                    {reasons.map((reason) => (
                      <div
                        key={reason.id}
                        className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">{reason.reasonName}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">#{reason.id}</span>
                          </div>
                          {user?.role === 'admin' && reason.createdBy && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Ekleyen: {reason.createdBy}
                              {reason.createdAt && ` • ${new Date(reason.createdAt).toLocaleDateString('tr-TR')}`}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteReason(reason.id)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
