import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { createMachineApi } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { getTranslation } from '../utils/translations';
import { 
  Clock, 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Save
} from 'lucide-react';

const ShiftManagement = ({ darkMode = false, selectedMachine, currentLanguage = 'tr' }) => {
  const { user, token, refreshCount } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  
  const machineTableName = selectedMachine && selectedMachine.id !== -1
    ? selectedMachine.tableName
    : null;

  // 🆕 Dinamik Machine API - makine adına göre
  const machineApi = useMemo(() => {
    return createMachineApi(machineTableName);
  }, [machineTableName]);

  // State management
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [shiftGroups, setShiftGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthlyAssignments, setMonthlyAssignments] = useState([]);
  
  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  
  // Drag & Drop states
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShiftDetail, setSelectedShiftDetail] = useState(null);
  const [showWeeklySelector, setShowWeeklySelector] = useState(false);
  const [weeklyAssignmentTemplate, setWeeklyAssignmentTemplate] = useState(null);
  const [selectedWeekDays, setSelectedWeekDays] = useState([]);
  const [showMonthlyWeeklySelector, setShowMonthlyWeeklySelector] = useState(false);
  const [monthlyWeeklyTemplate, setMonthlyWeeklyTemplate] = useState(null);
  const [selectedMonthWeekDays, setSelectedMonthWeekDays] = useState([]);
  const [currentWeekDates, setCurrentWeekDates] = useState([]);
  const [showMobileTemplatePicker, setShowMobileTemplatePicker] = useState(false);
  const [mobileTemplateContext, setMobileTemplateContext] = useState(null);
  const [mobileTargetDay, setMobileTargetDay] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: '',
    startTime: '08:30',
    endTime: '20:30',
    color: '#ff0000'
  });

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    title: '',
    shiftGroup: '',
    active: true
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    description: ''
  });

  const [draggedItem, setDraggedItem] = useState(null);

  // Utility functions
  const getMonday = useCallback((date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
      setIsTouchDevice(hasTouch);
    }
  }, []);

  const dayNames = useMemo(() => [
    getTranslation('monday', currentLanguage),
    getTranslation('tuesday', currentLanguage), 
    getTranslation('wednesday', currentLanguage),
    getTranslation('thursday', currentLanguage),
    getTranslation('friday', currentLanguage),
    getTranslation('saturday', currentLanguage),
    getTranslation('sunday', currentLanguage)
  ], [currentLanguage]);

  const triggerSingleDayAssignment = useCallback((template, day, dayIndex) => {
    if (!template || !day) return;

    const dateObj = new Date(day);
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const dayNum = dateObj.getDate().toString().padStart(2, '0');
    const shiftDate = `${year}-${month}-${dayNum}`;

    setPendingAssignment({
      templateId: template.id,
      templateName: template.name,
      shiftDate,
      dayOfWeek: dayIndex,
      dayName: dayNames[dayIndex]
    });
    setSelectedEmployees([]);
    setShowEmployeeSelector(true);
  }, [dayNames]);

  // Data loading functions - DİNAMİK IP
  const loadTemplates = useCallback(async () => {
    if (!machineTableName) {
      setTemplates([]);
      return;
    }
    
    try {
      const response = await machineApi.get('/shiftmanagement/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Template\'ler yüklenemedi:', error);
    }
  }, [machineApi]);

  const loadEmployees = useCallback(async () => {
    if (!machineTableName) {
      setEmployees([]);
      return;
    }
    
    try {
      const response = await machineApi.get('/shiftmanagement/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Çalışanlar yüklenemedi:', error);
    }
  }, [machineApi]);

  const loadShiftGroups = useCallback(async () => {
    if (!machineTableName) {
      setShiftGroups([]);
      return;
    }
    
    try {
      const response = await machineApi.get('/shiftmanagement/groups');
      setShiftGroups(response.data);
    } catch (error) {
      console.error('Gruplar yüklenemedi:', error);
    }
  }, [machineApi]);

  const loadWeeklyAssignments = useCallback(async () => {
    if (!machineTableName) {
      setAssignments([]);
      return;
    }
    
    try {
      const monday = getMonday(currentWeek);
      const response = await machineApi.get(`/shiftmanagement/assignments/${monday.toISOString().split('T')[0]}`);
      setAssignments(response.data);
    } catch (error) {
      console.error('Vardiya atamaları yüklenemedi:', error);
    }
  }, [machineApi, currentWeek, getMonday]);

  const loadMonthlyAssignments = useCallback(async () => {
    if (!machineTableName) {
      setMonthlyAssignments([]);
      return;
    }
    
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      
      const response = await machineApi.get(`/shiftmanagement/assignments/monthly/${year}/${month}`);
      setMonthlyAssignments(response.data);
    } catch (error) {
      console.error('Aylık vardiya atamaları yüklenemedi:', error);
    }
  }, [machineApi, currentMonth]);

  // Load data
  // Dil tercihi Dashboard.jsx'den currentLanguage prop olarak gelecek
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Önce localStorage'dan kontrol et
        const savedLanguage = localStorage.getItem('selectedLanguage');
        if (savedLanguage) {
          setCurrentLanguage(savedLanguage);
          return;
        }
        
        // Dil tercihi Dashboard.jsx'den geliyor (user.languageSelection)
      } catch (err) {
        // API hatası durumunda localStorage'dan dene
        const savedLanguage = localStorage.getItem('selectedLanguage');
        if (savedLanguage) {
          setCurrentLanguage(savedLanguage);
        }
      }
    };

    if (user?.id) {
      loadPreferences();
    }
  }, [user?.id]);

  useEffect(() => {
    if (token && machineTableName) {
      loadTemplates();
      loadEmployees();
      loadShiftGroups();
    }
  }, [token, machineTableName, loadTemplates, loadEmployees, loadShiftGroups]);

  useEffect(() => {
    if (token && machineTableName) {
      loadWeeklyAssignments();
    }
  }, [token, machineTableName, currentWeek, loadWeeklyAssignments]);

  // localStorage değişikliklerini dinle (dil değişikliği için)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'selectedLanguage' && e.newValue) {
        setCurrentLanguage(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && token && machineTableName) {
      loadMonthlyAssignments();
    }
  }, [token, machineTableName, refreshCount, currentMonth, activeTab, loadMonthlyAssignments]);

  const getWeekDays = () => {
    const monday = getMonday(currentWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Aylık takvim için haftalık çizelge mantığını kullan
  const getMonthlyWeeks = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    
    // İlk Pazartesi'yi bul (haftalık çizelge mantığı)
    const firstMonday = getMonday(firstDay);
    
    const weeks = [];
    for (let weekIndex = 0; weekIndex < 5; weekIndex++) {
      const weekDays = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = new Date(firstMonday);
        day.setDate(firstMonday.getDate() + (weekIndex * 7) + dayIndex);
        
        weekDays.push({
          date: day,
          isCurrentMonth: day.getMonth() === month,
          isToday: day.toDateString() === new Date().toDateString()
        });
      }
      weeks.push(weekDays);
    }
    
    return weeks;
  };

  const getAssignmentsForDate = (date) => {
    // Timezone safe date formatting
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return monthlyAssignments.filter(assignment => assignment.shiftDate === dateStr);
  };

  const calculateDuration = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    return (endMinutes - startMinutes) / 60;
  };

  // Unique shifts helper
  const getUniqueShifts = (dayAssignments) => {
    const shiftsMap = new Map();
    
    dayAssignments.forEach(assignment => {
      const key = `${assignment.templateId}-${assignment.shiftDate}`;
      
      if (!shiftsMap.has(key)) {
        shiftsMap.set(key, {
          templateId: assignment.templateId,
          templateName: assignment.templateName,
          shiftDate: assignment.shiftDate,
          startTime: assignment.startTime,
          endTime: assignment.endTime,
          color: assignment.color,
          employees: [],
          primaryEmployee: '',
          totalEmployees: 0
        });
      }
      
      const shift = shiftsMap.get(key);
      shift.employees.push(assignment);
      shift.totalEmployees++;
      
      if (assignment.isPrimary) {
        shift.primaryEmployee = assignment.employeeName;
      }
    });
    
    shiftsMap.forEach(shift => {
      if (!shift.primaryEmployee && shift.employees.length > 0) {
        shift.primaryEmployee = shift.employees[0].employeeName;
      }
    });
    
    return Array.from(shiftsMap.values());
  };

  // Template operations
  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      const duration = calculateDuration(templateForm.startTime, templateForm.endTime);
      
      if (editingTemplate) {
        await machineApi.put(`/shiftmanagement/templates/${editingTemplate.id}`, {
          ...templateForm,
          durationHours: duration
        });
      } else {
        await machineApi.post('/shiftmanagement/templates', {
          ...templateForm,
          durationHours: duration
        });
      }
      
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: '', startTime: '08:30', endTime: '20:30', color: '#ff0000' });
      loadTemplates();
      
      showSuccess(
        getTranslation('templateSaveSuccess', currentLanguage),
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Template işlemi başarısız:', error);
      showError(
        error.response?.data?.message || getTranslation('templateSaveError', currentLanguage),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      color: template.color
    });
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm(getTranslation('confirmDeleteTemplate', currentLanguage))) return;
    
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      await machineApi.delete(`/shiftmanagement/templates/${templateId}`);
      loadTemplates();
      
      showSuccess(
        getTranslation('templateDeleteSuccess', currentLanguage),
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Template silinemedi:', error);
      showError(
        error.response?.data?.message || getTranslation('templateDeleteError', currentLanguage),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  // Group operations
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      if (editingGroup) {
        await machineApi.put(`/shiftmanagement/groups/${editingGroup.id}`, groupForm);
      } else {
        await machineApi.post('/shiftmanagement/groups', groupForm);
      }
      
      setShowGroupModal(false);
      setEditingGroup(null);
      setGroupForm({ name: '', description: '' });
      loadShiftGroups();
      
      showSuccess(
        editingGroup ? 'Grup güncellendi' : 'Grup oluşturuldu',
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Grup işlemi başarısız:', error);
      showError(
        error.response?.data?.message || (editingGroup ? 'Grup güncellenemedi' : 'Grup oluşturulamadı'),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Bu grubu silmek istediğinize emin misiniz? Bu gruba atanmış çalışanların grup bilgisi silinecektir.')) return;
    
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      await machineApi.delete(`/shiftmanagement/groups/${groupId}`);
      loadShiftGroups();
      loadEmployees(); // Çalışanları da yeniden yükle
      
      showSuccess(
        'Grup silindi',
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Grup silinemedi:', error);
      showError(
        error.response?.data?.message || 'Grup silinemedi',
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  // Employee operations
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      if (editingEmployee) {
        await machineApi.put(`/shiftmanagement/employees/${editingEmployee.id}`, employeeForm);
      } else {
        await machineApi.post('/shiftmanagement/employees', employeeForm);
      }
      
      setShowEmployeeModal(false);
      setEditingEmployee(null);
      setEmployeeForm({ name: '', title: '', shiftGroup: '', active: true });
      loadEmployees();
      
      showSuccess(
        getTranslation('employeeSaveSuccess', currentLanguage),
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Çalışan işlemi başarısız:', error);
      showError(
        error.response?.data?.message || getTranslation('employeeSaveError', currentLanguage),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name,
      title: employee.title || '',
      shiftGroup: employee.shiftGroup || '',
      active: employee.active !== undefined ? employee.active : true
    });
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Bu çalışanı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz. Eğer çalışanın vardiya atamaları varsa önce onları silmeniz gerekir.')) return;
    
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      await machineApi.delete(`/shiftmanagement/employees/${employeeId}`);
      loadEmployees();
      
      showSuccess(
        'Çalışan silindi',
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Çalışan silinemedi:', error);
      showError(
        error.response?.data?.message || 'Çalışan silinemedi',
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  // Drag & Drop operations
  const handleDragStart = (e, type, item) => {
    setDraggedItem({ type, item });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, day, dayIndex) => {
    e.preventDefault();
    
    if (!draggedItem) return;

    if (draggedItem.type === 'template') {
      triggerSingleDayAssignment(draggedItem.item, day, dayIndex);
    }

    setDraggedItem(null);
  };

  // Drag işlemini iptal et (mouse'u geçerli drop zone dışında bırakma)
  const handleDragEnd = (e) => {
    setDraggedItem(null);
  };

  const handleCalendarDrop = async (e, date) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.type !== 'template') return;
    
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

    triggerSingleDayAssignment(draggedItem.item, date, dayOfWeek);
    setDraggedItem(null);
  };

  const handleWeeklyDrop = async (e) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.type !== 'template') return;

    setWeeklyAssignmentTemplate(draggedItem.item);
    setSelectedWeekDays([0, 1, 2, 3, 4]);
    setShowWeeklySelector(true);
    setDraggedItem(null);
  };

  const handleMonthlyWeeklyDrop = async (e, weekDates) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.type !== 'template') return;

    setCurrentWeekDates(weekDates);
    setMonthlyWeeklyTemplate(draggedItem.item);
    setSelectedMonthWeekDays([0, 1, 2, 3, 4]);
    setShowMonthlyWeeklySelector(true);
    setDraggedItem(null);
  };

  const handleEmployeeToggle = (employeeId, employeeName) => {
    setSelectedEmployees(prev => {
      const exists = prev.find(emp => emp.employeeId === employeeId);
      if (exists) {
        return prev.filter(emp => emp.employeeId !== employeeId);
      } else {
        // Çalışanın mevcut pozisyonunu (title) kullan
        const employee = employees.find(emp => emp.id === employeeId);
        const position = employee?.title || 'Çalışan';
        
        return [...prev, {
          employeeId,
          employeeName,
          position: position,
          isPrimary: prev.length === 0
        }];
      }
    });
  };

  // Grup seçildiğinde o gruptaki tüm çalışanları otomatik seç
  const handleGroupSelect = (groupName) => {
    setSelectedGroup(groupName);
    
    if (!groupName) {
      // Grup seçimi temizlendiğinde, sadece o gruba ait olanları kaldır
      setSelectedEmployees(prev => {
        const groupEmployees = employees
          .filter(emp => emp.active && emp.shiftGroup === groupName)
          .map(emp => emp.id);
        return prev.filter(emp => !groupEmployees.includes(emp.employeeId));
      });
      return;
    }

    // Seçilen gruptaki aktif çalışanları bul (shiftGroups tablosundan gelen grup adı ile eşleştir)
    const groupEmployees = employees.filter(
      emp => emp.active && emp.shiftGroup === groupName
    );

    // Mevcut seçimlere ekle (zaten seçili olanları tekrar ekleme)
    setSelectedEmployees(prev => {
      const existingIds = prev.map(emp => emp.employeeId);
      const newEmployees = groupEmployees
        .filter(emp => !existingIds.includes(emp.id))
        .map(emp => ({
          employeeId: emp.id,
          employeeName: emp.name,
          position: emp.title || 'Çalışan',
          isPrimary: prev.length === 0 && groupEmployees.indexOf(emp) === 0
        }));

      // Eğer hiç seçili çalışan yoksa, ilk çalışanı primary yap
      if (prev.length === 0 && newEmployees.length > 0) {
        newEmployees[0].isPrimary = true;
      }

      return [...prev, ...newEmployees];
    });
  };


  const handlePrimaryChange = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.map(emp => ({
        ...emp,
        isPrimary: emp.employeeId === employeeId
      }))
    );
  };

  const handleMultiEmployeeAssignment = async () => {
    if (!machineTableName || !pendingAssignment || selectedEmployees.length === 0) return;

    const hasPrimary = selectedEmployees.some(emp => emp.isPrimary);
    if (!hasPrimary) {
      showWarning(
        getTranslation('selectPrimaryEmployee', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }

    try {
      await machineApi.post('/shiftmanagement/assignments/multi', {
        templateId: pendingAssignment.templateId,
        shiftDate: pendingAssignment.shiftDate,
        dayOfWeek: pendingAssignment.dayOfWeek,
        employees: selectedEmployees.map(emp => ({
          employeeId: emp.employeeId,
          position: emp.position,
          isPrimary: emp.isPrimary
        }))
      });
      
      loadWeeklyAssignments();
      if (activeTab === 'calendar') {
        loadMonthlyAssignments();
      }
      setShowEmployeeSelector(false);
      setPendingAssignment(null);
      setSelectedEmployees([]);
      setSelectedGroup('');
    } catch (error) {
      console.error('Vardiya ataması oluşturulamadı:', error);
      showError(
        getTranslation('assignmentCreateError', currentLanguage) + ': ' + (error.response?.data?.message || error.message),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const handleWeekDayToggle = (dayIndex) => {
    setSelectedWeekDays(prev => {
      if (prev.includes(dayIndex)) {
        return prev.filter(day => day !== dayIndex);
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  };

  const handleWeeklyAssignment = () => {
    if (!machineTableName || !weeklyAssignmentTemplate || selectedWeekDays.length === 0) return;

    const firstDay = selectedWeekDays[0];
    const dayDate = weekDays[firstDay];
    
    // Timezone safe date formatting
    const year = dayDate.getFullYear();
    const month = (dayDate.getMonth() + 1).toString().padStart(2, '0');
    const day = dayDate.getDate().toString().padStart(2, '0');
    const shiftDate = `${year}-${month}-${day}`;
    
    setPendingAssignment({
      templateId: weeklyAssignmentTemplate.id,
      templateName: weeklyAssignmentTemplate.name,
      shiftDate: shiftDate,
      dayOfWeek: firstDay,
      dayName: dayNames[firstDay],
      isWeeklyAssignment: true,
      remainingDays: selectedWeekDays.slice(1)
    });
    
    setShowWeeklySelector(false);
    setShowEmployeeSelector(true);
  };

  const handleWeeklyEmployeeAssignment = async () => {
    if (!machineTableName || !pendingAssignment || selectedEmployees.length === 0) return;

    const hasPrimary = selectedEmployees.some(emp => emp.isPrimary);
    if (!hasPrimary) {
      showWarning(
        getTranslation('selectPrimaryEmployee', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }

    try {
      const allDays = [pendingAssignment.dayOfWeek, ...(pendingAssignment.remainingDays || [])];
      
      for (const dayIndex of allDays) {
        const dayDate = weekDays[dayIndex];
        
        // Timezone safe date formatting
        const year = dayDate.getFullYear();
        const month = (dayDate.getMonth() + 1).toString().padStart(2, '0');
        const day = dayDate.getDate().toString().padStart(2, '0');
        const shiftDate = `${year}-${month}-${day}`;
        
        await machineApi.post('/shiftmanagement/assignments/multi', {
          templateId: pendingAssignment.templateId,
          shiftDate: shiftDate,
          dayOfWeek: dayIndex,
          employees: selectedEmployees.map(emp => ({
            employeeId: emp.employeeId,
            position: emp.position,
            isPrimary: emp.isPrimary
          }))
        });
      }
      
      loadWeeklyAssignments();
      if (activeTab === 'calendar') {
        loadMonthlyAssignments();
      }
      setShowEmployeeSelector(false);
      setPendingAssignment(null);
      setSelectedEmployees([]);
      setSelectedGroup('');
      setWeeklyAssignmentTemplate(null);
      setSelectedWeekDays([]);
      
      showSuccess(
        `${allDays.length} ${getTranslation('assignmentCreated', currentLanguage)}`,
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Haftalık vardiya ataması oluşturulamadı:', error);
      showError(
        getTranslation('assignmentCreateError', currentLanguage) + ': ' + (error.response?.data?.message || error.message),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const handleMonthlyWeekDayToggle = (dayIndex) => {
    setSelectedMonthWeekDays(prev => {
      if (prev.includes(dayIndex)) {
        return prev.filter(day => day !== dayIndex);
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  };

  const handleMonthlyWeeklyAssignment = () => {
    if (!machineTableName || !monthlyWeeklyTemplate || selectedMonthWeekDays.length === 0 || currentWeekDates.length === 0) return;

    const selectedDates = selectedMonthWeekDays.map(dayIndex => currentWeekDates[dayIndex]).filter(date => date);
    
    if (selectedDates.length === 0) return;

    const firstDate = selectedDates[0];
    const jsDay = firstDate.date.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
    
    // Timezone safe date formatting
    const year = firstDate.date.getFullYear();
    const month = (firstDate.date.getMonth() + 1).toString().padStart(2, '0');
    const day = firstDate.date.getDate().toString().padStart(2, '0');
    const shiftDate = `${year}-${month}-${day}`;
    
    setPendingAssignment({
      templateId: monthlyWeeklyTemplate.id,
      templateName: monthlyWeeklyTemplate.name,
      shiftDate: shiftDate,
      dayOfWeek: dayOfWeek,
      dayName: dayNames[dayOfWeek],
      isMonthlyWeeklyAssignment: true,
      remainingDates: selectedDates.slice(1)
    });
    
    setShowMonthlyWeeklySelector(false);
    setShowEmployeeSelector(true);
  };

  const handleMonthlyWeeklyEmployeeAssignment = async () => {
    if (!machineTableName || !pendingAssignment || selectedEmployees.length === 0) return;

    const hasPrimary = selectedEmployees.some(emp => emp.isPrimary);
    if (!hasPrimary) {
      showWarning(
        getTranslation('selectPrimaryEmployee', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }

    try {
      const allDates = [
        { date: new Date(pendingAssignment.shiftDate), dayOfWeek: pendingAssignment.dayOfWeek },
        ...(pendingAssignment.remainingDates || []).map(dateInfo => {
          const jsDay = dateInfo.date.getDay();
          const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
          return {
            date: dateInfo.date,
            dayOfWeek: dayOfWeek
          };
        })
      ];
      
      for (const dateInfo of allDates) {
        // Timezone safe date formatting
        const year = dateInfo.date.getFullYear();
        const month = (dateInfo.date.getMonth() + 1).toString().padStart(2, '0');
        const day = dateInfo.date.getDate().toString().padStart(2, '0');
        const shiftDate = `${year}-${month}-${day}`;
        
        await machineApi.post('/shiftmanagement/assignments/multi', {
          templateId: pendingAssignment.templateId,
          shiftDate: shiftDate,
          dayOfWeek: dateInfo.dayOfWeek,
          employees: selectedEmployees.map(emp => ({
            employeeId: emp.employeeId,
            position: emp.position,
            isPrimary: emp.isPrimary
          }))
        });
      }
      
      loadWeeklyAssignments();
      loadMonthlyAssignments();
      setShowEmployeeSelector(false);
      setPendingAssignment(null);
      setSelectedEmployees([]);
      setSelectedGroup('');
      setMonthlyWeeklyTemplate(null);
      setSelectedMonthWeekDays([]);
      setCurrentWeekDates([]);
      
      showSuccess(
        `${allDates.length} ${getTranslation('assignmentCreated', currentLanguage)}`,
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Aylık haftalık vardiya ataması oluşturulamadı:', error);
      showError(
        getTranslation('assignmentCreateError', currentLanguage) + ': ' + (error.response?.data?.message || error.message),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const openMobileTemplatePicker = (context, payload = null) => {
    setMobileTemplateContext(context);
    setMobileTargetDay(payload);
    setShowMobileTemplatePicker(true);
  };

  const handleMobileTemplateSelect = (template) => {
    if (!template) return;

    if (mobileTemplateContext === 'singleDay' && mobileTargetDay) {
      triggerSingleDayAssignment(template, mobileTargetDay.date, mobileTargetDay.index);
    } else if (mobileTemplateContext === 'weekly') {
      setWeeklyAssignmentTemplate(template);
      setSelectedWeekDays([0, 1, 2, 3, 4]);
      setSelectedEmployees([]);
      setShowEmployeeSelector(false);
      setShowWeeklySelector(true);
    } else if (mobileTemplateContext === 'monthlyWeekly' && mobileTargetDay?.week) {
      setCurrentWeekDates(mobileTargetDay.week);
      setMonthlyWeeklyTemplate(template);

      const currentMonthIndexes = mobileTargetDay.week
        .map((dayInfo, idx) => (dayInfo.isCurrentMonth ? idx : null))
        .filter((idx) => idx !== null);

      setSelectedMonthWeekDays(currentMonthIndexes.length > 0 ? currentMonthIndexes : [0, 1, 2, 3, 4]);
      setSelectedEmployees([]);
      setShowEmployeeSelector(false);
      setShowMonthlyWeeklySelector(true);
    }

    setShowMobileTemplatePicker(false);
    setMobileTemplateContext(null);
    setMobileTargetDay(null);
  };

  const handleShiftClick = (shift) => {
    setSelectedShiftDetail(shift);
    setShowDetailModal(true);
  };

  const deleteShiftAssignments = async (shift) => {
    if (!window.confirm(`${shift.templateName} ${getTranslation('confirmDeleteShift', currentLanguage)}`)) return;
    
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      for (const assignment of shift.employees) {
        await machineApi.delete(`/shiftmanagement/assignments/${assignment.id}`);
      }
      loadWeeklyAssignments();
      if (activeTab === 'calendar') {
        loadMonthlyAssignments();
      }
      
      showSuccess(
        getTranslation('shiftDeleteSuccess', currentLanguage),
        getTranslation('notificationSuccess', currentLanguage)
      );
    } catch (error) {
      console.error('Vardiya atamaları silinemedi:', error);
      showError(
        getTranslation('shiftDeleteError', currentLanguage) + ': ' + (error.response?.data?.message || error.message),
        getTranslation('notificationError', currentLanguage)
      );
    }
  };

  const deleteAssignment = async (assignmentId) => {
    if (!machineTableName) {
      showWarning(
        getTranslation('selectMachineFirst', currentLanguage),
        getTranslation('notificationWarning', currentLanguage)
      );
      return;
    }
    try {
      await machineApi.delete(`/shiftmanagement/assignments/${assignmentId}`);
      loadWeeklyAssignments();
      if (activeTab === 'calendar') {
        loadMonthlyAssignments();
      }
    } catch (error) {
      console.error('Vardiya ataması silinemedi:', error);
    }
  };

  const weekDays = getWeekDays();
  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="px-4 py-6 sm:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{getTranslation('shiftManagementTitle', currentLanguage)}</h1>
          <p className="text-gray-600 dark:text-gray-400">{getTranslation('shiftManagementDescription', currentLanguage)}</p>
        </div>

        {/* Main Content Card */}
        <div className={`rounded-lg shadow-lg p-4 sm:p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto overflow-y-hidden md:overflow-x-visible hide-scrollbar">
            <nav className="-mb-px flex min-w-max md:min-w-0 gap-4 pr-4 hide-scrollbar">
              {[
                { key: 'templates', label: getTranslation('shiftTemplates', currentLanguage), icon: Clock },
                { key: 'employees', label: getTranslation('employees', currentLanguage), icon: Users },
                { key: 'schedule', label: getTranslation('weeklySchedule', currentLanguage), icon: Calendar },
                { key: 'calendar', label: getTranslation('monthlyCalendar', currentLanguage), icon: Calendar }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === key
                      ? 'border-blue-500 text-blue-600'
                      : darkMode
                        ? 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            {/* Gruplar Bölümü */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Vardiya Grupları</h2>
                <button
                  onClick={() => {
                    setEditingGroup(null);
                    setGroupForm({ name: '', description: '' });
                    setShowGroupModal(true);
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus size={16} />
                  Yeni Grup
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {shiftGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-4 rounded-lg border-2 ${
                      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                  >
                    <h3 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{group.description}</p>
                    )}
                    <div className="flex justify-end mt-3 gap-2">
                      <button 
                        onClick={() => {
                          setEditingGroup(group);
                          setGroupForm({
                            name: group.name,
                            description: group.description || ''
                          });
                          setShowGroupModal(true);
                        }}
                        className="text-blue-500 hover:text-blue-700"
                        title="Düzenle"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {shiftGroups.length === 0 && (
                  <div className={`col-span-full text-center py-8 text-gray-500 dark:text-gray-400 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg`}>
                    Henüz grup oluşturulmamış. Yeni grup eklemek için "Yeni Grup" butonuna tıklayın.
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{getTranslation('shiftTemplates', currentLanguage)}</h2>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus size={16} />
                  {getTranslation('newTemplate', currentLanguage)}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'template', template)}
                    onDragEnd={handleDragEnd}
                    className={`p-4 rounded-lg border-2 cursor-move hover:shadow-lg transition-shadow ${
                      darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}
                    style={{ borderLeftColor: template.color, borderLeftWidth: '4px' }}
                  >
                    <h3 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.name}</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>{template.startTime} - {template.endTime}</p>
                      <p>{template.durationHours} {getTranslation('hours', currentLanguage)}</p>
                    </div>
                    <div className="flex justify-end mt-3 gap-2">
                      <button 
                        onClick={() => handleEditTemplate(template)}
                        className="text-blue-500 hover:text-blue-700"
                        title={getTranslation('edit', currentLanguage)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-red-500 hover:text-red-700"
                        title={getTranslation('delete', currentLanguage)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{getTranslation('employees', currentLanguage)}</h2>
              <button
                onClick={() => setShowEmployeeModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus size={16} />
{getTranslation('newEmployee', currentLanguage)}
              </button>
            </div>

            <div className={`rounded-lg overflow-hidden hidden md:block ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <table className="w-full">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getTranslation('name', currentLanguage)}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getTranslation('title', currentLanguage)}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Grup</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getTranslation('status', currentLanguage)}</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{getTranslation('actions', currentLanguage)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className={`px-6 py-4 whitespace-nowrap font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{employee.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {employee.title || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {employee.shiftGroup || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          employee.active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {employee.active ? getTranslation('active', currentLanguage) : getTranslation('passive', currentLanguage)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => handleEditEmployee(employee)}
                          className="text-blue-500 hover:text-blue-700 mr-3"
                          title={getTranslation('edit', currentLanguage)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-500 hover:text-red-700"
                          title={getTranslation('delete', currentLanguage)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`font-semibold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>{employee.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {employee.title || getTranslation('title', currentLanguage)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        employee.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {employee.active ? getTranslation('active', currentLanguage) : getTranslation('passive', currentLanguage)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => handleEditEmployee(employee)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Edit2 size={14} />
                      {getTranslation('edit', currentLanguage)}
                    </button>
                    <button
                      onClick={() => handleDeleteEmployee(employee.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      {getTranslation('delete', currentLanguage)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{getTranslation('weeklySchedule', currentLanguage)}</h2>
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={() => setCurrentWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {getMonday(currentWeek).toLocaleDateString('tr-TR')} - {getWeekDays()[6].toLocaleDateString('tr-TR')}
                </span>
                <button
                  onClick={() => setCurrentWeek(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Templates Sidebar for Drag & Drop */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Vardiya Şablonları</h3>
                {isTouchDevice && (
                  <button
                    onClick={() => openMobileTemplatePicker('weekly')}
                    className="md:hidden w-full sm:w-auto px-4 py-2 rounded-lg border border-blue-400 text-blue-600 dark:text-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  >
                    + {getTranslation('shiftTemplates', currentLanguage)}
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'template', template)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 rounded-lg border-2 cursor-move hover:shadow-lg transition-all ${
                      darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ borderLeftColor: template.color, borderLeftWidth: '4px' }}
                    title="Bu şablonu bir güne sürükleyip bırakın"
                  >
                    <div className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {template.startTime} - {template.endTime}
                    </div>
                  </div>
                ))}
                
                {templates.length === 0 && (
                  <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                    Önce "Vardiya Şablonları" sekmesinden şablon oluşturun
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Bulk Assignment */}
            <div className="mb-4">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
                <h3 className="text-lg font-semibold">Haftalık Toplu Atama</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Vardiya şablonunu buraya sürükleyerek tüm haftaya atama yapabilirsiniz
                </div>
              </div>
              
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => handleWeeklyDrop(e)}
                className={`p-4 border-2 border-dashed rounded-lg transition-all ${
                  draggedItem 
                    ? darkMode 
                      ? 'bg-green-700 border-green-400 hover:border-green-300' 
                      : 'bg-green-50 border-green-400 hover:border-green-500'
                    : darkMode 
                      ? 'bg-gray-800 border-gray-600 hover:border-gray-500' 
                      : 'bg-gray-100 border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="text-lg font-medium mb-2">📅 Haftalık Toplu Atama</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {draggedItem 
                      ? '⬇️ Vardiya şablonunu buraya bırakın ve günleri seçin'
                      : 'Vardiya şablonunu buraya sürükleyin'
                    }
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    Örnek: Gündüz Vardiyası → Pazartesi-Cuma arası
                  </div>
                  {isTouchDevice && (
                    <button
                      onClick={() => openMobileTemplatePicker('weekly')}
                      className="mt-3 px-4 py-2 text-sm rounded-lg border border-blue-400 text-blue-600 dark:text-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    >
                      + {getTranslation('shiftTemplates', currentLanguage)}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex md:grid md:grid-cols-7 gap-2 overflow-x-auto md:overflow-x-visible hide-scrollbar pb-2">
              {weekDays.map((day, index) => (
                <div
                  key={day.toISOString()}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day, index)}
                  className={`min-h-[200px] min-w-[220px] md:min-w-0 flex-shrink-0 md:flex-shrink border-2 border-dashed p-3 rounded-lg transition-all ${
                    draggedItem 
                      ? darkMode 
                        ? 'bg-gray-700 border-blue-400 hover:border-blue-300' 
                        : 'bg-blue-50 border-blue-400 hover:border-blue-500'
                      : darkMode 
                        ? 'bg-gray-800 border-gray-600 hover:border-gray-500' 
                        : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-center mb-3">
                    <div className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{dayNames[index]}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {day.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>

                  {isTouchDevice && (
                    <button
                      onClick={() => openMobileTemplatePicker('singleDay', { date: day, index })}
                      className="md:hidden w-full mb-2 px-3 py-2 text-sm rounded-lg border border-blue-400 text-blue-600 dark:text-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    >
                      + {getTranslation('shiftTemplates', currentLanguage)}
                    </button>
                  )}

                  <div className="space-y-2">
                    {draggedItem && (
                      <div className="text-center text-gray-500 dark:text-gray-400 text-xs mt-4">
                        ⬇️ Vardiya şablonunu buraya bırak
                      </div>
                    )}

                    <div className="space-y-2">
                      {getUniqueShifts(assignments.filter(assignment => assignment.dayOfWeek === index))
                        .map((shift) => (
                          <div
                            key={`${shift.templateId}-${shift.shiftDate}`}
                            className="p-2 rounded text-xs text-white relative group cursor-pointer"
                            style={{ backgroundColor: shift.color }}
                            onClick={() => handleShiftClick(shift)}
                            title="Detayları görmek için tıklayın"
                          >
                            <div className="font-medium">{shift.templateName}</div>
                            <div>{shift.startTime} - {shift.endTime}</div>
                            <div className="truncate">{shift.primaryEmployee}</div>
                            {shift.totalEmployees > 1 && (
                              <div className="text-xs opacity-75">+{shift.totalEmployees - 1} kişi daha</div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteShiftAssignments(shift);
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 rounded-full p-1"
                              title="Tüm vardiya atamalarını sil"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-2">📋 Nasıl Kullanılır:</p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li><strong>Tek gün atama:</strong> Şablonu istediğin güne sürükle → Çalışan seç</li>
                  <li><strong>Haftalık toplu atama:</strong> Şablonu "Haftalık Toplu Atama" kutusuna sürükle → Günleri seç → Çalışan seç</li>
                  <li><strong>Hızlı seçenekler:</strong> Hafta İçi (Pzt-Cum), Hafta Sonu (Cmt-Paz), Tüm Hafta</li>
                  <li><strong>Detay görüntüleme:</strong> Vardiya kartlarına tıklayarak tüm çalışanları gör</li>
                </ol>
                <p className="mt-3 text-xs">💡 <strong>İpucu:</strong> Mevcut vardiyaları silmek için üzerindeki 🗑️ butonuna tıklayın</p>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{getTranslation('monthlyCalendar', currentLanguage)}</h2>
                {monthlyAssignments.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>📊 Toplam {getUniqueShifts(monthlyAssignments).length} vardiya</span>
                    <span>👥 {monthlyAssignments.length} atama</span>
                    <span>🏢 {new Set(monthlyAssignments.map(a => a.employeeId)).size} çalışan</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 md:gap-4">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className={`text-lg font-medium min-w-[200px] text-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Templates for Drag & Drop */}
            <div className="mb-4">
              <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Vardiya Şablonları (Takvime Sürükle)</h4>
              <div className="flex gap-2 flex-wrap">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'template', template)}
                    onDragEnd={handleDragEnd}
                    className={`p-2 rounded-lg border-2 cursor-move hover:shadow-lg transition-all ${
                      darkMode ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ borderLeftColor: template.color, borderLeftWidth: '4px' }}
                    title="Bu şablonu takvime sürükleyip bırakın"
                  >
                    <div className={`font-medium text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{template.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {template.startTime} - {template.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar Header */}
            <div className="hidden md:grid w-full md:grid-cols-[220px_repeat(7,1fr)] md:gap-4 mb-3">
              <div className="px-4 text-sm font-semibold text-gray-500 dark:text-gray-400 text-left">
                {getTranslation('weeklySchedule', currentLanguage)}
              </div>
              {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day) => (
                <div key={day} className="px-4 py-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {day.substring(0, 3)}
                </div>
              ))}
            </div>

            {/* Calendar with Weekly Assignment Zones */}
            <div className="space-y-4 overflow-x-auto md:overflow-x-visible hide-scrollbar pb-2 w-full">
              {getMonthlyWeeks().map((week, weekIndex) => (
                <div key={weekIndex} className="space-y-1 min-w-max md:min-w-0 w-full">
                  {/* Week Row with Assignment Zone and Days */}
                  <div className="flex gap-2 md:grid md:grid-cols-[220px_repeat(7,1fr)] md:gap-4 w-full">
                    {/* Weekly Assignment Zone - Left Side */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleMonthlyWeeklyDrop(e, week)}
                      className={`flex-shrink-0 md:flex-shrink-0 min-w-[220px] md:min-w-0 p-4 border-2 border-dashed rounded-lg transition-all flex flex-col justify-center min-h-[140px] ${
                        draggedItem 
                          ? darkMode 
                            ? 'bg-green-700 border-green-400 hover:border-green-300' 
                            : 'bg-green-50 border-green-400 hover:border-green-500'
                          : darkMode 
                            ? 'bg-gray-800 border-gray-600 hover:border-gray-500' 
                            : 'bg-gray-100 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-xs font-medium mb-1">
                          📅 {weekIndex + 1}. Hafta
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Toplu Atama
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {week[0].date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} - {week[6].date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        {draggedItem && (
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            ⬇️ Bırak
                          </div>
                        )}
                        {isTouchDevice && (
                          <button
                            onClick={() => openMobileTemplatePicker('monthlyWeekly', { week, weekIndex })}
                            className="mt-2 px-3 py-2 text-xs rounded-lg border border-blue-400 text-blue-600 dark:text-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          >
                            + {getTranslation('shiftTemplates', currentLanguage)}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Week Days */}
                    <div className="flex gap-2 md:grid md:grid-cols-7 md:gap-4 flex-1 min-w-max md:min-w-0 w-full md:col-span-7">
                      {week.map((dayInfo, dayIndex) => {
                        const dayAssignments = getAssignmentsForDate(dayInfo.date);
                        const uniqueShifts = getUniqueShifts(dayAssignments);
                        
                        return (
                          <div
                            key={dayIndex}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleCalendarDrop(e, dayInfo.date)}
                            className={`min-h-[120px] min-w-[160px] md:min-w-0 md:w-full p-2 md:p-4 border rounded-lg transition-all ${
                              uniqueShifts.length > 2 ? 'min-h-[160px]' : uniqueShifts.length > 1 ? 'min-h-[140px]' : 'min-h-[120px]'
                            } ${
                              draggedItem 
                                ? dayInfo.isCurrentMonth
                                  ? darkMode 
                                    ? 'bg-gray-700 border-blue-400 hover:border-blue-300' 
                                    : 'bg-blue-50 border-blue-400 hover:border-blue-500'
                                  : 'border-gray-400'
                                : dayInfo.isCurrentMonth
                                  ? darkMode 
                                    ? 'bg-gray-800 border-gray-700' 
                                    : 'bg-white border-gray-200'
                                  : darkMode 
                                    ? 'bg-gray-900 border-gray-800' 
                                    : 'bg-gray-50 border-gray-100'
                            } ${
                              dayInfo.isToday 
                                ? 'ring-2 ring-blue-500' 
                                : ''
                            }`}
                          >
                            <div className={`text-sm font-medium mb-1 ${
                              dayInfo.isCurrentMonth 
                                ? darkMode ? 'text-white' : 'text-gray-900'
                                : 'text-gray-400'
                            } ${
                              dayInfo.isToday ? 'text-blue-600 font-bold' : ''
                            }`}>
                              {dayInfo.date.getDate()}
                            </div>

                            {isTouchDevice && dayInfo.isCurrentMonth && (
                              <button
                                onClick={() => openMobileTemplatePicker('singleDay', { date: dayInfo.date, index: dayIndex })}
                                className="md:hidden w-full mb-2 px-3 py-2 text-xs rounded-lg border border-blue-400 text-blue-600 dark:text-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              >
                                + {getTranslation('shiftTemplates', currentLanguage)}
                              </button>
                            )}

                            <div className="space-y-1">
                              {uniqueShifts.map((shift, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs p-1 rounded text-white truncate cursor-pointer"
                                  style={{ backgroundColor: shift.color }}
                                  onClick={() => handleShiftClick(shift)}
                                  title={`${shift.templateName} - ${shift.primaryEmployee} ${shift.totalEmployees > 1 ? `(+${shift.totalEmployees - 1} kişi)` : ''}`}
                                >
                                  <div className="font-medium truncate">{shift.templateName}</div>
                                  <div className="truncate">{shift.primaryEmployee}</div>
                                  {shift.totalEmployees > 1 && (
                                    <div className="text-xs opacity-75">+{shift.totalEmployees - 1}</div>
                                  )}
                                </div>
                              ))}

                              {draggedItem && dayInfo.isCurrentMonth && (
                                <div className="text-center text-gray-500 dark:text-gray-400 text-xs mt-1">
                                  ⬇️
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-2">📅 Aylık Takvim Kullanımı:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Tek gün atama:</strong> Şablonu istediğin güne sürükle → Çalışan seç</li>
                  <li><strong>Haftalık toplu atama:</strong> Şablonu "X. Hafta Toplu Atama" kutusuna sürükle → Günleri seç → Çalışan seç</li>
                  <li><strong>Detay görüntüleme:</strong> Vardiya kartlarına tıklayarak tüm çalışanları görün</li>
                  <li><strong>Ay navigasyonu:</strong> Sol/sağ okları kullanarak farklı aylara geçin</li>
                </ul>
                <p className="mt-3 text-xs">💡 <strong>İpucu:</strong> Her günde tüm vardiyalar gösterilir, günler otomatik genişler</p>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Template Picker Modal */}
        {showMobileTemplatePicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:hidden">
            <div className={`p-5 rounded-lg w-full max-w-sm mx-4 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
              <h3 className="text-lg font-semibold mb-3">
                {getTranslation('shiftTemplates', currentLanguage)}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {mobileTemplateContext === 'singleDay' && mobileTargetDay?.date
                  ? mobileTargetDay.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', weekday: 'long' })
                  : mobileTemplateContext === 'weekly'
                    ? getTranslation('weeklySchedule', currentLanguage)
                    : mobileTemplateContext === 'monthlyWeekly' && mobileTargetDay?.week
                      ? `📅 ${mobileTargetDay.weekIndex !== undefined ? `${mobileTargetDay.weekIndex + 1}. ` : ''}${getTranslation('week', currentLanguage)} – ${mobileTargetDay.week[0].date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} - ${mobileTargetDay.week[6].date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}`
                      : ''}
              </p>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleMobileTemplateSelect(template)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                  >
                    <span>
                      <span className="block font-medium">{template.name}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {template.startTime} - {template.endTime}
                      </span>
                    </span>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: template.color }}
                    />
                  </button>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {
                    setShowMobileTemplatePicker(false);
                    setMobileTemplateContext(null);
                    setMobileTargetDay(null);
                  }}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                >
                  {getTranslation('cancel', currentLanguage)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {editingTemplate ? getTranslation('edit', currentLanguage) + ' ' + getTranslation('shiftTemplates', currentLanguage) : getTranslation('newTemplate', currentLanguage)}
              </h3>
              
              <form onSubmit={handleTemplateSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Şablon Adı</label>
                    <input
                      type="text"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Başlangıç</label>
                      <input
                        type="time"
                        value={templateForm.startTime}
                        onChange={(e) => setTemplateForm({...templateForm, startTime: e.target.value})}
                        className={`w-full px-3 py-2 border rounded-lg ${
                          darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                        }`}
                        required
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Bitiş</label>
                      <input
                        type="time"
                        value={templateForm.endTime}
                        onChange={(e) => setTemplateForm({...templateForm, endTime: e.target.value})}
                        className={`w-full px-3 py-2 border rounded-lg ${
                          darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                        }`}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Renk</label>
                    <input
                      type="color"
                      value={templateForm.color}
                      onChange={(e) => setTemplateForm({...templateForm, color: e.target.value})}
                      className="w-full h-10 border rounded-lg"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateModal(false);
                      setEditingTemplate(null);
                      setTemplateForm({ name: '', startTime: '08:30', endTime: '20:30', color: '#ff0000' });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Group Modal */}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {editingGroup ? 'Grup Düzenle' : 'Yeni Grup'}
              </h3>
              
              <form onSubmit={handleGroupSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Grup Adı</label>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                      placeholder="K1, K2, K3..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Açıklama (Opsiyonel)</label>
                    <input
                      type="text"
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({...groupForm, description: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                      placeholder="Grup açıklaması..."
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGroupModal(false);
                      setEditingGroup(null);
                      setGroupForm({ name: '', description: '' });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Employee Modal */}
        {showEmployeeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {editingEmployee ? getTranslation('edit', currentLanguage) + ' ' + getTranslation('employees', currentLanguage) : getTranslation('newEmployee', currentLanguage)}
              </h3>
              
              <form onSubmit={handleEmployeeSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Ad Soyad</label>
                    <input
                      type="text"
                      value={employeeForm.name}
                      onChange={(e) => setEmployeeForm({...employeeForm, name: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Ünvan</label>
                    <input
                      type="text"
                      value={employeeForm.title}
                      onChange={(e) => setEmployeeForm({...employeeForm, title: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Vardiya Grubu</label>
                    <select
                      value={employeeForm.shiftGroup || ''}
                      onChange={(e) => setEmployeeForm({...employeeForm, shiftGroup: e.target.value || null})}
                      className={`w-full px-3 py-2 border rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="">Grup Seçiniz...</option>
                      {shiftGroups.map((group) => (
                        <option key={group.id} value={group.name}>{group.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Boş bırakılabilir. Grupları Templates sekmesinden oluşturabilirsiniz.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="employeeActive"
                      checked={employeeForm.active}
                      onChange={(e) => setEmployeeForm({...employeeForm, active: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="employeeActive" className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Aktif
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      (Pasif çalışanlar vardiya atamalarında görünmez)
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmployeeModal(false);
                      setEditingEmployee(null);
                      setEmployeeForm({ name: '', title: '', shiftGroup: '', active: true });
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Multi-Employee Selector Modal */}
        {showEmployeeSelector && pendingAssignment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Vardiyaya Çalışan Atayın</h3>
              
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>{pendingAssignment.templateName}</strong> vardiyası - <strong>{pendingAssignment.dayName}</strong><br/>
                  Birden fazla çalışan seçebilirsiniz. Biri "Ana Kişi" olmalıdır (takvimde görünecek).
                </p>
              </div>

              {/* Grup Seçimi */}
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Grup Seçimi (Opsiyonel)
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedGroup}
                    onChange={(e) => handleGroupSelect(e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-lg ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  >
                    <option value="">Grup Seçiniz...</option>
                    {shiftGroups.map((group) => (
                      <option key={group.id} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                  {selectedGroup && (
                    <button
                      onClick={() => handleGroupSelect('')}
                      className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Bir grup seçtiğinizde, o gruptaki tüm aktif çalışanlar otomatik olarak seçilir. İsterseniz tek tek de seçebilirsiniz.
                </p>
              </div>

              {/* Selected Employees */}
              {selectedEmployees.length > 0 && (
                <div className="mb-4">
                  <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Seçilen Çalışanlar ({selectedEmployees.length})</h4>
                  <div className="space-y-2">
                    {selectedEmployees.map((emp) => (
                      <div key={emp.employeeId} className={`p-2 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>{emp.employeeName}</div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {emp.position}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  id={`primary-${emp.employeeId}`}
                                  name="primary"
                                  checked={emp.isPrimary}
                                  onChange={() => handlePrimaryChange(emp.employeeId)}
                                  className="w-3 h-3"
                                />
                                <label htmlFor={`primary-${emp.employeeId}`} className={`text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                                  Ana Kişi
                                </label>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleEmployeeToggle(emp.employeeId, emp.employeeName)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Employees */}
              <div className="mb-6">
                <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Mevcut Çalışanlar</h4>
                <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {employees.filter(emp => emp.active && !selectedEmployees.find(sel => sel.employeeId === emp.id)).map((employee) => (
                    <button
                      key={employee.id}
                      onClick={() => handleEmployeeToggle(employee.id, employee.name)}
                      className={`text-left p-2 rounded-lg border transition-colors ${
                        darkMode 
                          ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' 
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className={`font-medium text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>{employee.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {employee.title || 'Çalışan'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEmployeeSelector(false);
                    setPendingAssignment(null);
                    setSelectedEmployees([]);
                    setSelectedGroup('');
                  }}
                  className={`px-4 py-2 ${darkMode ? 'text-gray-300 hover:text-gray-100' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  İptal
                </button>
                <button
                  onClick={
                    pendingAssignment?.isWeeklyAssignment 
                      ? handleWeeklyEmployeeAssignment 
                      : pendingAssignment?.isMonthlyWeeklyAssignment
                      ? handleMonthlyWeeklyEmployeeAssignment
                      : handleMultiEmployeeAssignment
                  }
                  disabled={selectedEmployees.length === 0}
                  className={`px-4 py-2 rounded-lg text-white ${
                    selectedEmployees.length > 0
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {pendingAssignment?.isWeeklyAssignment 
                    ? `${[pendingAssignment.dayOfWeek, ...(pendingAssignment.remainingDays || [])].length} Güne Ata (${selectedEmployees.length})`
                    : pendingAssignment?.isMonthlyWeeklyAssignment
                    ? `${[pendingAssignment, ...(pendingAssignment.remainingDates || [])].length} Güne Ata (${selectedEmployees.length})`
                    : `Vardiyaya Ata (${selectedEmployees.length})`
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shift Detail Modal */}
        {showDetailModal && selectedShiftDetail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-lg font-semibold mb-4">Vardiya Detayları</h3>
              
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: selectedShiftDetail.color + '20', borderLeft: `4px solid ${selectedShiftDetail.color}` }}>
                <div className="font-semibold text-lg">{selectedShiftDetail.templateName}</div>
                <div className="text-sm opacity-75">{selectedShiftDetail.startTime} - {selectedShiftDetail.endTime}</div>
                <div className="text-sm opacity-75">{selectedShiftDetail.shiftDate}</div>
              </div>

              <div className="mb-4">
                <h4 className="font-medium mb-2">Atanan Çalışanlar ({selectedShiftDetail.totalEmployees})</h4>
                <div className="space-y-2">
                  {selectedShiftDetail.employees.map((employee, index) => (
                    <div key={employee.id} className={`p-3 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{employee.employeeName}</span>
                            {employee.isPrimary && (
                              <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
                                Ana Kişi
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {employee.position || 'Çalışan'}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            deleteAssignment(employee.id);
                            setShowDetailModal(false);
                          }}
                          className="text-red-500 hover:text-red-700"
                          title="Bu çalışanı vardiyadan çıkar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Kapat
                </button>
                <button
                  onClick={() => {
                    deleteShiftAssignments(selectedShiftDetail);
                    setShowDetailModal(false);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Tüm Vardiyayı Sil
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Day Selector Modal */}
        {showWeeklySelector && weeklyAssignmentTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-lg font-semibold mb-4">Haftalık Vardiya Ataması</h3>
              
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: weeklyAssignmentTemplate.color + '20', borderLeft: `4px solid ${weeklyAssignmentTemplate.color}` }}>
                <div className="font-semibold text-lg">{weeklyAssignmentTemplate.name}</div>
                <div className="text-sm opacity-75">{weeklyAssignmentTemplate.startTime} - {weeklyAssignmentTemplate.endTime}</div>
              </div>

              <div className="mb-6">
                <h4 className="font-medium mb-3">Bu vardiyayı hangi günlere atamak istiyorsunuz?</h4>
                <div className="grid grid-cols-2 gap-2">
                  {dayNames.map((dayName, index) => (
                    <label key={index} className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedWeekDays.includes(index)}
                        onChange={() => handleWeekDayToggle(index)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium">{dayName}</span>
                    </label>
                  ))}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setSelectedWeekDays([0, 1, 2, 3, 4])}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
                  >
                    Hafta İçi (Pzt-Cum)
                  </button>
                  <button
                    onClick={() => setSelectedWeekDays([5, 6])}
                    className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200"
                  >
                    Hafta Sonu (Cmt-Paz)
                  </button>
                  <button
                    onClick={() => setSelectedWeekDays([0, 1, 2, 3, 4, 5, 6])}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full hover:bg-purple-200"
                  >
                    Tüm Hafta
                  </button>
                  <button
                    onClick={() => setSelectedWeekDays([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Temizle
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowWeeklySelector(false);
                    setWeeklyAssignmentTemplate(null);
                    setSelectedWeekDays([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  İptal
                </button>
                <button
                  onClick={handleWeeklyAssignment}
                  disabled={selectedWeekDays.length === 0}
                  className={`px-4 py-2 rounded-lg text-white ${
                    selectedWeekDays.length > 0
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Devam Et ({selectedWeekDays.length} gün)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Weekly Day Selector Modal */}
        {showMonthlyWeeklySelector && monthlyWeeklyTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-full max-w-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-lg font-semibold mb-4">Aylık Haftalık Vardiya Ataması</h3>
              
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: monthlyWeeklyTemplate.color + '20', borderLeft: `4px solid ${monthlyWeeklyTemplate.color}` }}>
                <div className="font-semibold text-lg">{monthlyWeeklyTemplate.name}</div>
                <div className="text-sm opacity-75">{monthlyWeeklyTemplate.startTime} - {monthlyWeeklyTemplate.endTime}</div>
              </div>

              {currentWeekDates.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Seçilen Hafta:</strong> {currentWeekDates[0].date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} - {currentWeekDates[6].date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h4 className="font-medium mb-3">Bu haftanın hangi günlerine atamak istiyorsunuz?</h4>
                <div className="grid grid-cols-2 gap-2">
                  {dayNames.map((dayName, index) => {
                    const dayDate = currentWeekDates[index];
                    const isCurrentMonth = dayDate && dayDate.isCurrentMonth;
                    
                    return (
                      <label 
                        key={index} 
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer ${
                          isCurrentMonth 
                            ? 'hover:bg-gray-50 dark:hover:bg-gray-700' 
                            : 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonthWeekDays.includes(index)}
                          onChange={() => isCurrentMonth && handleMonthlyWeekDayToggle(index)}
                          disabled={!isCurrentMonth}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium">{dayName}</span>
                          {dayDate && (
                            <div className="text-xs text-gray-500">
                              {dayDate.date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                              {!isCurrentMonth && ' (Diğer ay)'}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      const weekdays = [0, 1, 2, 3, 4].filter(day => currentWeekDates[day]?.isCurrentMonth);
                      setSelectedMonthWeekDays(weekdays);
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200"
                  >
                    Hafta İçi
                  </button>
                  <button
                    onClick={() => {
                      const weekends = [5, 6].filter(day => currentWeekDates[day]?.isCurrentMonth);
                      setSelectedMonthWeekDays(weekends);
                    }}
                    className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200"
                  >
                    Hafta Sonu
                  </button>
                  <button
                    onClick={() => {
                      const allDays = [0, 1, 2, 3, 4, 5, 6].filter(day => currentWeekDates[day]?.isCurrentMonth);
                      setSelectedMonthWeekDays(allDays);
                    }}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full hover:bg-purple-200"
                  >
                    Tüm Hafta
                  </button>
                  <button
                    onClick={() => setSelectedMonthWeekDays([])}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    Temizle
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowMonthlyWeeklySelector(false);
                    setMonthlyWeeklyTemplate(null);
                    setSelectedMonthWeekDays([]);
                    setCurrentWeekDates([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  İptal
                </button>
                <button
                  onClick={handleMonthlyWeeklyAssignment}
                  disabled={selectedMonthWeekDays.length === 0}
                  className={`px-4 py-2 rounded-lg text-white ${
                    selectedMonthWeekDays.length > 0
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Devam Et ({selectedMonthWeekDays.length} gün)
                </button>
              </div>
            </div>
          </div>
        )}
        </div> {/* Main Content Card */}
      </div>
    </div>
  );
};

export default ShiftManagement;