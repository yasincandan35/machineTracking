import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTranslation } from "../utils/translations";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
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
  const [activeSubTab, setActiveSubTab] = useState("record"); // record | reports | admin
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
  const [type, setType] = useState("maintenance"); // maintenance | fault
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
  
  // Edit record state
  const [editingRecord, setEditingRecord] = useState(null);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCauseId, setEditCauseId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editPhotos, setEditPhotos] = useState([]); // Array of { id, preview, annotated, canvasRef, imageRef, isDrawing }
  const [editMaterials, setEditMaterials] = useState([]);

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

  // Load all lookup data for record display
  const loadAllLookups = async () => {
    try {
      // Load all machine groups first
      const groupsRes = await api.get("/maintenance/lookups/machine-groups");
      const groups = groupsRes.data || [];
      
      // Load all machines, categories, causes, operators from all groups
      const machinesPromises = groups.map((g) =>
        api.get(`/maintenance/lookups/machines?machineGroupId=${g.id}`).catch(() => ({ data: [] }))
      );
      const categoriesPromises = groups.map((g) =>
        api.get(`/maintenance/lookups/categories?machineGroupId=${g.id}`).catch(() => ({ data: [] }))
      );
      const causesPromises = groups.map((g) =>
        api.get(`/maintenance/lookups/causes?machineId=0&machineGroupId=${g.id}`).catch(() => ({ data: [] }))
      );

      const [machinesResults, categoriesResults, causesResults] = await Promise.all([
        Promise.all(machinesPromises),
        Promise.all(categoriesPromises),
        Promise.all(causesPromises),
      ]);

      const allMachinesFlat = machinesResults.flatMap((r) => r.data || []);
      const allCategoriesFlat = categoriesResults.flatMap((r) => r.data || []);
      const allCausesFlat = causesResults.flatMap((r) => r.data || []);

      setAllMachines(allMachinesFlat);
      setAllCategories(allCategoriesFlat);
      setAllCauses(allCausesFlat);

      // Load operators for all machines
      const operatorPromises = allMachinesFlat.map((m) =>
        api.get(`/maintenance/lookups/operators?machineId=${m.id}`).catch(() => ({ data: [] }))
      );
      const operatorsResults = await Promise.all(operatorPromises);
      const allOperatorsFlat = operatorsResults.flatMap((r) => r.data || []);
      setAllOperators(allOperatorsFlat);
    } catch (err) {
      console.error("Lookup verileri yüklenemedi:", err);
    }
  };

  const loadRecords = useCallback(async () => {
    try {
      const res = await api.get("/maintenance/records");
      const items = res.data?.items || res.data || [];
      // Filter out invalid records (must have id, machineGroupId, and machineId)
      const validItems = items.filter((j) => 
        j && 
        j.id && 
        j.machineGroupId && 
        j.machineId // Machine selection is mandatory
      );
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
        machineId: j.machineId,
        categoryId: j.categoryId,
        causeId: j.causeId,
        operatorId: j.operatorId,
        machineGroupId: j.machineGroupId,
        photoData: j.photoData,
        materialsJson: j.materialsJson,
      }));
      setEntries(mapped);
    } catch (err) {
      console.error("Bakım kayıtları yüklenemedi:", err);
    }
  }, [resolveMachineName, resolveCategoryName, resolveCauseName, resolveOperatorName]);

  // İlk açılışta lookup verilerini yükle, sonra kayıtları çek
  useEffect(() => {
    loadAllLookups();
  }, []);

  // Lookup verileri yüklendikten sonra kayıtları çek ve periyodik güncelle
  useEffect(() => {
    // Wait for lookup data to be loaded before loading records
    // This ensures resolveMachineName etc. functions work correctly
    if (allMachines.length > 0) {
      loadRecords();
      const timer = setInterval(() => {
        loadRecords();
      }, 15000);
      return () => clearInterval(timer);
    } else {
      // If lookups aren't loaded yet, still try to load records once
      // (they'll show IDs until lookups are ready)
      loadRecords();
    }
  }, [allMachines.length, loadRecords]);

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
        setMachineGroups(res.data || []);
        if (!selectedGroupId && res.data && res.data.length > 0) {
          setSelectedGroupId(res.data[0].id);
        }
        if (!drawerGroupId && res.data && res.data.length > 0) {
          setDrawerGroupId(res.data[0].id);
        }
      } catch (err) {
        console.error("Makine grupları yüklenemedi:", err);
      }
    };
    loadMachineGroups();
  }, [selectedGroupId, drawerGroupId]);

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
      if (!category) return;
      const catObj = drawerCategories.find((c) => c.name === category);
      const machineObj = drawerMachines.find((m) => m.name === machine);
      const catId = catObj?.id;
      const machineId = machineObj?.id || 0;
      if (!catId) return;
      try {
        const res = await api.get(`/maintenance/lookups/causes?machineId=${machineId}&categoryId=${catId}&machineGroupId=${drawerGroupId || 0}`);
        setDrawerCauses(res.data || []);
        setCause((prev) => {
          const exists = (res.data || []).some((c) => c.name === prev);
          return exists ? prev : "";
        });
      } catch (err) {
        console.error("Drawer sebepler yüklenemedi:", err);
      }
    };
    loadDrawerCausesForCategory();
  }, [category, drawerCategories, drawerMachines, drawerGroupId, machine]);

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
          // Convert file to base64 if not annotated
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(photo.file);
          });
        })
      );
      
      const payload = {
        notes: editNote,
        photoData: photoDataArray.length > 0 ? JSON.stringify(photoDataArray) : null,
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
      await api.put(`/maintenance/records/${editingRecord.id}`, payload);
      setEditingRecord(null);
      setEditNote("");
      setEditPhotos([]);
      setEditMaterials([]);
      setEditCategoryId(null);
      setEditCauseId(null);
      loadRecords(); // Refresh list
    } catch (err) {
      console.error("Kayıt güncellenemedi:", err);
      alert("Kayıt güncellenirken hata oluştu");
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
    setType("maintenance");
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
    const start = startMode === "now" ? (startedAt || nowDefault) : manualStart || null;
    const end = startMode === "now" ? endedAt : manualEnd || null;

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
      performedByUserId: null,
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
    if (!name || !selectedGroupId || groupMachines.length === 0) {
      alert("Sebep eklemek için önce bir makine grubu seçin ve makine ekleyin.");
      return;
    }
    if (!selectedCategoryAdminId) {
      alert("Sebep eklemek için önce bir kategori seçin.");
      return;
    }
    try {
      // Seçilen kategoriyi kullan, makine için ilk makineyi kullan (kategori makine grubuna bağlı)
      const firstMachineId = groupMachines[0].id;
      const res = await api.post("/maintenance/lookups/causes", {
        name,
        machineId: firstMachineId,
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
    try {
      if (type === "group") await handleDeleteMachineGroup(id);
      if (type === "machine") await handleDeleteMachine(id);
      if (type === "category") await handleDeleteCategory(id);
      if (type === "cause") await handleDeleteCause(id);
      if (type === "operator") await handleDeleteOperator(id);
      if (type === "record") {
        await api.delete(`/maintenance/records/${id}`);
        await loadRecords();
      }
    } finally {
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

      {/* Tabs (hide for maintenanceStaff) */}
      {!user || user.role !== "maintenanceStaff" ? (
        <div className="flex flex-wrap gap-2">
          {[{ key: "record", label: getTranslation("maintenanceRecord", currentLanguage) || "Kayıt", icon: FileUp },
            { key: "reports", label: getTranslation("maintenanceReports", currentLanguage) || "Raporlar", icon: Sparkles },
            { key: "admin", label: getTranslation("maintenanceAdmin", currentLanguage) || "Yönetim", icon: Users }].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
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
            {entries.map((e) => {
              const isCompleted = !!e.end;
              // Tamamlanan kayıtlar için gri tonlar, devam edenler için renkli
              const tone = isCompleted
                ? "border-gray-300 bg-gray-100/70 dark:bg-gray-800/50 dark:border-gray-700 opacity-75"
                : e.type === "fault"
                ? "border-rose-400 bg-rose-50/70 dark:bg-rose-900/20"
                : "border-emerald-400 bg-emerald-50/70 dark:bg-emerald-900/20";
              const badge = e.type === "fault"
                ? (getTranslation("fault", currentLanguage) || "Arıza")
                : (getTranslation("maintenance", currentLanguage) || "Bakım");
              const statusLabel = isCompleted ? (getTranslation("completed", currentLanguage) || "Bitti") : (getTranslation("inProgress", currentLanguage) || "Devam Ediyor");
              return (
                <div
                  key={e.id}
                  className={`rounded-xl border ${tone} p-3 flex flex-col justify-between shadow-sm transition-opacity`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-white/80 text-gray-900 border border-gray-200">
                          {badge}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-300">
                          {e.machine || "-"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-200">
                        {e.category || "-"} {e.cause ? `· ${e.cause}` : ""}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                    {e.note || "-"}
                  </div>
                   <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
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
                    <div className="mt-2 flex gap-1">
                      <button
                        onClick={() => {
                          setEditingRecord(e);
                          setEditNote(e.note || "");
                          // Parse photos from JSON array or single string
                          try {
                            let photosData = [];
                            if (e.photoData) {
                              try {
                                photosData = JSON.parse(e.photoData);
                                if (!Array.isArray(photosData)) photosData = [photosData];
                              } catch {
                                photosData = [e.photoData]; // Single photo as string
                              }
                            }
                            setEditPhotos(photosData.map((photoData) => ({
                              id: generateId(),
                              preview: photoData,
                              annotated: photoData,
                              file: null,
                              isDrawing: false
                            })));
                          } catch {
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
                          setEditCategoryId(e.categoryId || null);
                          setEditCauseId(e.causeId || null);
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
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
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Not</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" placeholder="Kısa not" />
              </div>
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

      {activeSubTab === "reports" && (
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

      {activeSubTab === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
          {/* Left: Machine groups only */}
          <div className="bg-slate-900/70 dark:bg-slate-900/80 rounded-2xl border border-slate-700 shadow-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-sky-400" /> Makine Grupları
            </h3>
            <div className="space-y-1 max-h-[60vh] overflow-auto pr-1 no-scrollbar">
              {machineGroups.map((g) => (
                <div
                  key={g.id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-sm cursor-pointer transition ${
                    selectedGroupId === g.id
                      ? "bg-sky-600/90 text-white shadow-sm shadow-sky-500/40"
                      : "bg-slate-800/60 text-slate-100 hover:bg-slate-700/80"
                  }`}
                  onClick={() => setSelectedGroupId(g.id)}
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
                <div className="text-xs text-slate-300">Henüz grup yok</div>
              )}
            </div>
            <div className="flex gap-2 pt-3 border-t border-slate-700/70 mt-2">
              <input
                id="new-machine-group-input"
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-100 px-3 py-1.5 text-xs placeholder-slate-400"
                placeholder="Yeni makine grubu"
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
          <div className="bg-slate-900/60 dark:bg-slate-900/80 rounded-2xl border border-slate-700 shadow-lg p-4 space-y-4">
            {!selectedGroupId && (
              <div className="h-full flex items-center justify-center text-slate-300 text-sm">
                Lütfen soldan bir <strong className="mx-1">makine grubu</strong> seçin.
              </div>
            )}

            {selectedGroupId && (
              <>
                {/* Machines & operators */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs max-h-[28vh]">
                  {/* Machines */}
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-100 font-semibold flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-emerald-400" /> Makineler
                      </span>
                      {isLoadingLookups && (
                        <span className="text-[11px] text-slate-400">Yükleniyor...</span>
                      )}
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {groupMachines.map((m) => {
                        const isSel = selectedMachineForOperators === m.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                              isSel
                                ? "bg-emerald-500/90 text-white shadow-sm shadow-emerald-500/40"
                                : "bg-slate-800/80 text-slate-100 hover:bg-slate-700/80"
                            }`}
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
                        <div className="text-slate-400 text-xs">Bu grupta makine yok</div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-700/70 mt-2">
                      <input
                        id="new-machine-input"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-100 px-2.5 py-1.5 text-xs placeholder-slate-500"
                        placeholder="Makine ekle"
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

                  {/* Operators */}
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-100 font-semibold flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" /> Operatörler
                      </span>
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {machineOperators.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-100 hover:bg-slate-700/80 transition"
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
                        <div className="text-slate-400 text-xs">Bu makine için operatör yok</div>
                      )}
                      {!selectedMachineForOperators && (
                        <div className="text-slate-500 text-xs">
                          Önce yukarıdan bir <strong className="mx-1">makine</strong> seçin.
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-700/70 mt-2">
                      <input
                        id="new-operator-input"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-100 px-2.5 py-1.5 text-xs placeholder-slate-500"
                        placeholder="Operatör ekle"
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
                </div>

                {/* Categories & causes, same master-detail mantığı */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs max-h-[28vh]">
                  {/* Categories */}
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-100 font-semibold flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-amber-400" /> Kategoriler
                      </span>
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {groupCategories.map((c) => {
                        const isSel = selectedCategoryAdminId === c.id;
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                              isSel
                                ? "bg-amber-500/90 text-slate-900 shadow-sm shadow-amber-500/40"
                                : "bg-slate-800/80 text-slate-100 hover:bg-slate-700/80"
                            }`}
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
                        <div className="text-slate-400 text-xs">Bu grupta kategori yok</div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-700/70 mt-2">
                      <input
                        id="new-category-input"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-100 px-2.5 py-1.5 text-xs placeholder-slate-500"
                        placeholder="Kategori ekle"
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
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-semibold shadow-md shadow-amber-500/40"
                      >
                        Ekle
                      </button>
                    </div>
                  </div>

                  {/* Causes */}
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-100 font-semibold flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-rose-400" /> Sebepler
                      </span>
                    </div>
                    <div className="space-y-1.5 overflow-auto no-scrollbar flex-1 pr-1">
                      {groupCauses
                        .filter((c) => !selectedCategoryAdminId || c.categoryId === selectedCategoryAdminId)
                        .map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/80 text-slate-100 hover:bg-slate-700/80 transition"
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
                        <div className="text-slate-400 text-xs">Bu kategori için sebep yok</div>
                      )}
                      {!selectedCategoryAdminId && (
                        <div className="text-slate-500 text-xs">
                          Önce yukarıdan bir <strong className="mx-1">kategori</strong> seçin.
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-700/70 mt-2">
                      <input
                        id="new-cause-input"
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-800/80 text-slate-100 px-2.5 py-1.5 text-xs placeholder-slate-500"
                        placeholder="Sebep ekle"
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
                    disabled={editingRecord && !!editingRecord.end}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-sm ${
                      editingRecord && !!editingRecord.end
                        ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900"
                        : ""
                    }`}
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
                    disabled={editingRecord && !!editingRecord.end}
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-sm ${
                      editingRecord && !!editingRecord.end
                        ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-900"
                        : ""
                    }`}
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
                            ref={(el) => {
                              if (imageRef) imageRef.current = el;
                              // Initialize canvas when image is loaded
                              if (el && canvasRef && canvasRef.current) {
                                const handleLoad = () => {
                                  const canvas = canvasRef.current;
                                  if (canvas && typeof canvas.getContext === "function") {
                                    try {
                                      canvas.width = el.naturalWidth || el.width || 800;
                                      canvas.height = el.naturalHeight || el.height || 600;
                                      const ctx = canvas.getContext("2d");
                                      ctx.drawImage(el, 0, 0);
                                    } catch (err) {
                                      console.warn("Canvas init error:", err);
                                    }
                                  }
                                };
                                if (el.complete && el.naturalWidth > 0) {
                                  handleLoad();
                                } else {
                                  el.onload = handleLoad;
                                }
                              }
                            }}
                            src={photo.annotated || photo.preview}
                            alt="Preview"
                            className="w-full h-auto max-h-64 object-contain"
                          />
                          <canvas
                            ref={(el) => {
                              if (canvasRef) canvasRef.current = el;
                            }}
                            onMouseDown={(e) => handleEditCanvasMouse(photo.id, canvasRef, e, "down")}
                            onMouseMove={(e) => handleEditCanvasMouse(photo.id, canvasRef, e, "move")}
                            onMouseUp={(e) => handleEditCanvasMouse(photo.id, canvasRef, e, "up")}
                            className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                            style={{ pointerEvents: photo.preview ? "auto" : "none" }}
                          />
                          <button
                            type="button"
                            onClick={() => removeEditPhoto(photo.id)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                        {photo.preview && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditAddText(photo.id, canvasRef)}
                              className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white rounded-lg"
                            >
                              {getTranslation("addText", currentLanguage) || "Metin Ekle"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditSaveAnnotation(photo.id, canvasRef)}
                              className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-400 text-white rounded-lg"
                            >
                              {getTranslation("saveAnnotation", currentLanguage) || "Çizimi Kaydet"}
                            </button>
                          </div>
                        )}
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
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full p-4 space-y-3">
            <h4 className="text-base font-semibold text-slate-50">Silme Onayı</h4>
            <p className="text-sm text-slate-200">
              <strong>{confirmDelete.name || "Bu kayıt"}</strong> silinecek. Devam etmek istiyor musun?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDelete({ open: false, type: "", id: null, name: "" })}
                className="px-4 py-2 rounded-md border border-slate-600 text-sm text-slate-200 hover:bg-slate-800"
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
    </div>
  );
}

export default MaintenanceManualPage;

