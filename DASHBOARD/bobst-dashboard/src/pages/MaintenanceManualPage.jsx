import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTranslation } from "../utils/translations";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import ElectricBorder from "../components/ElectricBorder";
import PhotoEditorModal from "../components/PhotoEditorModal";
import {
  Camera,
  CheckCircle2,
  Clock3,
  Edit,
  FileUp,
  PenLine,
  Save,
  Users,
  XCircle,
  Sparkles,
  Plus,
  Trash2,
  User,
  Image,
  FileText,
  Package,
  Cog,
  Wrench,
} from "lucide-react";

const formatDurationMinutes = (start, end) => {
  if (!start || !end) return "-";
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if (days > 0) {
    parts.push(`${days}gün`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}sa`);
  }
  parts.push(`${minutes}dk`);
  parts.push(`${seconds}sn`);
  
  return parts.join(" ");
};

const formatLocalDateTimeForApi = (date) => {
  if (!date) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  // Saat bilgisini local olarak, timezone eklemeden gönder
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mm-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

const initialLookups = {
  machines: ["Bobst 1", "Bobst 2", "Bobst 3"],
  categories: ["Mekanik", "Elektrik", "Otomasyon"],
  causes: ["Kopma", "Titreşim", "Sensör", "Ayarsızlık"],
  operators: ["Operatör 1", "Operatör 2", "Operatör 3"],
};

function MaintenanceManualPage({ currentLanguage = "tr", darkMode = false }) {
  const { user } = useAuth();
  
  // Kullanıcının erişebileceği sekmeleri kontrol et
  const getAllowedSubTabs = useMemo(() => {
    if (!user?.roleSettings?.allowedSections) return ["record", "reports", "admin"];
    
    const allowed = [];
    if (user.roleSettings.allowedSections.includes("maintenanceManual.record") || 
        user.roleSettings.allowedSections.includes("maintenanceManual")) {
      allowed.push("record");
    }
    if (user.roleSettings.allowedSections.includes("maintenanceManual.reports")) {
      allowed.push("reports");
    }
    if (user.roleSettings.allowedSections.includes("maintenanceManual.admin")) {
      allowed.push("admin");
    }
    
    // Eğer hiçbir sekme izni yoksa ama maintenanceManual varsa, varsayılan olarak record'u göster
    if (allowed.length === 0 && user.roleSettings.allowedSections.includes("maintenanceManual")) {
      allowed.push("record");
    }
    
    return allowed.length > 0 ? allowed : ["record", "reports", "admin"]; // Fallback
  }, [user?.roleSettings?.allowedSections]);
  
  // İlk erişilebilir sekmeyi seç
  const initialSubTab = useMemo(() => {
    return getAllowedSubTabs[0] || "record";
  }, [getAllowedSubTabs]);
  
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab); // record | reports | admin
  
  // Eğer activeSubTab erişilebilir değilse, ilk erişilebilir sekmeye geç
  useEffect(() => {
    if (!getAllowedSubTabs.includes(activeSubTab)) {
      setActiveSubTab(initialSubTab);
    }
  }, [getAllowedSubTabs, activeSubTab, initialSubTab]);
  
  const [showDrawer, setShowDrawer] = useState(false);
  const [lookups, setLookups] = useState(initialLookups);

  // Maintenance management lookups from API
  const [machineGroups, setMachineGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupMachines, setGroupMachines] = useState([]);
  const [groupCategories, setGroupCategories] = useState([]);
  const [groupCauses, setGroupCauses] = useState([]);
  const [selectedMachineForOperators, setSelectedMachineForOperators] = useState(null);
  const [machineOperators, setMachineOperators] = useState([]);
  const [selectedCategoryAdminId, setSelectedCategoryAdminId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, type: "", id: null, name: "" });
  
  // Global lookup cache for record display (all machines, categories, causes, operators)
  const [allMachines, setAllMachines] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allCauses, setAllCauses] = useState([]);
  const [allOperators, setAllOperators] = useState([]);
  // Drawer (kayıt oluşturma) seçimleri - dinamik API
  const [drawerGroupId, setDrawerGroupId] = useState(null);
  const [drawerMachines, setDrawerMachines] = useState([]);
  const [drawerCategories, setDrawerCategories] = useState([]);
  const [drawerCauses, setDrawerCauses] = useState([]);
  const [drawerOperators, setDrawerOperators] = useState([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [type, setType] = useState("fault"); // maintenance | fault
  const [machine, setMachine] = useState("");
  const [category, setCategory] = useState("");
  const [cause, setCause] = useState("");
  const [operator, setOperator] = useState("");
  const [responsible, setResponsible] = useState("");
  const [note, setNote] = useState("");
  const [startMode, setStartMode] = useState("now"); // now | manual
  const [startedAt, setStartedAt] = useState(null);
  const [endedAt, setEndedAt] = useState(null);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [selectedPersonnel, setSelectedPersonnel] = useState([]); // Bakım personeli seçimi (array)
  const [maintenancePersonnel, setMaintenancePersonnel] = useState([]); // Bakım personeli listesi
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [annotatedPreview, setAnnotatedPreview] = useState(null);
  const [entries, setEntries] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const [groups, setGroups] = useState([{ name: "Vardiya A", members: [{ name: "Bakım Personeli 1", status: "approved" }], invites: [] }]);
  const [newGroupName, setNewGroupName] = useState("");
  const [invitee, setInvitee] = useState("");
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const isDrawing = useRef(false);
  const isLoadingRecordsRef = useRef(false); // Loading flag - infinite loop'u önlemek için
  
  // Edit record state
  const [editingRecord, setEditingRecord] = useState(null);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCauseId, setEditCauseId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editPhotos, setEditPhotos] = useState([]); // Array of { id, preview, annotated, canvasRef, imageRef, isDrawing }
  const [editMaterials, setEditMaterials] = useState([]);
  const [editingPhoto, setEditingPhoto] = useState(null); // Photo being edited in modal
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false);

  const summary = useMemo(() => {
    const total = entries.length;
    const totalMinutes = entries.reduce((acc, item) => acc + (item.durationMinutes || 0), 0);
    const avg = total ? Math.round(totalMinutes / total) : 0;
    const faults = entries.filter((x) => x.type === "fault").length;
    const maints = total - faults;
    return { total, avgMinutes: avg, faults, maints };
  }, [entries]);

  // Helper functions to resolve IDs to names (memoized with useCallback)
  const resolveMachineName = useCallback((machineId) => {
    if (!machineId) return "-";
    const found = allMachines.find((m) => m.id === machineId);
    return found?.name || `Makine #${machineId}`;
  }, [allMachines]);

  const resolveCategoryName = useCallback((categoryId) => {
    if (!categoryId) return "-";
    const found = allCategories.find((c) => c.id === categoryId);
    return found?.name || `Kategori #${categoryId}`;
  }, [allCategories]);

  const resolveCauseName = useCallback((causeId) => {
    if (!causeId) return "-";
    const found = allCauses.find((c) => c.id === causeId);
    return found?.name || `Sebep #${causeId}`;
  }, [allCauses]);

  const resolveOperatorName = useCallback((operatorId) => {
    if (!operatorId) return "-";
    const found = allOperators.find((o) => o.id === operatorId);
    return found?.name || `Operatör #${operatorId}`;
  }, [allOperators]);

  // Load all lookup data for record display - optimized to reduce RAM usage
  const loadAllLookups = async () => {
    try {
      // Load all machine groups first
      const groupsRes = await api.get("/maintenance/lookups/machine-groups");
      const groups = groupsRes.data || [];
      if (groups.length === 0) return;
      
      // Batch requests: Load machines, categories, causes in smaller batches to reduce memory pressure
      const BATCH_SIZE = 3; // Process 3 groups at a time
      const allMachinesFlat = [];
      const allCategoriesFlat = [];
      const allCausesFlat = [];
      
      for (let i = 0; i < groups.length; i += BATCH_SIZE) {
        const batch = groups.slice(i, i + BATCH_SIZE);
        const [machinesResults, categoriesResults, causesResults] = await Promise.all([
          Promise.all(batch.map((g) => api.get(`/maintenance/lookups/machines?machineGroupId=${g.id}`).catch(() => ({ data: [] })))),
          Promise.all(batch.map((g) => api.get(`/maintenance/lookups/categories?machineGroupId=${g.id}`).catch(() => ({ data: [] })))),
          Promise.all(batch.map((g) => api.get(`/maintenance/lookups/causes?machineId=0&machineGroupId=${g.id}`).catch(() => ({ data: [] })))),
        ]);
        
        allMachinesFlat.push(...machinesResults.flatMap((r) => r.data || []));
        allCategoriesFlat.push(...categoriesResults.flatMap((r) => r.data || []));
        allCausesFlat.push(...causesResults.flatMap((r) => r.data || []));
      }

      setAllMachines(allMachinesFlat);
      setAllCategories(allCategoriesFlat);
      setAllCauses(allCausesFlat);

      // Load operators in batches too
      const allOperatorsFlat = [];
      for (let i = 0; i < allMachinesFlat.length; i += BATCH_SIZE) {
        const batch = allMachinesFlat.slice(i, i + BATCH_SIZE);
        const operatorsResults = await Promise.all(
          batch.map((m) => api.get(`/maintenance/lookups/operators?machineId=${m.id}`).catch(() => ({ data: [] })))
        );
        allOperatorsFlat.push(...operatorsResults.flatMap((r) => r.data || []));
      }
      setAllOperators(allOperatorsFlat);
    } catch (err) {
      console.error("Lookup verileri yüklenemedi:", err);
    }
  };

  // loadRecords'u useCallback yerine normal fonksiyon yapıyoruz - loop'u önlemek için
  // RAM kullanımını azaltmak için sadece son 500 kaydı alıyoruz ve gereksiz veri işlemlerini minimize ediyoruz
  const loadRecords = async () => {
    if (isLoadingRecordsRef.current) {
      return;
    }
    
    isLoadingRecordsRef.current = true;
    
    try {
      const res = await api.get("/maintenance/records");
      const items = res.data?.items || res.data || [];
      
      // Filter out invalid records (must have id, machineGroupId, and machineId)
      // RAM tasarrufu için önce filtrele, sonra map et
      const validItems = items
        .filter((j) => 
          j && 
          j.id && 
          j.machineGroupId && 
          j.machineId // Machine selection is mandatory
        )
        .slice(0, 500); // Son 500 kayıt - RAM tasarrufu
      
      // Map işlemini optimize et - sadece gerekli alanları al
      const mapped = validItems.map((j) => ({
        id: String(j.id),
        type: j.type || "maintenance",
        machine: resolveMachineName(j.machineId),
        category: resolveCategoryName(j.categoryId),
        cause: resolveCauseName(j.causeId),
        operator: resolveOperatorName(j.operatorId),
        responsible: j.responsible || "-",
        note: j.notes || "",
        start: j.startedAt || j.createdAt || null,
        end: j.endedAt,
        durationMinutes: j.durationMinutes || 0,
        createdAt: j.createdAt,
        createdByUserId: j.createdByUserId,
        createdByUserName: j.createdByUserName || "Bilinmeyen",
        machineId: j.machineId,
        categoryId: j.categoryId,
        causeId: j.causeId,
        operatorId: j.operatorId,
        machineGroupId: j.machineGroupId,
        photoData: j.photoData || null, // Backend'den full data geliyor (JSON string veya base64)
        materialsJson: j.materialsJson,
        hasPhoto: !!j.photoData,
        hasNote: !!(j.notes && j.notes?.trim()),
        hasMaterials: !!(j.materialsJson && j.materialsJson?.trim()),
      }));
      
      setEntries(mapped);
    } catch (err) {
      console.error("Kayıtlar yüklenirken hata:", err);
    } finally {
      isLoadingRecordsRef.current = false;
    }
  };

  // İlk açılışta lookup verilerini yükle, sonra kayıtları çek
  useEffect(() => {
    loadAllLookups();
    loadMaintenancePersonnel();
  }, []);

  // Bakım personeli listesini yükle
  const loadMaintenancePersonnel = async () => {
    try {
      const res = await api.get("/maintenance/maintenance-personnel");
      const personnel = res.data || [];
      // Sıralama: Bakım Personeli, Bakım Mühendisi, Bakım Müdürü
      const sortedPersonnel = personnel.sort((a, b) => {
        const roleOrder = {
          "maintenancestaff": 1,
          "maintenanceengineer": 2,
          "maintenancemanager": 3,
        };
        const aRole = (a.role || "").toLowerCase();
        const bRole = (b.role || "").toLowerCase();
        const aOrder = roleOrder[aRole] || 99;
        const bOrder = roleOrder[bRole] || 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Aynı rolse isme göre sırala
        return (a.username || "").localeCompare(b.username || "");
      });
      setMaintenancePersonnel(sortedPersonnel);
    } catch (err) {
      console.error("Bakım personeli listesi yüklenemedi:", err);
    }
  };

  // Lookup verileri yüklendikten sonra kayıtları çek ve periyodik güncelle
  useEffect(() => {
    let timer = null;
    
    // Wait for lookup data to be loaded before loading records
    // This ensures resolveMachineName etc. functions work correctly
    const fetchRecords = () => {
      loadRecords();
    };
    
    if (allMachines.length > 0) {
      fetchRecords();
      // Kayıtları 15 saniyede bir yenile
      timer = setInterval(() => {
        fetchRecords();
      }, 15000); // 15 saniye
    } else {
      // If lookups aren't loaded yet, still try to load records once
      // (they'll show IDs until lookups are ready)
      fetchRecords();
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMachines.length]); // loadRecords'i dependency'den çıkarıyoruz - loop'u önlemek için

  // Her saniye ekranda sürelerin canlı güncellenmesi için tick
  useEffect(() => {
    const t = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const statCards = [
    { label: getTranslation("maintenance", currentLanguage) || "Bakım", value: summary.maints || 0, tone: "emerald" },
    { label: getTranslation("fault", currentLanguage) || "Arıza", value: summary.faults || 0, tone: "rose" },
    { label: getTranslation("average", currentLanguage) || "Ortalama", value: `${summary.avgMinutes} dk`, tone: "sky" },
  ];

  useEffect(() => {
    if (photoPreview && imageRef.current && canvasRef.current) {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
    }
  }, [photoPreview]);

  // Photo canvas refs map
  const photoCanvasRefs = useRef({});
  const photoImageRefs = useRef({});
  
  // Edit photo preview effects - initialize canvas when image loads
  useEffect(() => {
    editPhotos.forEach((photo) => {
      const canvasRefObj = photoCanvasRefs.current[photo.id];
      const imageRefObj = photoImageRefs.current[photo.id];
      if (!canvasRefObj || !imageRefObj) return;
      
      const canvas = canvasRefObj.current;
      const img = imageRefObj.current;
      
      if (!canvas || !img) return;
      
      // Set up image load handler
      const handleImageLoad = () => {
        if (canvas && typeof canvas.getContext === "function") {
          try {
            canvas.width = img.naturalWidth || img.width || 800;
            canvas.height = img.naturalHeight || img.height || 600;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
          } catch (err) {
            console.warn("Canvas initialization error:", err);
          }
        }
      };
      
      if (img.complete && img.naturalWidth > 0) {
        // Image already loaded
        handleImageLoad();
      } else {
        img.onload = handleImageLoad;
        img.onerror = () => console.warn("Image load error for photo:", photo.id);
      }
    });
  }, [editPhotos]);

  // --- API helpers for Maintenance ERP lookups ---
  useEffect(() => {
    const loadMachineGroups = async () => {
      try {
        const res = await api.get("/maintenance/lookups/machine-groups");
        const groups = res.data || [];
        setMachineGroups(groups);
        
        // Progressive disclosure: Başlangıçta seçili grup olmasın, kullanıcı manuel seçsin
        // Drawer için varsayılan grup seç (kayıt oluşturma için)
        if (groups.length > 0) {
          if (!drawerGroupId) {
            setDrawerGroupId(groups[0].id);
          }
        }
      } catch (err) {
        console.error("Makine grupları yüklenemedi:", err);
      }
    };
    loadMachineGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sadece ilk yüklemede çalış - loop'u önlemek için

  useEffect(() => {
    const loadGroupDetails = async () => {
      if (!selectedGroupId) return;
      setIsLoadingLookups(true);
      try {
        const [machinesRes, categoriesRes, causesRes] = await Promise.all([
          api.get(`/maintenance/lookups/machines?machineGroupId=${selectedGroupId}`),
          api.get(`/maintenance/lookups/categories?machineGroupId=${selectedGroupId}`),
          api.get(`/maintenance/lookups/causes?machineId=0&machineGroupId=${selectedGroupId}`),
        ]);
        setGroupMachines(machinesRes.data || []);
        setGroupCategories(categoriesRes.data || []);
        setGroupCauses(causesRes.data || []);
      } catch (err) {
        console.error("Grup detayları yüklenemedi:", err);
      } finally {
        setIsLoadingLookups(false);
      }
    };
    loadGroupDetails();
  }, [selectedGroupId]);

  // Drawer için dinamik lookups
  useEffect(() => {
    const loadDrawerMachines = async () => {
      if (!drawerGroupId) {
        setDrawerMachines([]);
        setDrawerCategories([]);
        setDrawerCauses([]);
        return;
      }
      try {
        const [machinesRes, categoriesRes, causesRes] = await Promise.all([
          api.get(`/maintenance/lookups/machines?machineGroupId=${drawerGroupId}`),
          api.get(`/maintenance/lookups/categories?machineGroupId=${drawerGroupId}`),
          api.get(`/maintenance/lookups/causes?machineId=0&machineGroupId=${drawerGroupId}`),
        ]);
        setDrawerMachines(machinesRes.data || []);
        setDrawerCategories(categoriesRes.data || []);
        setDrawerCauses(causesRes.data || []);
        setMachine((prev) => {
          const exists = (machinesRes.data || []).some((m) => m.name === prev);
          return exists ? prev : "";
        });
        setCategory((prev) => {
          const exists = (categoriesRes.data || []).some((c) => c.name === prev);
          return exists ? prev : "";
        });
        setCause((prev) => {
          const exists = (causesRes.data || []).some((c) => c.name === prev);
          return exists ? prev : "";
        });
      } catch (err) {
        console.error("Drawer lookupları yüklenemedi:", err);
      }
    };
    loadDrawerMachines();
  }, [drawerGroupId]);

  useEffect(() => {
    const loadDrawerOperators = async () => {
      if (!machine) {
        setDrawerOperators([]);
        return;
      }
      try {
        const found = drawerMachines.find((m) => m.name === machine);
        const machineId = found?.id;
        if (!machineId) {
          setDrawerOperators([]);
          return;
        }
        const res = await api.get(`/maintenance/lookups/operators?machineId=${machineId}`);
        setDrawerOperators(res.data || []);
        setOperator((prev) => {
          const exists = (res.data || []).some((o) => o.name === prev);
          return exists ? prev : "";
        });
      } catch (err) {
        console.error("Drawer operatörler yüklenemedi:", err);
      }
    };
    loadDrawerOperators();
  }, [machine, drawerMachines]);

  useEffect(() => {
    const loadDrawerCausesForCategory = async () => {
      if (!category || !drawerGroupId) {
        setDrawerCauses([]);
        setCause("");
        return;
      }
      // drawerCategories henüz yüklenmemişse bekle
      if (!drawerCategories || drawerCategories.length === 0) {
        return;
      }
      const catObj = drawerCategories.find((c) => c.name === category);
      if (!catObj || !catObj.id) {
        setDrawerCauses([]);
        setCause("");
        return;
      }
      const catId = catObj.id;
      // Sebepler sadece kategoriye bağlı, makineye bağlı değil
      try {
        const res = await api.get(`/maintenance/lookups/causes?machineId=0&categoryId=${catId}&machineGroupId=${drawerGroupId}`);
        setDrawerCauses(res.data || []);
        setCause((prev) => {
          const exists = (res.data || []).some((c) => c.name === prev);
          return exists ? prev : "";
        });
      } catch (err) {
        console.error("Drawer sebepler yüklenemedi:", err);
        setDrawerCauses([]);
        setCause("");
      }
    };
    loadDrawerCausesForCategory();
  }, [category, drawerCategories, drawerGroupId]);

  const refreshOperatorsForMachine = async (machineId) => {
    if (!machineId) {
      setMachineOperators([]);
      return;
    }
    try {
      const res = await api.get(`/maintenance/lookups/operators?machineId=${machineId}`);
      setMachineOperators(res.data || []);
    } catch (err) {
      console.error("Operatörler yüklenemedi:", err);
    }
  };

  const handleSelectMachineForOperators = (id) => {
    setSelectedMachineForOperators(id);
    refreshOperatorsForMachine(id);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCanvasMouse = (event, typeEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ctx = canvasRef.current.getContext("2d");
    if (typeEvent === "down") {
      isDrawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (typeEvent === "move" && isDrawing.current) {
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    } else if (typeEvent === "up") {
      isDrawing.current = false;
    }
  };

  const handleAddText = () => {
    if (!canvasRef.current) return;
    const text = prompt("Metin ekle");
    if (!text) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#fbbf24";
    ctx.font = "20px sans-serif";
    ctx.fillText(text, 24, 32 + Math.random() * 40);
  };

  const handleSaveAnnotation = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setAnnotatedPreview(dataUrl);
  };

  // Edit record handlers
  const handleEditFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const newPhotos = files.map((file) => {
      const photoId = generateId();
      const preview = URL.createObjectURL(file);
      return { 
        id: photoId, 
        preview, 
        annotated: null,
        file,
        isDrawing: false
      };
    });
    
    setEditPhotos((prev) => [...prev, ...newPhotos]);
    
    // Reset input
    e.target.value = "";
  };

  const handleEditCanvasMouse = (photoId, canvasRef, event, typeEvent) => {
    if (!canvasRef || !canvasRef.current || typeof canvasRef.current.getContext !== "function") return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ctx = canvas.getContext("2d");
    const photo = editPhotos.find((p) => p.id === photoId);
    if (!photo) return;
    
    if (typeEvent === "down") {
      photo.isDrawing = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (typeEvent === "move" && photo.isDrawing) {
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    } else if (typeEvent === "up") {
      photo.isDrawing = false;
    }
  };

  const handleEditAddText = (photoId, canvasRef) => {
    if (!canvasRef || !canvasRef.current || typeof canvasRef.current.getContext !== "function") return;
    const text = prompt("Metin ekle");
    if (!text) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#fbbf24";
    ctx.font = "20px sans-serif";
    ctx.fillText(text, 24, 32 + Math.random() * 40);
  };

  const handleEditSaveAnnotation = (photoId, canvasRef) => {
    if (!canvasRef || !canvasRef.current || typeof canvasRef.current.toDataURL !== "function") return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setEditPhotos((prev) => prev.map((p) => 
      p.id === photoId ? { ...p, annotated: dataUrl } : p
    ));
  };

  const handlePhotoEditorSave = (dataUrl) => {
    if (!editingPhoto) return;
    setEditPhotos((prev) => prev.map((p) => 
      p.id === editingPhoto.id ? { ...p, annotated: dataUrl } : p
    ));
    setEditingPhoto(null);
    setIsPhotoEditorOpen(false);
  };

  const removeEditPhoto = (photoId) => {
    setEditPhotos((prev) => {
      const photo = prev.find((p) => p.id === photoId);
      if (photo && photo.preview && photo.preview.startsWith("blob:")) {
        URL.revokeObjectURL(photo.preview);
      }
      // Clean up refs
      delete photoCanvasRefs.current[photoId];
      delete photoImageRefs.current[photoId];
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;
    try {
      // Convert photos to base64 array
      const photoDataArray = await Promise.all(
        editPhotos.map(async (photo) => {
          if (photo.annotated) return photo.annotated;
          if (photo.preview && !photo.file) {
            // Existing photo, keep as is
            return photo.preview;
          }
          // Convert file to base64 if not annotated
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            if (photo.file) {
              reader.readAsDataURL(photo.file);
            } else {
              resolve(null);
            }
          });
        })
      );
      
      const payload = {
        notes: editNote || null,
        photoData: photoDataArray.length > 0 && photoDataArray.some(p => p) ? JSON.stringify(photoDataArray.filter(p => p)) : null,
        materials: editMaterials
          .filter((m) => m.name && m.name.trim() && m.quantity)
          .map((m) => ({
            name: m.name.trim(),
            quantity: parseFloat(m.quantity) || 0,
            unit: "adet",
            note: null
          })),
        categoryId: editCategoryId || null,
        causeId: editCauseId || null,
      };
      
      console.log("Updating record:", editingRecord.id, payload);
      const response = await api.put(`/maintenance/records/${editingRecord.id}`, payload);
      console.log("Update response:", response);
      
      // Close drawer and reset
      setEditingRecord(null);
      setEditNote("");
      setEditPhotos([]);
      setEditMaterials([]);
      setEditCategoryId(null);
      setEditCauseId(null);
      
      // Refresh list
      await loadRecords();
      
      // Show success message
      alert("Kayıt başarıyla güncellendi");
    } catch (err) {
      console.error("Kayıt güncellenemedi:", err);
      const errorMsg = err.response?.data?.message || err.message || "Kayıt güncellenirken hata oluştu";
      alert(`Hata: ${errorMsg}`);
    }
  };

  const addMaterialRow = () => {
    setEditMaterials([...editMaterials, { name: "", quantity: "" }]);
  };

  const removeMaterialRow = (index) => {
    setEditMaterials(editMaterials.filter((_, i) => i !== index));
  };

  const updateMaterialField = (index, field, value) => {
    const updated = [...editMaterials];
    updated[index] = { ...updated[index], [field]: value };
    setEditMaterials(updated);
  };

  const handleStartNow = () => {
    const now = new Date();
    setStartedAt(formatLocalDateTimeForApi(now));
    setEndedAt(null);
  };

  const handleFinishNow = () => {
    const end = new Date();
    setEndedAt(formatLocalDateTimeForApi(end));
  };

  // Bir kaydı kart üzerinden sonlandırmak için (End ver)
  const handleFinishRecord = async (record) => {
    if (!record || !record.id) return;
    if (!window.confirm("Bu bakım / arıza kaydını sonlandırmak istiyor musun?")) return;
    try {
      const now = new Date();
      const endedAt = formatLocalDateTimeForApi(now);
      await api.put(`/maintenance/records/${record.id}`, {
        endedAt,
      });
      // Listeyi yenile
      await loadRecords();
    } catch (err) {
      console.error("Kayıt sonlandırılamadı:", err);
      alert("Kayıt sonlandırılırken hata oluştu");
    }
  };

  const resetForm = () => {
    setType("fault");
    setMachine("");
    setCategory("");
    setCause("");
    setOperator("");
    setResponsible("");
    setNote("");
    setStartMode("now");
    setStartedAt(null);
    setEndedAt(null);
    setManualStart("");
    setManualEnd("");
    setSelectedPersonnel([]);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAnnotatedPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const machineObj = drawerMachines.find((m) => m.name === machine);
    if (!machineObj) {
      alert("Lütfen en az bir makine seçin.");
      return;
    }

    const categoryObj = drawerCategories.find((c) => c.name === category);
    const causeObj = drawerCauses.find((c) => c.name === cause);
    const operatorObj = drawerOperators.find((o) => o.name === operator);

    const nowDefault = formatLocalDateTimeForApi(new Date());
    let start, end;
    
    if (startMode === "now") {
      start = startedAt || nowDefault;
      end = endedAt || null;
    } else {
      // Manuel tarih/saat girişi - datetime-local formatını API formatına çevir
      if (manualStart) {
        // datetime-local format: "2024-01-15T14:30" -> "2024-01-15T14:30:00"
        // Eğer saniye yoksa ekle
        let formattedStart = manualStart;
        if (formattedStart.includes("T") && !formattedStart.includes(":")) {
          formattedStart += ":00:00";
        } else if (formattedStart.includes("T") && formattedStart.split(":").length === 2) {
          formattedStart += ":00";
        }
        start = formattedStart;
      } else {
        start = null;
      }
      
      if (manualEnd) {
        let formattedEnd = manualEnd;
        if (formattedEnd.includes("T") && !formattedEnd.includes(":")) {
          formattedEnd += ":00:00";
        } else if (formattedEnd.includes("T") && formattedEnd.split(":").length === 2) {
          formattedEnd += ":00";
        }
        end = formattedEnd;
      } else {
        end = null;
      }
    }

    // Seçilen bakım personellerinden ilkini performedByUserId olarak gönder
    // (Backend şu an tek personel destekliyor, ileride genişletilebilir)
    const performedByUserId = selectedPersonnel.length > 0 ? selectedPersonnel[0].id : null;

    const payload = {
      type: type || "maintenance",
      machineId: machineObj.id,
      categoryId: categoryObj ? categoryObj.id : null,
      causeId: causeObj ? causeObj.id : null,
      operatorId: operatorObj ? operatorObj.id : null,
      responsibleOperator: responsible || null,
      startedAt: start,
      endedAt: end,
      notes: note || null,
      createdByUserId: user?.id || 0,
      performedByUserId: performedByUserId,
      isBackdated: startMode === "manual",
    };

    try {
      await api.post("/maintenance/records", {
        type: payload.type,
        machineGroupId: drawerGroupId || 0,
        machineId: machineObj.id,
        categoryId: categoryObj ? categoryObj.id : null,
        causeId: causeObj ? causeObj.id : null,
        operatorId: operatorObj ? operatorObj.id : null,
        responsible: payload.responsibleOperator,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        notes: payload.notes,
        createdByUserId: payload.createdByUserId,
        performedByUserId: payload.performedByUserId,
        isBackdated: payload.isBackdated,
      });
      await loadRecords();
      resetForm();
    } catch (err) {
      console.error("Kayıt oluşturulamadı:", err);
      alert("Kayıt oluşturulamadı. Lütfen tekrar deneyin.");
    }
  };

  const addLookup = (key, value) => {
    if (!value) return;
    setLookups((prev) => ({ ...prev, [key]: [...(prev[key] || []), value] }));
  };

  // Admin tree CRUD handlers
  const handleAddMachineGroup = async (name) => {
    if (!name) return;
    try {
      const res = await api.post("/maintenance/lookups/machine-groups", { name, isActive: true });
      setMachineGroups((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Makine grubu eklenemedi:", err);
    }
  };

  const handleDeleteMachineGroup = async (id) => {
    try {
      await api.delete(`/maintenance/lookups/machine-groups/${id}`);
      setMachineGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedGroupId === id) {
        setSelectedGroupId(null);
        setGroupMachines([]);
        setGroupCategories([]);
        setGroupCauses([]);
      }
    } catch (err) {
      console.error("Makine grubu silinemedi:", err);
    }
  };

  const handleAddMachine = async (name) => {
    if (!name || !selectedGroupId) return;
    try {
      const res = await api.post("/maintenance/lookups/machines", {
        name,
        machineGroupId: selectedGroupId,
        isActive: true,
      });
      setGroupMachines((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Makine eklenemedi:", err);
    }
  };

  const handleDeleteMachine = async (id) => {
    try {
      await api.delete(`/maintenance/lookups/machines/${id}`);
      setGroupMachines((prev) => prev.filter((m) => m.id !== id));
      if (selectedMachineForOperators === id) {
        setSelectedMachineForOperators(null);
        setMachineOperators([]);
      }
    } catch (err) {
      console.error("Makine silinemedi:", err);
    }
  };

  const handleAddCategory = async (name) => {
    if (!name || !selectedGroupId) return;
    try {
      const res = await api.post("/maintenance/lookups/categories", {
        name,
        machineGroupId: selectedGroupId,
        isActive: true,
      });
      setGroupCategories((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Kategori eklenemedi:", err);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.delete(`/maintenance/lookups/categories/${id}`);
      setGroupCategories((prev) => prev.filter((c) => c.id !== id));
      if (selectedCategoryAdminId === id) {
        setSelectedCategoryAdminId(null);
      }
    } catch (err) {
      console.error("Kategori silinemedi:", err);
    }
  };

  const handleAddCause = async (name) => {
    if (!name || !selectedGroupId) {
      alert("Sebep eklemek için önce bir makine grubu seçin.");
      return;
    }
    if (!selectedCategoryAdminId) {
      alert("Sebep eklemek için önce bir kategori seçin.");
      return;
    }
    try {
      // Sebep artık sadece kategoriye bağlı, makineye bağlı değil
      const res = await api.post("/maintenance/lookups/causes", {
        name,
        categoryId: selectedCategoryAdminId,
        machineGroupId: selectedGroupId,
        isActive: true,
      });
      setGroupCauses((prev) => [...prev, res.data]);
      // Sebepleri yeniden yükle
      const causesRes = await api.get(`/maintenance/lookups/causes?machineGroupId=${selectedGroupId}`);
      setGroupCauses(causesRes.data || []);
    } catch (err) {
      console.error("Sebep eklenemedi:", err);
      alert(err?.response?.data?.message || "Sebep eklenirken hata oluştu");
    }
  };

  const handleDeleteCause = async (id) => {
    try {
      await api.delete(`/maintenance/lookups/causes/${id}`);
      setGroupCauses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Sebep silinemedi:", err);
    }
  };

  const handleAddOperator = async (name) => {
    if (!name || !selectedMachineForOperators) return;
    try {
      const res = await api.post("/maintenance/lookups/operators", {
        machineId: selectedMachineForOperators,
        name,
        isActive: true,
      });
      setMachineOperators((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Operatör eklenemedi:", err);
    }
  };

  const handleDeleteOperator = async (id) => {
    try {
      await api.delete(`/maintenance/lookups/operators/${id}`);
      setMachineOperators((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error("Operatör silinemedi:", err);
    }
  };

  const requestDelete = (type, id, name) => {
    setConfirmDelete({ open: true, type, id, name });
  };

  const handleConfirmDelete = async () => {
    const { type, id } = confirmDelete;
    
    if (!id) {
      setConfirmDelete({ open: false, type: "", id: null, name: "" });
      return;
    }
    
    if (!type) {
      setConfirmDelete({ open: false, type: "", id: null, name: "" });
      return;
    }
    
    try {
      if (type === "group") {
        await handleDeleteMachineGroup(id);
      } else if (type === "machine") {
        await handleDeleteMachine(id);
      } else if (type === "category") {
        await handleDeleteCategory(id);
      } else if (type === "cause") {
        await handleDeleteCause(id);
      } else if (type === "operator") {
        await handleDeleteOperator(id);
      } else if (type === "record") {
        try {
          await api.delete(`/maintenance/records/${id}`, {
            timeout: 8000
          });
        } catch (apiErr) {
          if (apiErr.code === 'ECONNABORTED' || apiErr.message.includes('timeout')) {
            alert("Silme işlemi zaman aşımına uğradı. Backend yanıt vermiyor olabilir.");
          } else {
            alert("Silme işlemi sırasında hata oluştu: " + (apiErr.response?.data?.message || apiErr.message));
          }
          throw apiErr;
        }
        
        // Modal'ı önce kapat, sonra kayıtları yenile (RAM sorununu önlemek için)
        setConfirmDelete({ open: false, type: "", id: null, name: "" });
        
        // loadRecords'u setTimeout ile geciktir (state update'in tamamlanması için)
        setTimeout(async () => {
          try {
            await loadRecords();
          } catch (err) {
            console.error("Kayıtlar yenilenirken hata:", err);
          }
        }, 200);
        
        return;
      } else {
        alert("Bilinmeyen silme tipi: " + type);
        setConfirmDelete({ open: false, type: "", id: null, name: "" });
        return;
      }
      
      // Başarılı olduysa modal'ı kapat
      setConfirmDelete({ open: false, type: "", id: null, name: "" });
      console.log("[DELETE] Modal kapatıldı");
    } catch (err) {
      console.error("[DELETE] Silme hatası:", err);
      console.error("[DELETE] Hata detayları:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      alert("Silme işlemi sırasında hata oluştu: " + (err.response?.data?.message || err.message));
      // Hata olsa bile modal'ı kapat (kullanıcı tekrar deneyebilir)
      setConfirmDelete({ open: false, type: "", id: null, name: "" });
    }
  };

  const handleCreateGroup = () => {
    if (!newGroupName) return;
    setGroups((prev) => [...prev, { name: newGroupName, members: [], invites: [] }]);
    setNewGroupName("");
  };

  const handleInvite = (groupName) => {
    if (!invitee) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.name === groupName
          ? { ...g, invites: [...g.invites, { name: invitee, status: "pending" }] }
          : g
      )
    );
    setInvitee("");
  };

  const approveInvite = (groupName, name) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.name !== groupName) return g;
        const invite = g.invites.find((i) => i.name === name);
        if (!invite) return g;
        return {
          ...g,
          invites: g.invites.map((i) => (i.name === name ? { ...i, status: "approved" } : i)),
          members: [...g.members, { name, status: "approved" }],
        };
      })
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Hero / header */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white font-semibold shadow-lg hover:translate-y-[-1px] transition"
        >
          <Sparkles className="w-4 h-4" /> + Yeni
        </button>
      </div>

      {/* Sekmeleri sadece birden fazla erişilebilir sekme varsa göster */}
      {getAllowedSubTabs.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "record", label: getTranslation("maintenanceRecord", currentLanguage) || "Kayıt", icon: FileUp },
            { key: "reports", label: getTranslation("maintenanceReports", currentLanguage) || "Raporlar", icon: Sparkles },
            { key: "admin", label: getTranslation("maintenanceAdmin", currentLanguage) || "Yönetim", icon: Users }
          ]
            .filter(tab => getAllowedSubTabs.includes(tab.key))
            .map((tab) => {
              const Icon = tab.icon;
              const active = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveSubTab(tab.key)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                    active
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </button>
              );
            })}
        </div>
      ) : null}

      {activeSubTab === "record" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Yeni bakım / arıza kayıtlarını sol üstteki <strong>+ Yeni</strong> butonu ile oluşturabilirsiniz. Aşağıda son kayıtlar info kartlar olarak listelenir.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {entries.map((e, index) => {
              const isCompleted = !!e.end;
              // Modern kart tasarımı - tamamlanan kayıtlar için gri tonlar, devam edenler için renkli
              const cardStyle = isCompleted
                ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm hover:shadow-md transition-all duration-200"
                : e.type === "fault"
                ? "border-rose-300 dark:border-rose-700/50 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-950/30 dark:to-gray-800/60 shadow-md hover:shadow-lg transition-all duration-200 ring-1 ring-rose-200/50 dark:ring-rose-800/30"
                : "border-emerald-300 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-gray-800/60 shadow-md hover:shadow-lg transition-all duration-200 ring-1 ring-emerald-200/50 dark:ring-emerald-800/30";
              const badge = e.type === "fault"
                ? (getTranslation("fault", currentLanguage) || "Arıza")
                : (getTranslation("maintenance", currentLanguage) || "Bakım");
              const statusLabel = isCompleted ? (getTranslation("completed", currentLanguage) || "Bitti") : (getTranslation("inProgress", currentLanguage) || "Devam Ediyor");
              
              const cardInnerContent = (
                <div
                  className={`rounded-2xl border ${cardStyle} p-4 flex flex-col justify-between relative overflow-hidden group ${
                    !isCompleted ? "hover:ring-opacity-60 dark:hover:ring-opacity-50" : ""
                  } ${
                    !isCompleted && e.type === "fault" 
                      ? "hover:ring-rose-300/60 dark:hover:ring-rose-700/50 animate-pulse-subtle" 
                      : !isCompleted && e.type === "maintenance"
                      ? "hover:ring-emerald-300/60 dark:hover:ring-emerald-700/50 animate-pulse-subtle"
                      : ""
                  }`}
                  style={{
                    animationDuration: !isCompleted ? "3s" : "none",
                  }}
                >
                  
                  {/* Arıza için dönen dişli animasyonu - sadece devam edenler için */}
                  {!isCompleted && e.type === "fault" && (
                    <div className="absolute top-3 right-3 opacity-40 z-10">
                      <Cog className="w-7 h-7 text-rose-500 dark:text-rose-400 animate-spin" style={{ animationDuration: "3s" }} />
                    </div>
                  )}
                  
                  {/* Bakım için sabit anahtar ikonu - sadece devam edenler için */}
                  {!isCompleted && e.type === "maintenance" && (
                    <div className="absolute top-3 right-3 opacity-40 z-10">
                      <Wrench className="w-7 h-7 text-emerald-500 dark:text-emerald-400" />
                    </div>
                  )}
                  
                  {/* "Devam ediyor" badge - çark/anahtarın solunda */}
                  {!isCompleted && (
                    <span
                      className="absolute top-3 right-11 text-[10px] px-2.5 py-1 rounded-full bg-amber-100/90 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200 z-20 backdrop-blur-sm font-medium shadow-sm"
                    >
                      {statusLabel}
                    </span>
                  )}
                  
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          e.type === "fault" 
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-200 dark:border-rose-800" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                        }`}>
                          {badge}
                        </span>
                        {/* Makine ismi - büyük */}
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {e.machine || "-"}
                        </span>
                        {/* Operatör ismi - küçük */}
                        {e.operator && e.operator !== `Operatör #${e.operatorId}` && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            · {e.operator}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-200">
                        {e.category || "-"} {e.cause ? `· ${e.cause}` : ""}
                      </div>
                      {/* Kaydı kim açmış */}
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                        <User className="w-3 h-3" />
                        <span>{e.createdByUserName || "Bilinmeyen"}</span>
                      </div>
                    </div>
                    {/* Tamamlanan kayıtlar için status badge - sağ üstte */}
                    {isCompleted && (
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-200 font-medium shadow-sm backdrop-blur-sm"
                      >
                        {statusLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2 relative z-10">
                    {e.note || "-"}
                  </div>
                  {/* İkonlar - tarihin üstünde, sağda */}
                  {(e.hasPhoto || e.hasNote || e.hasMaterials) && (
                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      {e.hasPhoto && (
                        <Image className="w-3.5 h-3.5 text-blue-500" title="Fotoğraf var" />
                      )}
                      {e.hasNote && (
                        <FileText className="w-3.5 h-3.5 text-green-500" title="Not var" />
                      )}
                      {e.hasMaterials && (
                        <Package className="w-3.5 h-3.5 text-purple-500" title="Malzeme var" />
                      )}
                    </div>
                  )}
                   <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 relative z-10">
                     <span>
                       {getTranslation("duration", currentLanguage) || "Süre"}:{" "}
                       {formatDurationMinutes(e.start, e.end || new Date(nowTick).toISOString())}
                     </span>
                     <span>{e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}</span>
                   </div>
                   {/* Düzenle / Sil butonları - sadece yetkili roller için */}
                   {(user?.id === e.createdByUserId || 
                     user?.roleSettings?.name === "admin" || 
                     user?.roleSettings?.name === "maintenanceManager" ||
                     user?.roleSettings?.name === "maintenanceEngineer") && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        onClick={() => {
                          // Önce drawer'ı aç, sonra data'yı yükle (daha hızlı görünüm)
                          setEditingRecord(e);
                          setEditNote(e.note || "");
                          setEditCategoryId(e.categoryId || null);
                          setEditCauseId(e.causeId || null);
                          
                          // Photo ve material parsing'i async yap (non-blocking)
                          requestAnimationFrame(() => {
                            // Parse photos from JSON array or single string
                            try {
                              let photosData = [];
                              if (e.photoData && e.photoData !== "exists") {
                                try {
                                  // Try to parse as JSON array
                                  const parsed = JSON.parse(e.photoData);
                                  if (Array.isArray(parsed)) {
                                    photosData = parsed;
                                  } else if (typeof parsed === 'string') {
                                    photosData = [parsed];
                                  } else {
                                    photosData = [e.photoData];
                                  }
                                } catch {
                                  // Not JSON, treat as single base64 string
                                  photosData = [e.photoData];
                                }
                              }
                              // Ensure photoData is valid base64 string or URL
                              setEditPhotos(photosData
                                .filter(photoData => photoData && typeof photoData === 'string' && (
                                  photoData.startsWith('data:image') || 
                                  photoData.startsWith('/uploads') ||
                                  photoData.startsWith('http')
                                ))
                                .map((photoData) => {
                                  // If it's a relative path, convert to full URL
                                  let preview = photoData;
                                  if (photoData.startsWith('/uploads')) {
                                    preview = `http://192.168.1.44:5199${photoData}`;
                                  }
                                  return {
                                    id: generateId(),
                                    preview: preview,
                                    annotated: preview, // Start with same as preview
                                    file: null,
                                    isDrawing: false
                                  };
                                }));
                            } catch (err) {
                              console.warn("Photo parse error:", err);
                              setEditPhotos([]);
                            }
                            
                            // Parse materials from JSON if exists
                            try {
                              const materials = e.materialsJson ? JSON.parse(e.materialsJson) : [];
                              setEditMaterials(
                                Array.isArray(materials)
                                  ? materials.map((m) => ({
                                      // Backend JSON alanları Name / Quantity / Unit / Note
                                      name: m.name || m.Name || "",
                                      quantity: m.quantity || m.Quantity || "",
                                    }))
                                  : []
                              );
                            } catch {
                              setEditMaterials([]);
                            }
                          });
                        }}
                        className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center gap-1.5 transition"
                      >
                        <Edit className="w-3 h-3" />
                        {getTranslation("edit", currentLanguage) || "Düzenle"}
                      </button>
                      {/* Devam eden kayıtlar için Bitir butonu */}
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleFinishRecord(e)}
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1.5 transition"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {getTranslation("finish", currentLanguage) || "Bitir"}
                        </button>
                      )}
                       {(user?.roleSettings?.name === "admin" ||
                         user?.roleSettings?.name === "maintenanceManager") && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDelete({
                              open: true,
                              type: "record",
                              id: e.id,
                              name: `${e.machine || "-"} (${e.type === "maintenance" ? "Bakım" : "Arıza"})`,
                            });
                          }}
                          className="text-xs px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40 flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
              
              // Mobilde electric border'ı devre dışı bırak (performans için)
              const isMobile = window.innerWidth < 768;
              
              return !isCompleted && !isMobile ? (
                <ElectricBorder
                  key={e.id}
                  color={e.type === "fault" ? "#fb7185" : "#34d399"}
                  speed={1}
                  chaos={0.5}
                  thickness={2}
                  style={{ borderRadius: 16 }}
                >
                  {cardInnerContent}
                </ElectricBorder>
              ) : (
                <div key={e.id}>
                  {cardInnerContent}
                </div>
              );
            })}
            {entries.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Henüz kayıt yok. Sol üstteki <strong>+ Yeni</strong> butonu ile ilk kaydı oluşturabilirsiniz.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer for quick create */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
          <div className="w-full sm:w-[480px] max-w-[520px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Hızlı Kayıt</div>
                <div className="text-lg font-semibold">+ Yeni</div>
              </div>
              <button onClick={() => setShowDrawer(false)} className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">Kapat</button>
            </div>
            <div className="p-4 space-y-4 overflow-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Makine Grubu</label>
                  <select
                    value={drawerGroupId || ""}
                    onChange={(e) => setDrawerGroupId(Number(e.target.value) || null)}
                    className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="">Grup seç</option>
                    {machineGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Tip</label>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setType("maintenance")} className={`px-3 py-2 rounded-md border text-sm ${type === "maintenance" ? "border-blue-500 text-blue-600" : "border-gray-300 dark:border-gray-600"}`}>Bakım</button>
                    <button type="button" onClick={() => setType("fault")} className={`px-3 py-2 rounded-md border text-sm ${type === "fault" ? "border-blue-500 text-blue-600" : "border-gray-300 dark:border-gray-600"}`}>Arıza</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Makine</label>
                  <select
                    value={machine}
                    onChange={(e) => setMachine(e.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="">{getTranslation("selectMachineFirst", currentLanguage) || "Makine seç"}</option>
                    {drawerMachines.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Operatör</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="">{getTranslation("select", currentLanguage) || "Seçin"}</option>
                    {drawerOperators.map((o) => (
                      <option key={o.id} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setCause(""); // Kategori değiştiğinde sebep seçimini sıfırla
                    }}
                    className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="">{getTranslation("select", currentLanguage) || "Seçin"}</option>
                    {drawerCategories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Sebep</label>
                  <select
                    value={cause}
                    onChange={(e) => setCause(e.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value="">{getTranslation("select", currentLanguage) || "Seçin"}</option>
                    {drawerCauses.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Tarih/Saat Modu - Bakım mühendisi için */}
              {(user?.roleSettings?.name === "maintenanceEngineer" || 
                user?.roleSettings?.name === "maintenanceManager" || 
                user?.roleSettings?.name === "admin") && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Zaman Modu</label>
                    <div className="mt-2 flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setStartMode("now")} 
                        className={`px-3 py-2 rounded-md border text-sm ${
                          startMode === "now" 
                            ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20" 
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Şimdi
                      </button>
                      <button 
                        type="button"
                        onClick={() => setStartMode("manual")} 
                        className={`px-3 py-2 rounded-md border text-sm ${
                          startMode === "manual" 
                            ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20" 
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        Geçmiş Kayıt
                      </button>
                    </div>
                  </div>
                  
                  {startMode === "manual" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Başlangıç Tarih/Saat</label>
                        <input
                          type="datetime-local"
                          value={manualStart}
                          onChange={(e) => setManualStart(e.target.value)}
                          className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Bitiş Tarih/Saat</label>
                        <input
                          type="datetime-local"
                          value={manualEnd}
                          onChange={(e) => setManualEnd(e.target.value)}
                          className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Bakım Personeli Seçimi */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Bakım Personeli</label>
                    <select
                      multiple
                      value={selectedPersonnel.map(p => String(p.id))}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => 
                          maintenancePersonnel.find(p => String(p.id) === option.value)
                        ).filter(Boolean);
                        setSelectedPersonnel(selected);
                      }}
                      className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[80px]"
                      size={3}
                    >
                      {maintenancePersonnel.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.username} {p.roleDisplayName ? `(${p.roleDisplayName})` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      Çoklu seçim için Ctrl (Windows) veya Cmd (Mac) tuşuna basılı tutun
                    </p>
                  </div>
                </div>
              )}
              
              <button
                onClick={(e) => { handleSubmit(e); setShowDrawer(false); }}
                className="w-full px-4 py-3 rounded-md bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30"
              >
                Kaydı Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {getAllowedSubTabs.includes("reports") && activeSubTab === "reports" && (
        <div className="bg-white dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
              <option>{getTranslation("machine", currentLanguage) || "Makine"}</option>
              {lookups.machines.map((m) => <option key={m}>{m}</option>)}
            </select>
            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
              <option>{getTranslation("maintenanceType", currentLanguage) || "Tip"}</option>
              <option>{getTranslation("maintenance", currentLanguage) || "Bakım"}</option>
              <option>{getTranslation("fault", currentLanguage) || "Arıza"}</option>
            </select>
            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
              <option>{getTranslation("category", currentLanguage) || "Kategori"}</option>
              {lookups.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
              <option>{getTranslation("operatorName", currentLanguage) || "Operatör"}</option>
              {lookups.operators.map((o) => <option key={o}>{o}</option>)}
            </select>
            <button className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm">{getTranslation("filter", currentLanguage) || "Filtrele"}</button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-300">
                  <th className="py-2">#{getTranslation("id", currentLanguage) || "ID"}</th>
                  <th className="py-2">{getTranslation("maintenanceType", currentLanguage) || "Tip"}</th>
                  <th className="py-2">{getTranslation("machine", currentLanguage) || "Makine"}</th>
                  <th className="py-2">{getTranslation("category", currentLanguage) || "Kategori"}</th>
                  <th className="py-2">{getTranslation("duration", currentLanguage) || "Süre"}</th>
                  <th className="py-2">{getTranslation("createdAt", currentLanguage) || "Oluşturma"}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-2">{e.id.slice(0, 6)}</td>
                    <td className="py-2 capitalize">{e.type === "maintenance" ? getTranslation("maintenance", currentLanguage) || "Bakım" : getTranslation("fault", currentLanguage) || "Arıza"}</td>
                    <td className="py-2">{e.machine || "-"}</td>
                    <td className="py-2">{e.category || "-"}</td>
                    <td className="py-2">{e.durationMinutes} dk</td>
                    <td className="py-2">{e.createdAt ? new Date(e.createdAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td className="py-4 text-center text-gray-500 dark:text-gray-400" colSpan={6}>{getTranslation("noDataInTimeRange", currentLanguage) || "Kayıt yok"}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {getAllowedSubTabs.includes("admin") && activeSubTab === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
          {/* Left: Machine groups only */}
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-gray-300 dark:border-slate-700 shadow-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-sky-400" /> Makine Grupları
            </h3>
            <div className="space-y-1 max-h-[60vh] overflow-auto pr-1 no-scrollbar">
              {machineGroups.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-sm cursor-pointer transition ${
                    selectedGroupId === g.id
                      ? "bg-sky-600/90 text-white shadow-sm shadow-sky-500/40"
                      : "bg-gray-100 dark:bg-slate-800/60 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-700/80"
                  }`}
                  onClick={() => {
                    if (selectedGroupId === g.id) {
                      // Aynı gruba tekrar tıklanırsa seçimi kaldır
                      setSelectedGroupId(null);
                      setSelectedMachineForOperators(null);
                      setSelectedCategoryAdminId(null);
                    } else {
                      // Yeni grup seçilirse, önceki seçimleri sıfırla
                      setSelectedGroupId(g.id);
                      setSelectedMachineForOperators(null);
                      setSelectedCategoryAdminId(null);
                    }
                  }}
                >
                  <span className="truncate">{g.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestDelete("group", g.id, g.name);
                    }}
                    className="text-xs opacity-70 hover:opacity-100 px-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {machineGroups.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-slate-300">Henüz grup yok</div>
              )}
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-300 dark:border-slate-700/70 mt-2">
              <input
                id="new-machine-group-input"
                className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 px-3 py-1.5 text-xs placeholder-gray-500 dark:placeholder-slate-400"
                placeholder="Yeni makine grubu"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const el = document.getElementById("new-machine-group-input");
                    const val = el?.value?.trim();
                    if (!val) return;
                    handleAddMachineGroup(val);
                    el.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("new-machine-group-input");
                  const val = el?.value?.trim();
                  if (!val) return;
                  handleAddMachineGroup(val);
                  el.value = "";
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md shadow-sky-500/40"
              >
                Ekle
              </button>
            </div>
          </div>

          {/* Right: Detail panel (only if a group is selected) */}
          <div>
            {!selectedGroupId && (
              <div className="h-full flex items-center justify-center text-gray-600 dark:text-slate-300 text-sm">
                Lütfen soldan bir <strong className="mx-1">makine grubu</strong> seçin.
              </div>
            )}

            {selectedGroupId && (
              <>
                {/* Üst satır: Makineler → Operatörler (soldan sağa) */}
                <div className="flex gap-4 text-xs relative z-10 flex-wrap">
                  {/* Machines - Always shown when group is selected */}
                  <div className="bg-white dark:bg-slate-900/80 border border-gray-300 dark:border-slate-700 rounded-xl p-3 flex flex-col h-[32vh] min-h-[300px] flex-1 min-w-[280px] max-w-[400px] animate-fadeInUp">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-900 dark:text-slate-100 font-semibold flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-emerald-400" /> Makineler
                      </span>
                      {isLoadingLookups && (
                        <span className="text-[11px] text-gray-500 dark:text-slate-400">Yükleniyor...</span>
                      )}
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {groupMachines.map((m, index) => {
                        const isSel = selectedMachineForOperators === m.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-300 ease-out ${
                              isSel
                                ? "bg-emerald-500/90 text-white shadow-sm shadow-emerald-500/40"
                                : "bg-gray-100 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-700/80"
                            }`}
                            style={{
                              animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                            }}
                            onClick={() => handleSelectMachineForOperators(isSel ? null : m.id)}
                          >
                            <span className="truncate">{m.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDelete("machine", m.id, m.name);
                              }}
                              className="text-[10px] opacity-80 hover:opacity-100 px-1.5"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      {groupMachines.length === 0 && (
                        <div className="text-gray-500 dark:text-slate-400 text-xs">Bu grupta makine yok</div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-300 dark:border-slate-700/70 mt-2">
                      <input
                        id="new-machine-input"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 px-2.5 py-1.5 text-xs placeholder-gray-500 dark:placeholder-slate-500"
                        placeholder="Makine ekle"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const el = document.getElementById("new-machine-input");
                            const val = el?.value?.trim();
                            if (!val) return;
                            handleAddMachine(val);
                            el.value = "";
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("new-machine-input");
                          const val = el?.value?.trim();
                          if (!val) return;
                          handleAddMachine(val);
                          el.value = "";
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold shadow-md shadow-emerald-500/40"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>

                  {/* Operators - Only shown when machine is selected */}
                  {selectedMachineForOperators && (
                    <div className="bg-white dark:bg-slate-900/80 border border-gray-300 dark:border-slate-700 rounded-xl p-3 flex flex-col h-[32vh] min-h-[300px] flex-1 min-w-[280px] max-w-[400px] animate-fadeInUp">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-900 dark:text-slate-100 font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" /> Operatörler
                      </span>
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {machineOperators.map((o, index) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-700/80 transition-all duration-300 ease-out"
                          style={{
                            animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                          }}
                        >
                          <span className="truncate">{o.name}</span>
                          <button
                            type="button"
                            onClick={() => requestDelete("operator", o.id, o.name)}
                            className="text-[11px] opacity-80 hover:opacity-100 px-1.5"
                          >
                            Sil
                          </button>
                        </div>
                      ))}
                      {selectedMachineForOperators && machineOperators.length === 0 && (
                        <div className="text-gray-500 dark:text-slate-400 text-xs">Bu makine için operatör yok</div>
                      )}
                      {!selectedMachineForOperators && (
                        <div className="text-gray-500 dark:text-slate-500 text-xs">
                          Önce yukarıdan bir <strong className="mx-1">makine</strong> seçin.
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-300 dark:border-slate-700/70 mt-2">
                      <input
                        id="new-operator-input"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 px-2.5 py-1.5 text-xs placeholder-gray-500 dark:placeholder-slate-500"
                        placeholder="Operatör ekle"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && selectedMachineForOperators) {
                            const el = document.getElementById("new-operator-input");
                            const val = el?.value?.trim();
                            if (!val) return;
                            handleAddOperator(val);
                            el.value = "";
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={!selectedMachineForOperators}
                        onClick={() => {
                          const el = document.getElementById("new-operator-input");
                          const val = el?.value?.trim();
                          if (!val) return;
                          handleAddOperator(val);
                          el.value = "";
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-500/40 disabled:opacity-40"
                      >
                        Ekle
                      </button>
                    </div>
                    </div>
                  )}
                </div>

                {/* Alt satır: Kategoriler → Sebepler (soldan sağa) */}
                <div className="flex gap-4 text-xs relative z-20 mt-4 flex-wrap">
                  {/* Categories - Always shown when group is selected */}
                  <div className="bg-white dark:bg-slate-900/80 border border-gray-300 dark:border-slate-700 rounded-xl p-3 flex flex-col h-[32vh] min-h-[300px] flex-1 min-w-[280px] max-w-[400px] animate-fadeInUp">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-900 dark:text-slate-100 font-semibold flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-amber-400" /> Kategoriler
                      </span>
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {groupCategories.map((c, index) => {
                        const isSel = selectedCategoryAdminId === c.id;
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-300 ease-out ${
                              isSel
                                ? "bg-amber-500/90 text-gray-900 dark:text-slate-900 shadow-sm shadow-amber-500/40"
                                : "bg-gray-100 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-700/80"
                            }`}
                            style={{
                              animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                            }}
                            onClick={() => setSelectedCategoryAdminId(isSel ? null : c.id)}
                          >
                            <span className="truncate">{c.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDelete("category", c.id, c.name);
                              }}
                              className="text-[10px] opacity-80 hover:opacity-100 px-1.5"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                      {groupCategories.length === 0 && (
                        <div className="text-gray-500 dark:text-slate-400 text-xs">Bu grupta kategori yok</div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-300 dark:border-slate-700/70 mt-2">
                      <input
                        id="new-category-input"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 px-2.5 py-1.5 text-xs placeholder-gray-500 dark:placeholder-slate-500"
                        placeholder="Kategori ekle"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const el = document.getElementById("new-category-input");
                            const val = el?.value?.trim();
                            if (!val) return;
                            handleAddCategory(val);
                            el.value = "";
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("new-category-input");
                          const val = el?.value?.trim();
                          if (!val) return;
                          handleAddCategory(val);
                          el.value = "";
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-900 dark:text-slate-900 text-xs font-semibold shadow-md shadow-amber-500/40"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>

                  {/* Causes - Only shown when category is selected */}
                  {selectedCategoryAdminId && (
                    <div className="bg-white dark:bg-slate-900/80 border border-gray-300 dark:border-slate-700 rounded-xl p-3 flex flex-col h-[32vh] min-h-[300px] flex-1 min-w-[280px] max-w-[400px] animate-fadeInUp">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-900 dark:text-slate-100 font-semibold flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-rose-400" /> Sebepler
                      </span>
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {groupCauses
                        .filter((c) => !selectedCategoryAdminId || c.categoryId === selectedCategoryAdminId)
                        .map((c, index) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-700/80 transition-all duration-300 ease-out"
                            style={{
                              animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both`
                            }}
                          >
                            <span className="truncate">{c.name}</span>
                            <button
                              type="button"
                              onClick={() => requestDelete("cause", c.id, c.name)}
                              className="text-[11px] opacity-80 hover:opacity-100 px-1.5"
                            >
                              Sil
                            </button>
                          </div>
                        ))}
                      {selectedCategoryAdminId && !groupCauses.some((c) => c.categoryId === selectedCategoryAdminId) && (
                        <div className="text-gray-500 dark:text-slate-400 text-xs">Bu kategori için sebep yok</div>
                      )}
                      {!selectedCategoryAdminId && (
                        <div className="text-gray-500 dark:text-slate-500 text-xs">
                          Önce yukarıdan bir <strong className="mx-1">kategori</strong> seçin.
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-300 dark:border-slate-700/70 mt-2">
                      <input
                        id="new-cause-input"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-slate-100 px-2.5 py-1.5 text-xs placeholder-gray-500 dark:placeholder-slate-500"
                        placeholder="Sebep ekle"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && selectedCategoryAdminId) {
                            const el = document.getElementById("new-cause-input");
                            const val = el?.value?.trim();
                            if (!val) return;
                            handleAddCause(val);
                            el.value = "";
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={!selectedCategoryAdminId}
                        onClick={() => {
                          const el = document.getElementById("new-cause-input");
                          const val = el?.value?.trim();
                          if (!val) return;
                          handleAddCause(val);
                          el.value = "";
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold shadow-md shadow-rose-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Ekle
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Record Drawer */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setEditingRecord(null)} />
          <div className="w-full sm:w-[520px] max-w-[600px] bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50">
                {getTranslation("editRecord", currentLanguage) || "Kayıt Düzenle"}
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 space-y-4">
              {/* Record Info (machine, type, start locked) */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 space-y-1 text-sm">
                <div><strong>{getTranslation("machine", currentLanguage) || "Makine"}:</strong> {editingRecord.machine}</div>
                <div><strong>{getTranslation("maintenanceType", currentLanguage) || "Tip"}:</strong> {editingRecord.type === "maintenance" ? (getTranslation("maintenance", currentLanguage) || "Bakım") : (getTranslation("fault", currentLanguage) || "Arıza")}</div>
                {editingRecord.start && (
                  <div>
                    <strong>{getTranslation("startedAt", currentLanguage) || "Başlangıç"}:</strong>{" "}
                    {new Date(editingRecord.start).toLocaleString()}
                  </div>
                )}
                {editingRecord.end && (
                  <div>
                    <strong>{getTranslation("endedAt", currentLanguage) || "Bitiş"}:</strong>{" "}
                    {new Date(editingRecord.end).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Editable Category & Cause */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {getTranslation("category", currentLanguage) || "Kategori"}
                  </label>
                  <select
                    value={editCategoryId || ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setEditCategoryId(val);
                      setEditCauseId(null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="">{getTranslation("select", currentLanguage) || "Seçin"}</option>
                    {allCategories
                      .filter((c) => !editingRecord.machineGroupId || c.machineGroupId === editingRecord.machineGroupId)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {getTranslation("cause", currentLanguage) || "Sebep"}
                  </label>
                  <select
                    value={editCauseId || ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setEditCauseId(val);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="">{getTranslation("select", currentLanguage) || "Seçin"}</option>
                    {allCauses
                      .filter((c) => {
                        if (editingRecord.machineGroupId && c.machineGroupId !== editingRecord.machineGroupId) return false;
                        if (editCategoryId && c.categoryId !== editCategoryId) return false;
                        return true;
                      })
                      .map((cause) => (
                        <option key={cause.id} value={cause.id}>
                          {cause.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {getTranslation("notes", currentLanguage) || "Açıklama"}
                </label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  placeholder={getTranslation("addNotes", currentLanguage) || "Notlar ekleyin..."}
                />
              </div>

              {/* Photo Upload & Annotation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {getTranslation("photo", currentLanguage) || "Fotoğraf"}
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEditFileChange}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  />
                  {editPhotos.map((photo) => {
                    // Initialize refs if not exists
                    if (!photoCanvasRefs.current[photo.id]) {
                      photoCanvasRefs.current[photo.id] = { current: null };
                      photoImageRefs.current[photo.id] = { current: null };
                    }
                    const canvasRef = photoCanvasRefs.current[photo.id];
                    const imageRef = photoImageRefs.current[photo.id];
                    return (
                      <div key={photo.id} className="space-y-2">
                        <div className="relative border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <img
                            src={photo.annotated || photo.preview}
                            alt="Preview"
                            className="w-full h-auto max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              setEditingPhoto(photo);
                              setIsPhotoEditorOpen(true);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeEditPhoto(photo.id)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg z-10"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Materials */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getTranslation("materialsUsed", currentLanguage) || "Kullanılan Malzemeler"}
                  </label>
                  <button
                    type="button"
                    onClick={addMaterialRow}
                    className="text-xs px-2 py-1 bg-green-500 hover:bg-green-400 text-white rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {getTranslation("addRow", currentLanguage) || "Satır Ekle"}
                  </button>
                </div>
                <div className="space-y-2">
                  {editMaterials.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                      {getTranslation("noMaterials", currentLanguage) || "Henüz malzeme eklenmedi"}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-gray-300 dark:border-gray-600">
                        <thead className="bg-gray-100 dark:bg-slate-800">
                          <tr>
                            <th className="px-2 py-1 text-left border w-3/5">Malzeme</th>
                            <th className="px-2 py-1 text-left border">Miktar (adet)</th>
                            <th className="px-2 py-1 border w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editMaterials.map((mat, idx) => (
                            <tr key={idx}>
                              <td className="px-2 py-1 border">
                                <input
                                  type="text"
                                  value={mat.name || ""}
                                  onChange={(e) => updateMaterialField(idx, "name", e.target.value)}
                                  className="w-full px-1 py-0.5 bg-transparent border-0"
                                  placeholder="Malzeme adı"
                                />
                              </td>
                              <td className="px-2 py-1 border">
                                <input
                                  type="number"
                                  value={mat.quantity || ""}
                                  onChange={(e) => updateMaterialField(idx, "quantity", e.target.value)}
                                  className="w-full px-1 py-0.5 bg-transparent border-0"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1 border text-center">
                                <button
                                  type="button"
                                  onClick={() => removeMaterialRow(idx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
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

              {/* Save Button */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={handleUpdateRecord}
                  className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {getTranslation("save", currentLanguage) || "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-300 dark:border-slate-700 shadow-2xl max-w-md w-full p-4 space-y-3">
            <h4 className="text-base font-semibold text-gray-900 dark:text-slate-50">Silme Onayı</h4>
            <p className="text-sm text-gray-700 dark:text-slate-200">
              <strong>{confirmDelete.name || "Bu kayıt"}</strong> silinecek. Devam etmek istiyor musun?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDelete({ open: false, type: "", id: null, name: "" })}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-md bg-rose-500 hover:bg-rose-400 text-sm font-semibold text-white shadow-md shadow-rose-500/40"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Editor Modal */}
      <PhotoEditorModal
        isOpen={isPhotoEditorOpen}
        onClose={() => {
          setIsPhotoEditorOpen(false);
          setEditingPhoto(null);
        }}
        photo={editingPhoto}
        onSave={handlePhotoEditorSave}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}

export default MaintenanceManualPage;

// CSS Animations için style tag ekle
if (typeof document !== 'undefined') {
  const styleId = 'maintenance-manual-animations';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-pulse-subtle {
        animation: pulse-subtle 3s ease-in-out infinite;
      }
      
      .animate-fadeInUp {
        animation: fadeInUp 0.4s ease-out;
      }
    `;
    document.head.appendChild(style);
  }
}

