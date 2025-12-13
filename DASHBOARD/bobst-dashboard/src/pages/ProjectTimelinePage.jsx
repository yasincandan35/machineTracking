import React, { useState } from 'react';
import { 
  MessageSquare, Mail, Moon, Palette, Gauge, Droplet, Layout, 
  User, Database, Server, GitBranch, Wrench, Check, Calendar,
  Settings, Zap, Lock, ChevronRight, X, Eye, Monitor,
  BarChart3, Sparkles, FileText, Globe, PauseCircle, Bell, Package, AlertTriangle
} from 'lucide-react';

const ProjectTimelinePage = ({ currentLanguage = 'tr' }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDark, setIsDark] = useState(false);

  // Dark mode kontrolü
  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const timelineData = [
    {
      id: 60,
      title: 'Dashboard - Grafik Kartları Kaldırıldı & Duruş Sebebi Gösterimi Eklendi',
      date: '13 Aralık 2025',
      icon: PauseCircle,
      color: 'red',
      details: '🔄 Dashboard Temizleme: Kullanılmayan grafik kartları tamamen kaldırıldı. GraphCard, SpeedGraph, DieSpeedGraph, EthylConsumptionGraph component dosyaları silindi. cardMappings.jsx\'den grafik kartı importları, cardDimensions tanımları ve createGraphCardMap fonksiyonu kaldırıldı. Dashboard.jsx\'den grafik kartı importları, chartData useMemo ve grafik kartı render bölümü temizlendi. CardSettingsModal.jsx\'den grafik kartı seçenekleri ve ilgili UI bölümü kaldırıldı. useDashboardData.js\'den speedGraphData ve ethylGraphData state\'leri kaldırıldı. ColorContext ve SettingsPage\'den graphCard renk ayarları kaldırıldı. 📊 Last Stop Kartı İyileştirmesi: StopDurationInfoCard\'a duruş sebebi gösterimi eklendi. useDashboardData hook\'unda duruş olduğunda /api/plcdata/current-stoppage-reason endpoint\'i çağrılarak duruş sebebi bilgisi çekiliyor. Duruş sebebi varsa kart üzerinde gösteriliyor, yoksa "Henüz duruş sebebi girilmedi" mesajı gösteriliyor (Türkçe/İngilizce/Almanca/Fransızca/İtalyanca/Rusça çeviri desteği). MachineScreen\'den girilen duruş sebepleri dashboard\'da anlık olarak görüntüleniyor.',
      tags: ['Frontend', 'Dashboard', 'Cleanup', 'Info Card', 'React', 'i18n']
    },
    {
      id: 59,
      title: 'Periyodik Özet Sistemi - Günlük/Haftalık/Aylık/Çeyreklik/Yıllık Raporlama',
      date: '9-13 Aralık 2025',
      icon: Calendar,
      color: 'purple',
      details: '📊 Periyodik özet ve raporlama sistemi eklendi. Özellikler: 1) PeriodicSnapshots Tablosu - Günlük, haftalık, aylık, çeyreklik ve yıllık snapshot\'lar için veritabanı tablosu, her makine için ayrı snapshot kayıtları, full_live_data kolonu ile tüm API verilerinin JSON formatında saklanması. 2) PeriodicSnapshotService - Background service ile otomatik snapshot alma (00:00:00\'da), tüm snapshot tiplerinin paralel çalışması, canlı verilerin API\'den çekilip kaydedilmesi. 3) ReportsController - GetPeriodicSummary endpoint\'i ile periyodik özet hesaplama, snapshot ve JobEndReports verilerinin birleştirilmesi, canlı verilerin entegrasyonu. 4) Frontend Components - PeriodicSummaryCard ile günlük/haftalık/aylık/çeyreklik/yıllık özet kartları, PeriodicSummariesPage ile alt-sekme görünümü, usePeriodicSummary hook ile canlı veri güncellemesi (1 saniye). 5) OEE Hesaplama - Her iş için ayrı OEE hesaplanıp ortalaması alınıyor, Availability/Performance/Quality metrikleri, periyod bazlı doğru hesaplama. 🔧 Özellikler: Toplam iş sayısı, üretim, duruş, enerji, fire (adet ve %), OEE metrikleri gösterimi. 🛡️ Güvenlik: TRY_CAST ile güvenli veri dönüşümleri, yeni iş başladığında otomatik tespit, backend restart\'ta veri kaybı olmaması (tüm veriler veritabanında).',
      tags: ['Backend', 'Frontend', 'Database', 'Reports', 'Real-time', 'C#', 'React', 'SQL']
    },
    {
      id: 58,
      title: 'Paylaşımlı Duruş Özelliği - Operatör Geri Bildirimi ile Geliştirme',
      date: '11 Aralık 2025',
      icon: PauseCircle,
      color: 'blue',
      details: '🔄 Paylaşımlı Duruş Sistemi: Operatör Murat Coşkan\'ın geri bildirimi ile geliştirildi. Tek bir fiziksel duruşta birden fazla sebep kaydedilebiliyor. Özellikler: 1) Backend - DataProcessor.cs\'de SplitActiveStoppageAsync metodu eklendi, mevcut duruşu bölerek yeni segment başlatıyor, minimum süre kontrolü (30 saniye), "Tanımsız" fallback mekanizması. 2) API - PLCDataController\'da /split-stoppage endpoint\'i, UTC zaman yönetimi, kategori/sebep override desteği. 3) Frontend - MachineScreen\'de "Paylaşımlı Duruş" butonu, aktif duruş sebebi gösterimi, başarılı kayıt sonrası UI reset, bilgilendirme modalı (soru işareti butonu ile). 4) UX İyileştirmeleri - Duruş sebebi modalı sadece duruyor state\'ine geçince açılıyor, makine çalışırken "Duruş Sebebi" ve "İş Sonu" butonları deaktif görünüyor, arıza bildirimi butonu bottomBar içinde minimal tasarım, Framer Motion ile smooth animasyonlar (0.4s). 5) Responsive - 1024x768 ekran çözünürlüğü için layout optimizasyonları, StoppageInfoCard sol panele taşındı, gereksiz re-render\'lar önlendi (React.memo + JSON.stringify karşılaştırma).',
      tags: ['Frontend', 'Backend', 'Feature', 'UX', 'React', 'C#', 'API', 'Feedback']
    },
    {
      id: 57,
      title: 'Machine Screen - Arıza Bildirimi Modal Düzeltmesi',
      date: '09 Aralık 2025',
      icon: AlertTriangle,
      color: 'orange',
      details: '🔧 Bug Fix: Machine Screen\'de "running" durumunda arıza bildirimi butonuna basıldığında modal açılmıyordu. Modal sadece "stopped" state\'inde render ediliyordu. Running state\'inin return bloğuna da MaintenanceRequestModal eklendi, artık her iki durumda da (running/stopped) arıza bildirimi modalı düzgün çalışıyor. Buton onClick handler\'ı zaten doğruydu, sadece modal render edilmiyordu.',
      tags: ['Frontend', 'Bug Fix', 'Machine Screen', 'Modal', 'React']
    },
    {
      id: 56,
      title: 'Machine Screen - WebGL Fluid Background Kaldırıldı & Duyuru Barı İyileştirmeleri',
      date: '09 Aralık 2025',
      icon: Zap,
      color: 'yellow',
      details: '⚡ Performance: WebGL Fluid Background component\'i kaldırıldı, GPU kullanımı önemli ölçüde azaldı. Running ve stopped state\'lerinden FluidBackground import ve render çağrıları kaldırıldı. 🎨 UX: Duyuru barı daha belirgin hale getirildi - arka plan rengi #dc2626 (daha koyu kırmızı), font-weight 900 (çok kalın), font-size 1.1rem, z-index 200, box-shadow eklendi. !important flag\'leri ile stil önceliği sağlandı, artık arka plandaki elementlerden etkilenmiyor.',
      tags: ['Frontend', 'Performance', 'UX', 'Machine Screen', 'CSS', 'React']
    },
    {
      id: 55,
      title: 'Makina Duyuru - Makine Seçimi Zorunlu Uyarısı & API Entegrasyonu',
      date: '09 Aralık 2025',
      icon: Database,
      color: 'blue',
      details: '🔒 Validation: Database Admin sayfasında "Makina Duyuru" sekmesine makine seçimi zorunlu uyarısı eklendi. Makine seçilmediğinde sarı uyarı kutusu gösteriliyor: "Lütfen önce bir makine seçiniz". Duyuru ekleme, listeleme ve silme butonları makine seçilmediğinde disabled durumda. 🔌 API: Tüm duyuru API çağrılarına machine query parametresi eklendi (machineApi.get/post/delete). Machine Screen\'de duyuru çekme işlemi machine parametresi ile otomatik çalışıyor. Backend\'de MachineDatabaseService ile makine bazlı veritabanı bağlantısı kullanılıyor.',
      tags: ['Frontend', 'Backend', 'Validation', 'API', 'Database Admin', 'React', 'C#']
    },
    {
      id: 54,
      title: 'Makine Bazlı Duyuru Sistemi & Kayan Bar',
      date: '09 Aralık 2025',
      icon: Bell,
      color: 'red',
      details: '🆕 Makine duyuruları artık her makinenin kendi veritabanında tutuluyor. MachineAnnouncementsController, MachineDatabaseService ile makine parametresi üzerinden çalışıyor; CRUD ve aktif listeleme makineye özel. 📢 Machine Screen: Topbar altına kırmızı kayan duyuru barı eklendi; duyurular machine API\'den 60 sn\'de bir çekiliyor. 🌐 Admin: Database sekmesine "Makina Duyuru" tabı eklendi, makine seçimi zorunlu; duyuru ekle/sil/listede machine paramı kullanılıyor.',
      tags: ['Frontend', 'Backend', 'Announcements', 'Machine-Specific', 'C#', 'React']
    },
    {
      id: 58,
      title: 'Arıza Bildirim Sistemi - Machine Screen & Bakım Personeli Bildirimleri',
      date: '06 Aralık 2025',
      icon: AlertTriangle,
      color: 'orange',
      details: '🔧 Machine Screen\'e arıza bildirimi sistemi eklendi. Kullanıcılar machine screen\'den "Arıza Bildirimi" butonu ile arıza açabiliyor. MaintenanceRequestModal component\'i ile arıza tipi seçimi ve açıklama girişi yapılabiliyor. 📨 Bildirim Sistemi: Yeni arıza bildirimi oluşturulduğunda bakım personeline (engineer rolü) otomatik bildirim gönderiliyor. PushNotificationService ile Firebase Cloud Messaging (FCM) üzerinden push notification gönderiliyor. EmailService ile email bildirimi gönderiliyor (makine adı, arıza tipi, açıklama bilgileri ile). MaintenanceNotificationRecipients tablosundan aktif bildirim alıcıları bulunuyor, kategori bazlı (maintenance/production/quality) bildirim yönetimi yapılabiliyor. 🔔 Bildirim İçeriği: Makine adı, arıza tipi, açıklama, bildirim linki (maintenance sayfasına yönlendirme) içeriyor.',
      tags: ['Frontend', 'Backend', 'Machine Screen', 'Notifications', 'FCM', 'Email', 'Maintenance', 'C#', 'React']
    },
    {
      id: 53,
      title: 'PLC İş Verisi Düzeltmeleri & Job Order Retry Service',
      date: '05 Aralık 2025',
      icon: Settings,
      color: 'red',
      details: '⚠️ PLC resetlenmek zorunda kalınmış, iş verileri bozulmuştur. Bu sorunlar için kapsamlı düzeltmeler yapıldı. 🔧 Job Order Retry Service: targetProductionQ değeri 0 ise aktif iş emri verilerini PLC\'ye otomatik olarak yeniden gönderen background service eklendi. Her 10 saniyede bir kontrol yapıyor, targetProductionQ 0\'dan farklı olana kadar devam ediyor. Veritabanından aktif iş emri verilerini çekiyor (JobCycleRecords tablosu), böylece elektrik kesintilerinde bile veriler korunuyor. 📊 Ondalık Ayırıcı Düzeltmesi: ParseFloatValue ve ParseIntValue metodları geliştirildi. Virgül ondalık ayırıcı olarak doğru şekilde işleniyor (660,291 = 660.291). JsonElement desteği eklendi, boşluklar temizleniyor, binlik ayırıcılar doğru şekilde handle ediliyor. 🔄 SqlProxy.cs: WriteJobDataAsync ve QueryJobDataAsync metodlarında tüm sayısal değerler (kalan_miktar, set_sayisi, silindir_cevresi, hedef_hiz) için robust parsing uygulandı. Hem nokta hem virgül formatları destekleniyor.',
      tags: ['Backend', 'PLC', 'Bug Fix', 'Background Service', 'Data Parsing', 'C#']
    },
    {
      id: 52,
      title: 'Robot Palletizing Info Card - Animasyonlu Robot & İstatistikler',
      date: '28 Kasım 2025',
      icon: Package,
      color: 'orange',
      details: 'Robot Palletizing kartına animasyonlu robot ve detaylı istatistikler eklendi. 🤖 Robot Animasyonu: 3 eksenli animasyonlu robot (omuz, dirsek, gripper), CSS keyframe animasyonları ile gerçekçi hareket, turuncu renk teması. 📊 İstatistikler: Qualified Bundle (yeşil), Defective Bundle (kırmızı), Good Pallets (mavi), Defective Pallets (turuncu). Her istatistik için ikon ve renk kodlu gösterim. 🌍 Çok Dilli Destek: Türkçe/İngilizce tam çeviri desteği, dinamik dil değişimi. 🎨 Tasarım: useCardStyle hook ile tutarlı kart tasarımı, responsive layout, dark mode uyumlu.',
      tags: ['Frontend', 'Dashboard', 'Animation', 'Info Card', 'React', 'i18n']
    },
    {
      id: 51,
      title: 'Maintenance Notification Recipients - Bildirim Alıcı Yönetimi',
      date: '28 Kasım 2025',
      icon: Mail,
      color: 'blue',
      details: 'Bakım bildirim alıcıları yönetim sistemi eklendi. 👥 Özellikler: 1) MaintenanceNotificationRecipients Tablosu - Kullanıcı bazlı bildirim alıcı kayıtları, NotificationCategory desteği (maintenance/production/quality), IsActive durumu. 2) API Endpoint\'leri - GET/POST/DELETE /api/maintenance/notification-recipients, kullanıcı ekleme/çıkarma, kategori bazlı filtreleme. 3) Admin Yönetimi - Admin panelinden bildirim alıcıları ekleme/çıkarma, kullanıcı listesi ve durum yönetimi. 4) Otomatik Bildirimler - Yeni arıza bildirimlerinde sadece kayıtlı alıcılara push notification gönderimi. 💾 Veritabanı: Foreign key ile Users tablosuna bağlı, unique index (UserId + NotificationCategory), otomatik index optimizasyonu.',
      tags: ['Backend', 'Database', 'API', 'Notifications', 'Admin', 'C#']
    },
    {
      id: 50,
      title: 'Device Token Yönetimi - Cihaz Token Kayıt Sistemi',
      date: '28 Kasım 2025',
      icon: Settings,
      color: 'green',
      details: 'Cihaz token yönetim sistemi tamamlandı. 📱 DeviceTokens Tablosu: UserId, Token (FCM token), Platform (ios/android/web), DeviceName, AppVersion, CreatedAt, LastUsedAt, IsActive alanları. 🔧 PushNotificationService: RegisterDeviceTokenAsync - Token kaydetme/güncelleme, aynı token kontrolü, eski token\'ları pasif yapma. Token Hash: CHECKSUM ile token hash hesaplama, unique index (UserId + TokenHash) ile performans optimizasyonu. 🔄 Otomatik Güncelleme: Aynı token tekrar kaydedilirse LastUsedAt güncelleniyor, eski token\'lar otomatik pasif yapılıyor. 💾 Veritabanı: Foreign key ile Users tablosuna bağlı, cascade delete, index optimizasyonu (UserId, IsActive, Platform).',
      tags: ['Backend', 'Database', 'Push Notifications', 'FCM', 'C#', 'SQL']
    },
    {
      id: 49,
      title: 'Web Push Notification Sistemi - Firebase Cloud Messaging',
      date: '27 Kasım 2025',
      icon: Bell,
      color: 'purple',
      details: 'Web push notification sistemi Firebase Cloud Messaging ile entegre edildi. 🔔 Frontend: PushNotificationContext - FCM token yönetimi, bildirim izni yönetimi, service worker entegrasyonu. Firebase Config - Environment variables ile güvenli yapılandırma, VAPID key desteği. Service Worker - firebase-messaging-sw.js ile background bildirim desteği, foreground/background mesaj yönetimi. 🔧 Backend: PushNotificationService - FCM ile push notification gönderimi, Firebase Admin SDK entegrasyonu, bildirim payload yönetimi. Otomatik Bildirimler - Yeni arıza bildirimlerinde push notification, bakım hatırlatmalarında otomatik bildirim (30/15/3 gün kala). 📱 Platform Desteği: Web (Chrome/Firefox/Edge), mobil tarayıcı desteği, PWA uyumluluğu. 🌐 Çoklu Cihaz: Kullanıcı başına birden fazla cihaz token\'ı, platform bazlı bildirim gönderimi.',
      tags: ['Frontend', 'Backend', 'Firebase', 'Push Notifications', 'FCM', 'Service Worker', 'React', 'C#']
    },
    {
      id: 48,
      title: 'Job Cycle Tracking Sistemi - İş Döngüsü Takibi',
      date: '24 Kasım 2025',
      icon: Settings,
      color: 'indigo',
      details: 'Job Cycle takip sistemi SqlProxy.cs\'ye eklendi. 🔄 Özellikler: 1) CreateJobCycleRecordAsync - Yeni iş döngüsü kaydı oluşturma, status=\'active\', initial_snapshot ile PLC verisi kaydı. 2) GetActiveJobCycleRecordAsync - Aktif iş döngüsünü sorgulama, cycle_start_time/end_time, job_info JSON\'ı. 3) UpdateActiveJobCycleWithOrderAsync - Aktif döngüyü sipariş bilgileriyle güncelleme, sipariş numarası ve job_info JSON güncellemesi. 4) JobCycleRecords Tablosu - status (active/completed), cycle_start_time, cycle_end_time, initial_snapshot, final_snapshot alanları. 5) WriteJobDataAsync Entegrasyonu - İş başlangıcında otomatik cycle kaydı, sipariş bilgileriyle güncelleme, snapshot koruma. 💾 Veritabanı: EnsureJobCycleRecordsTableAsync ile otomatik tablo oluşturma, IDENTITY kolon desteği, JSON snapshot alanları.',
      tags: ['Backend', 'Database', 'Job Tracking', 'PLC', 'C#']
    },
    {
      id: 47,
      title: 'Hedef Hız Otomatik Hesaplama & PLC Entegrasyonu',
      date: '23 Kasım 2025',
      icon: Gauge,
      color: 'orange',
      details: 'Hedef hız hesaplama sistemi geliştirildi ve PLC\'ye otomatik yazma eklendi. 🎯 Hesaplama Mantığı: 1) INLINE Tipi - hizmkn = Round(((hiz * 0.8) * 370) / 1000) formülü. 2) SHEET Tipi - hizmkn = Round(((hiz * 0.9) * 370) / 1000) formülü. 3) Diğer Tipler - hizmkn = Round(((hiz * 0.85) * 370) / 1000) varsayılan formül. 4) QueryJobDataAsync - Sipariş sorgulamasında otomatik hedef hız hesaplama, uretim_tipi bazlı formül seçimi. 🔧 PLC Yazma: WriteDINTAsync ile register 8-9\'a hedef hız yazma, kalan miktar (register 0-1), set sayısı (register 4-5), silindir çevresi (register 12-13) birlikte yazılıyor. 💾 Cache: lastJobData içinde hedef_hiz saklanıyor, iş sonu raporlarında kullanılıyor.',
      tags: ['Backend', 'PLC', 'Automation', 'Calculation', 'C#']
    },
    {
      id: 46,
      title: 'Enerji Tüketimi Takibi & Hesaplama Sistemi',
      date: '22 Kasım 2025',
      icon: Zap,
      color: 'yellow',
      details: 'Enerji tüketimi takip ve hesaplama sistemi tamamlandı. ⚡ Başlangıç Enerji: 1) totalEnergyKwhStart - İş başında PLC\'den okunan enerji değeri, totalEnergyKwh/TotalEnergy/TotalEnergyKwh key\'lerini deneme. 2) WriteJobDataAsync - Request\'ten veya PLC\'den enerji başlangıç değeri alma, lastJobData cache\'ine kaydetme. 3) JobCycleRecords - initial_snapshot içinde enerji değeri saklanıyor. 🔋 Bitiş Enerji: 1) totalEnergyKwhEnd - İş sonunda PLC\'den okunan enerji, final_snapshot\'tan okuma desteği. 2) EndJobAsync - Aktif cycle\'dan veya currentData\'dan enerji bitiş değeri alma. 3) Enerji Tüketimi - energyConsumptionKwh = totalEnergyKwhEnd - totalEnergyKwhStart, negatif değer kontrolü. 📊 JobEndReports: energy_consumption_kwh kolonu eklendi, EnsureJobEndReportsTableAsync ile otomatik tablo/migration, iş sonu raporlarında enerji tüketimi gösteriliyor.',
      tags: ['Backend', 'Energy', 'Database', 'Calculation', 'PLC', 'C#']
    },
    {
      id: 45,
      title: 'Silindir Çevresi Otomatik Çözümleme',
      date: '21 Kasım 2025',
      icon: Settings,
      color: 'teal',
      details: 'Silindir çevresi değerini otomatik olarak çözümleme sistemi eklendi. 🔄 COALESCE Mantığı: silindir_cevresi kolonundan başlayarak, boşsa silindir_cevre1-12 alanlarından ilk dolu değeri alma. 📋 QueryJobDataAsync & QuerySqlServer: Her iki fonksiyonda da COALESCE ile 13 farklı kolonu kontrol etme. 🇹🇷 Türkçe Format Desteği: Virgüllü değerleri parse etme (527,45 → 527.45), noktalı format desteği. 🔧 PLC Yazma: Silindir çevresini REAL tipinde PLC\'ye yazma (register 12-13), float parse işlemi, Türkçe kültür desteği. 💾 Veritabanı: EGEM_GRAVUR_SIPARIS_IZLEME tablosundan silindir_cevresi çekme, job_info JSON\'ında saklama.',
      tags: ['Backend', 'Database', 'Data Processing', 'PLC', 'C#']
    },
    {
      id: 44,
      title: 'JobEndReports Tablosu & İş Sonu Rapor Sistemi',
      date: '19 Kasım 2025',
      icon: FileText,
      color: 'green',
      details: 'İş sonu raporları için kapsamlı tablo ve rapor sistemi oluşturuldu. 📊 Tablo Yapısı: 1) JobEndReports Tablosu - 20+ kolon (sipariş bilgileri, üretim metrikleri, tüketim verileri, enerji tüketimi). 2) EnsureJobEndReportsTableAsync - Otomatik tablo oluşturma, IDENTITY kolon desteği, migration script\'leri. 3) Kolonlar - siparis_no, toplam_miktar, kalan_miktar, hedef_hiz, ethyl_alcohol_consumption, energy_consumption_kwh, job_start_time, job_end_time. 🔄 EndJobAsync: İş sonunda otomatik rapor oluşturma, reportData dictionary hazırlama, SaveJobEndReportAsync ile kaydetme. 📈 Rapor Verileri: OEE metrikleri, duruş süreleri, fire oranları, tüketim verileri, enerji tüketimi, tamamlanma yüzdesi. 💾 Migration: Eski tablodan yeni tabloya veri taşıma, energy_consumption_kwh kolonu ekleme, veri kaybı olmadan migration.',
      tags: ['Backend', 'Database', 'Reports', 'Migration', 'C#']
    },
    {
      id: 43,
      title: 'Sıcaklık & Nem Takip Sistemi - Tam Entegrasyon',
      date: '25 Kasım 2025',
      icon: Gauge,
      color: 'cyan',
      details: '🌡️ Kapsamlı Sıcaklık/Nem Sistemi: Dashboard\'a tam entegre edildi. 📊 Özellikler: 1) TemperatureHumidityPage - Dashboard\'da yeni sekme olarak eklendi, 3 modül (Dashboard/Analysis/Settings), çok dilli destek. 2) Canlı Veri Kartları - DeviceCard komponenti ile gerçek zamanlı sıcaklık/nem gösterimi, 1 saniye polling, 30 saniye timeout kontrolü. 3) Analiz Modülü - Tarih aralığı seçimi, birleşik grafikler (CombinedChart), geçmiş veri tablosu (HistoricalDataTable), Excel export. 4) Renk Özelleştirme - Düşük/normal/yüksek limitler ve renkler ayarlanabilir. 5) Backend API - SensorsController ile dinamik makine tablosu desteği, period/changes/speed-periods endpoint\'leri. 🌐 Veritabanı: SensorDB ile entegrasyon, dinamik makine bazlı tablo sorguları, SensorLog model ile Entity Framework Core.',
      tags: ['Frontend', 'Backend', 'IoT', 'Real-time', 'Analytics', 'React', 'C#']
    },
    {
      id: 42,
      title: 'SensorsController - Dinamik Sensör Veri API\'si',
      date: '20 Kasım 2025',
      icon: Database,
      color: 'blue',
      details: 'SensorsController ile kapsamlı sensör veri yönetimi eklendi. 🔧 Endpoint\'ler: 1) GET /api/sensors/last - Son kayıt (machineSpeed, dieSpeed, etilAsetat, etilAlkol), dinamik makine tablosu desteği. 2) GET /api/sensors/period - Zaman aralığına göre veri (1h-1y aralıklar, 1-60 saniye resolution), ROW_NUMBER ile overflow önleme, DATEDIFF overflow düzeltmesi. 3) GET /api/sensors/changes - Sadece değişen değerleri döndürür (LAG window function), sensorType parametresi (speed/die/ethylAcetate/ethylAlcohol). 4) GET /api/sensors/speed-periods - Sabit periyotları döndürür (hız değişimlerini dönemlere böler). 💾 Dinamik Tablo Yönetimi: MachineLists tablosundan makine bilgisi alınıyor, dinamik database name ve table name çözümleme, harf duyarsız tablo kontrolleri, makine bazlı connection string yönetimi.',
      tags: ['Backend', 'API', 'Database', 'Dynamic', 'C#', 'SQL']
    },
    {
      id: 41,
      title: 'Sıcaklık & Nem Dashboard Kartları',
      date: '15 Kasım 2025',
      icon: Gauge,
      color: 'rose',
      details: 'Ana dashboard\'a sıcaklık ve nem bilgi kartları eklendi. 🌡️ SicaklikInfoCard: Termometre ikonu (kırmızı), sıcaklık değeri (°C), çok dilli destek. 💧 NemInfoCard: Su damlası ikonu (mavi), nem yüzdesi (%), çok dilli destek. Kartlar ana dashboard\'da görüntülenebilir, card settings modal\'dan seçilebilir, real-time veri güncellemesi destekleniyor. Responsive tasarım ve dark mode uyumlu.',
      tags: ['Frontend', 'Dashboard', 'Info Card', 'IoT', 'React']
    },
    {
      id: 40,
      title: 'SensorDbContext & SensorLog Model Entegrasyonu',
      date: '10 Kasım 2025',
      icon: Database,
      color: 'indigo',
      details: 'Sensor veritabanı için Entity Framework Core entegrasyonu tamamlandı. 📊 SensorDbContext: SensorDB veritabanına bağlanıyor, SensorLog entity set\'i tanımlandı, MachineLists ile entegrasyon. 📝 SensorLog Model: Sicaklik (double), Nem (double), KayitZamani (DateTime) alanları. 🔧 MachineDatabaseService: Dinamik makine bazlı SensorDbContext oluşturma, makine ismine göre connection string çözümleme. 💡 Gelecek Hazırlığı: PLC Configuration tabloları ile uyumlu yapı, API endpoint\'leri için hazır altyapı.',
      tags: ['Backend', 'Database', 'Entity Framework', 'C#', 'Model']
    },
    {
      id: 39,
      title: 'TemperatureHumiditySystem - Tam Modüler Yapı',
      date: '5 Kasım 2025',
      icon: Settings,
      color: 'purple',
      details: 'Sıcaklık/Nem sistemi için tam modüler React komponenti oluşturuldu. 🏗️ Yapı: 1) TemperatureHumiditySystem - Ana container, tab navigasyonu (Dashboard/Analysis/Settings), tema desteği (dark/light). 2) Dashboard Modülü - DeviceCard\'lar ile canlı veri gösterimi, 1 saniye polling interval, otomatik veri yenileme, timeout kontrolü (30 saniye). 3) Analysis Modülü - Tarih aralığı seçimi (DatePicker), birleşik grafikler (sıcaklık+nem), geçmiş veri tablosu, Excel export (XLSX), renk özelleştirme. 4) Settings Modülü - Cihaz yönetimi (CRUD), renk limitleri ayarlama, localStorage persistence. 🌐 API Entegrasyonu: axios ile backend API çağrıları, config.js ile API base URL yönetimi, hata yönetimi ve loading states.',
      tags: ['Frontend', 'React', 'Modular', 'API', 'IoT']
    },
    {
      id: 38,
      title: 'Arduino AHT10 Sensör Entegrasyonu',
      date: '2 Kasım 2025',
      icon: Zap,
      color: 'yellow',
      details: 'Arduino Mega 2560 + AHT10 sıcaklık/nem sensörü + W5100 Ethernet modülü ile fiziksel sensör entegrasyonu tamamlandı. 🔌 Donanım: Arduino Mega 2560, AHT10 dijital sıcaklık/nem sensörü, W5100 Ethernet Shield. 📡 Veri İletişimi: HTTP POST ile JSON veri gönderimi, 1 saniye interval ile otomatik ölçüm, IP adresi konfigürasyonu (192.168.1.100). 🔧 Backend Entegrasyonu: POST /api/arduino/data endpoint\'i ile veri kabulü, veritabanına otomatik kayıt, cihaz IP adresi bazlı tanımlama. 📦 Proje Yapısı: tempHumTest/ klasörü altında organize edildi, Backend (C# API), Frontend (React), Arduino kodları ayrı klasörlerde, detaylı README.md dokümantasyonu.',
      tags: ['Hardware', 'Arduino', 'IoT', 'Sensor', 'Backend', 'API']
    },
    {
      id: 37,
      title: 'Sıcaklık/Nem Backend API - C# Web API',
      date: '1 Kasım 2025',
      icon: Server,
      color: 'green',
      details: 'Sıcaklık/Nem verilerini yönetmek için C# ASP.NET Core Web API oluşturuldu. 🔧 Özellikler: 1) Cihaz Yönetimi - GET/POST /api/devices endpoint\'leri, cihaz CRUD işlemleri, IP adresi ve konum bilgisi. 2) Veri Kaydetme - POST /api/arduino/data ile Arduino\'dan veri alımı, JSON deserialization, veritabanına kayıt. 3) Veri Sorgulama - GET /api/sensordata/latest (son veriler), GET /api/sensordata/period (tarih aralığı), Entity Framework Core ile SQL sorguları. 4) Veritabanı - TemperatureHumidityDB, SensorLogs tablosu, otomatik migration desteği. ⚙️ Konfigürasyon: appsettings.json ile connection string, Port 5001, CORS yapılandırması, Swagger/OpenAPI desteği.',
      tags: ['Backend', 'C#', 'ASP.NET Core', 'API', 'Entity Framework', 'Database']
    },
    {
      id: 36,
      title: 'Stop Duration Info Card - Toplam Duruş Gösterimi',
      date: '31 Ekim 2025',
      icon: PauseCircle,
      color: 'red',
      details: 'Stop Duration Info Card\'a toplam duruş süresi gösterimi eklendi. Kart artık hem son duruş süresini hem de toplam duruş süresini gösteriyor. totalValue prop\'u eklendi ve kartın alt kısmında "Toplam Duruş: X saat Y dk Z sn" formatında gösteriliyor. FormatDuration fonksiyonu saat/dakika/saniye formatında çalışıyor. useDashboardData hook\'unda totalStoppageDurationSec hesaplaması eklendi. Çok dilli destek: totalStoppage çevirisi eklendi (Türkçe/İngilizce/Almanca/Fransızca/İtalyanca/Rusça).',
      tags: ['Frontend', 'Dashboard', 'Info Card', 'Translation', 'React']
    },
    {
      id: 35,
      title: 'Duruş Kayıt Sistemi - Foreign Key Hatası Düzeltmesi',
      date: '31 Ekim 2025',
      icon: Database,
      color: 'orange',
      details: 'Duruş kayıt sisteminde foreign key constraint hatası düzeltildi. DataProcessor.cs\'de HandleStoppageTracking metoduna validasyon eklendi: Eğer categoryId veya reasonId 0 ise (sebep seçilmemişse), otomatik olarak "Tanımsız" kategori (id: 16) ve sebep (id: 35) olarak kaydediliyor. Bu sayede FK__stoppage___categ__3C69FB99 hatası önleniyor. Console log\'larında uyarı mesajı gösteriliyor: "⚠️ Sebep seçilmemiş, \'Tanımsız\' olarak kaydediliyor". Kayıt sonrası currentCategoryId ve currentReasonId sıfırlanıyor.',
      tags: ['Backend', 'Database', 'Bug Fix', 'Validation', 'C#']
    },
    {
      id: 34,
      title: 'MachineScreen - Tanımsız Kategori/Sebep Filtreleme',
      date: '31 Ekim 2025',
      icon: Settings,
      color: 'gray',
      details: 'MachineScreen\'deki StopReasonCategories komponentinde "Tanımsız" kategori ve sebepler kullanıcı arayüzünden gizlendi. Kategori listesinde categoryCode veya displayName "Tanımsız" olan kategoriler gösterilmiyor. Sebep listesinde id=35 veya reasonName="Tanımsız" olan sebepler filtreleniyor. Bu sayede operatörler sadece gerçek duruş sebeplerini görebiliyor ve seçebiliyor. Fallback mekanizması korundu: API\'den veri gelmezse varsayılan kategoriler gösteriliyor.',
      tags: ['Frontend', 'MachineScreen', 'UI/UX', 'Filtering', 'React']
    },
    {
      id: 33,
      title: 'DatabaseAdmin - Rol Bazlı Yapı & Duruş Sebepleri Yönetimi',
      date: '31 Ekim 2025',
      icon: Settings,
      color: 'indigo',
      details: 'DatabaseAdmin sayfasına rol bazlı tab sistemi eklendi. Admin rolü: Makine Yönetimi + Duruş Sebepleri sekmeleri görüyor. Engineer rolü: Sadece Duruş Sebepleri sekmesi görüyor (varsayılan olarak açılıyor). Duruş Sebepleri Yönetimi: Kategori ekleme/düzenleme/silme, Sebep ekleme/düzenleme/silme. Dinamik makina IP\'sine göre API çağrıları yapılıyor (createMachineApi). Kategori özellikleri: categoryCode, displayName, icon, color, backgroundColor. Sebep özellikleri: reasonName, categoryId, sortOrder. Tüm CRUD işlemleri dinamik makina API\'si üzerinden çalışıyor.',
      tags: ['Frontend', 'Admin Panel', 'Role-Based', 'API', 'CRUD', 'React']
    },
    {
      id: 32,
      title: 'Kapsamlı Enerji Tüketim Kartı - Tasarım & Çok Dilli Destek',
      date: '27 Ekim 2025',
      icon: Zap,
      color: 'green',
      details: '🎨 Kapsamlı Enerji Kartı Geliştirme: Excel tablosundaki verilerle yeni enerji tüketim kartı oluşturuldu. 📊 Tasarım İyileştirmeleri: 1) 2x2 → 1x3 boyut değişikliği (daha uzun kart), 2) Duruş kartındaki profesyonel pasta grafik tasarımı uygulandı, 3) Büyük pasta grafik (160px) ile daha belirgin görünüm, 4) 3 ana gösterge: Elektrik (kW) | Maliyet (TL/saat) | Paket Başına Maliyet (TL/adet). 🔧 Fonksiyonellik: İnteraktif pasta grafik (hover + tooltip), 6 kategori gösterimi (Makine-L3, Doğalgaz, Chiller, Klima, Kompresor, Diğer), gerçekçi değerler (0.15 TL/adet paket maliyeti). 🌍 Çok Dilli Destek: Türkçe/İngilizce tam çeviri desteği, dinamik dil değişimi, tüm metinler ve birimler çevrildi. 🚀 Gelecek Hazırlığı: Sensör entegrasyonu için hazır yapı, dinamik veri akışına uygun format.',
      tags: ['Frontend', 'Energy', 'Charts', 'i18n', 'Design', 'React', 'SVG']
    },
    {
      id: 31,
      title: 'Analiz Sayfası - Live Stream Modu & 31 Metrik Desteği',
      date: '21 Ekim 2025',
      icon: BarChart3,
      color: 'red',
      details: '🔴 Live Stream Modu (Binance Tarzı): İki ayrı sekme sistemi eklendi - 1) 💾 Veritabanı (Geçmiş): SQL\'den çekilen historik veriler, 15m-24h aralık seçimi, periyodik refresh. 2) 🔴 Live Stream: Her 1 saniyede /api/data\'dan canlı veri akışı, son 500 nokta tutulur, Brush otomatik sağa kayar. useRef ile closure problemi çözüldü, dependency array optimize edildi. ⚙️ Auto-Scale Sistem: İlk metrik = Master (manuel aralık kontrol), diğer metrikler = dinamik min/max hesaplama (%10 padding), slider\'lar auto-scale metrikler için disabled. 📊 31 Metrik: Hız & Üretim (5), Tüketim (3), OEE & Kalite (4), Fire (3), Duruşlar (5), İş Durumu (2), Enerji (9 - L1/L2/L3 voltaj/akım). Tüm metrikler hem veritabanı hem live stream modlarında destekleniyor.',
      tags: ['Frontend', 'Real-time', 'Live Stream', 'Auto-Scale', 'React', 'Charts', 'Recharts']
    },
    {
      id: 30,
      title: 'Enerji Analizörü Performans Optimizasyonu & UI İyileştirmeleri',
      date: '21 Ekim 2025',
      icon: Zap,
      color: 'yellow',
      details: 'EMD4 enerji analizörü okuma performansı ve kararlılığı optimize edildi. Backend (EnergyAnalyzerReader.cs): 1) Register okuma stratejisi optimize edildi (Her 500ms: activePower | Her 1.5s: L1/L2/L3 voltaj+akım | Her 3s: enerji). 2) Timeout yönetimi iyileştirildi (1000ms timeout, timeout durumunda bağlantı korunuyor). 3) Invalid ByteCount hatası için buffer temizleme eklendi. 4) Retry mekanizması kaldırıldı (gereksiz yük). 5) Tüm debug logları kaldırıldı, sadece kritik olaylar (bağlantı kopma/kurulma) loglanıyor. 6) avgVoltage, totalCurrent, frequency parametreleri kaldırıldı (%70 daha az ETOR yükü). Frontend: EnergyConsumptionInfoCard layout iyileştirmesi (çizgi tam ortada, sağ üst özet bilgiler kaldırıldı). Dark Mode: DatabaseAdmin sayfası tamamen dark mode uyumlu hale getirildi (gray-800/900 kartlar, gray-700 input\'lar, border/shadow iyileştirmeleri).',
      tags: ['Backend', 'Performance', 'Optimization', 'Frontend', 'Dark Mode', 'C#']
    },
    {
      id: 29,
      title: 'Enerji Analizörü Entegrasyonu - EMD4 Modbus TCP',
      date: '20 Ekim 2025',
      icon: Zap,
      color: 'yellow',
      details: 'EMD4 enerji analizörü (ETOR RS485-Ethernet gateway üzerinden) Modbus TCP ile entegre edildi. Backend: SimpleEnergyReader.cs ile 200ms polling, tek tek register okuma, retry mekanizması, TCP bağlantısı akıllı yönetimi (sadece kritik hatalarda reconnect). Validasyon: 50-500V, 0.01-200A, NaN/Infinity filtreleme. Dashboard: EnergyConsumptionInfoCard (1x2 kart) - animasyonlu sarı şimşek ikonu, 3 faz bilgisi (L1-kırmızı, L2-sarı, L3-mavi), aktif güç (kW), toplam enerji (kWh), frekans, ortalama voltaj/akım. Responsive mobil tasarım. API endpoint: /api/data üzerinden gerçek zamanlı veri akışı.',
      tags: ['Backend', 'Frontend', 'Modbus', 'Energy', 'Real-time', 'C#', 'React']
    },
    {
      id: 28,
      title: 'Analiz Sayfası - Yüksek Frekanslı Veri Grafikler',
      date: '17 Ekim 2025',
      icon: BarChart3,
      color: 'purple',
      details: 'Tamamen yeni Analiz sayfası oluşturuldu. Özellikler: 1) Canlı Mod (▶️) & Yenile (🔄) butonları ile kontrol. 2) Zaman aralıkları: 15dk, 30dk, 1h, 2h, 4h, 6h, 12h, 24h. 3) Veri çözünürlüğü: 1-60 saniye arası seçilebilir (performans limitleri: ≤1h sınırsız, >1h için max 1500 nokta). 4) Metrik seçimi: Makine Hızı, Kalıp Hızı, Etil Asetat, Etil Alkol (renk, line tipi, stroke style özelleştirme). 5) Visual Min/Max ayarı: Farklı ölçeklerdeki metrikleri aynı grafikte karşılaştırma (0-100% normalize). 6) Y-ekseni: Gerçek değerler renkli gösterim (110mpm, 1500L). 7) Backend: ROW_NUMBER ile DATEDIFF overflow düzeltmesi (1-59sn: ROW_NUMBER, ≥60sn: MINUTE gruplama, resolution=1: TOP 5000). 8) Brush zoom/pan timeline (anasayfa grafikleri ile aynı). 9) Performans: Sayfa pasif olunca otomatik veri çekimi durdurma.',
      tags: ['Frontend', 'Backend', 'Analytics', 'High-Frequency', 'Performance', 'Recharts', 'SQL']
    },
    {
      id: 27,
      title: 'Job Passport DR Blade Açıları - Otomatik Hesaplama',
      date: '17 Ekim 2025',
      icon: Settings,
      color: 'orange',
      details: 'İş pasaportunda silindir çevresi değerine göre otomatik DR Blade açıları hesaplama sistemi eklendi. Lemanic 1 makinası için F, V, H değerleri tablosu oluşturuldu. Silindir çevresi null/0 ise silindir_cevre1-12 alanlarından ilk dolu değer alınıyor. Düşük değere yuvarlama mantığı (527.45 → 520). Türkçe format desteği (virgül → nokta çevirimi). Her ünite kartının V ve H kutularına otomatik değer yazılıyor. Backend\'de debug logları ve frontend\'de console logları eklendi.',
      tags: ['Backend', 'Frontend', 'Job Passport', 'DR Blade', 'Automation']
    },
    {
      id: 24,
      title: 'Machine Overview Card - TV Screen Redesign & Advanced Themes',
      date: '15 Ekim 2025',
      icon: Monitor,
      color: 'cyan',
      details: 'Main Dashboard için tamamen yeniden tasarlandı: 14 veri noktası (OEE, Hedef Hız, Baskı Hızı, Üretim Durumu-Adet/Metre/Palet, Kalan Süre-Gün:Saat:Dakika). Progress bar\'larda dinamik % gösterimi (%20\'den küçükse sağda, büyükse bar içinde). Makina silüeti arka planda. Header rengi yeşil/kırmızı (çalışıyor/durmuş). Responsive font scaling (clamp + em units) ile browser yüksekliğine otomatik sığma. Sipariş/Üretilen/Kalan kolonları arası dikey çizgilerle ayrılmış.',
      tags: ['Frontend', 'Dashboard', 'UI/UX', 'Responsive']
    },
    {
      id: 25,
      title: 'Cam & Sıvı Temaları - Advanced Glass Effects',
      date: '15 Ekim 2025',
      icon: Sparkles,
      color: 'purple',
      details: '🔮 Cam Teması: Gökyüzü gradient arkaplanı, vitray renkli section\'lar (OEE-yeşil, Baskı Hızı-mor, Üretim-mavi, Kalan Süre-pembe), parlayan kenar efekti (8s interval), backdrop blur, cam üzerine işlenmiş yazı efekti. 🌊 Sıvı Teması: WebGL Fluid Simulation arkaplanı (iframe), çok transparent kartlar (%3-5 opacity), koyu transparent sidebar/header, Space tuşu ile manuel splat, otomatik splat (2s interval). High quality ayarlar (SIM_RESOLUTION: 256, BLOOM: 8 iterations). Tüm selector\'lar (machine/language/theme) koyu transparent.',
      tags: ['Frontend', 'UI/UX', 'WebGL', 'Themes', 'Animation']
    },
    {
      id: 26,
      title: 'Çok Dilli Destek - Machine Overview Card',
      date: '15 Ekim 2025',
      icon: Globe,
      color: 'green',
      details: 'MachineOverviewCard\'daki tüm yazılar çeviri sistemine bağlandı: Baskı Hızı, Üretim Durumu, Adet/Metre/Palet, Sipariş/Üretilen/Kalan, Tahmini Kalan Süre, Gün:Saat:Dakika, m/dk birim. Türkçe ve İngilizce çeviriler eklendi. Dil değiştiğinde tüm kart içeriği otomatik çevriliyor.',
      tags: ['Frontend', 'i18n', 'Translation']
    },
    {
      id: 23,
      title: 'Job Passport Varnish Vizkozite Düzeltmesi',
      date: '13 Ekim 2025',
      icon: FileText,
      color: 'rose',
      details: 'Varnish (vernik) üniteleri için vizkozite değeri "-----" yerine varsayılan olarak "25 sn / 20 C" gösterilmeye başlandı. Ok tuşları ile saniye ve derece değerleri artık düzgün çalışıyor (mavi oklar: saniye ±0.5, kırmızı oklar: derece ±1). JobPassportViewer ve adjustments.js dosyalarındaki varsayılan değerler güncellendi. Gereksiz console.log\'lar temizlenerek performans iyileştirildi.',
      tags: ['Frontend', 'Job Passport', 'Bug Fix', 'Performance']
    },
    {
      id: 1,
      title: '@Mention & Email Bildirimleri',
      date: '12 Ekim 2025',
      icon: MessageSquare,
      color: 'blue',
      details: 'Geri bildirim sisteminde kullanıcıları @mention ile etiketleme özelliği eklendi. Etiketlenen kullanıcılara ve yorum yapılan feedback sahiplerine otomatik email bildirimleri gönderiliyor. SMTP üzerinden Gmail entegrasyonu yapıldı.',
      tags: ['Frontend', 'Backend', 'Email']
    },
    {
      id: 2,
      title: 'Dark Mode & Liquid Glass Tema Geliştirmeleri',
      date: '12 Ekim 2025',
      icon: Moon,
      color: 'purple',
      details: 'Dark mode geçişleri optimize edildi. Liquid Glass tema varyantları eklendi ve tema tercihleri veritabanına kaydediliyor. Sayfa yenilendiğinde veya farklı tarayıcıdan girildiğinde tema korunuyor. Job Passport sayfasına dark mode desteği eklendi.',
      tags: ['Frontend', 'UI/UX', 'Database']
    },
    {
      id: 3,
      title: 'Combined Speed Card',
      date: '12 Ekim 2025',
      icon: Gauge,
      color: 'orange',
      details: 'Die Speed ve Machine Speed değerlerini tek bir kartta gösteren yeni bir kart tasarlandı. Sol tarafta die animasyonu (mavi), sağ tarafta hız göstergesi animasyonu (turuncu) eklendi. Değerler tam sayı olarak gösteriliyor.',
      tags: ['Frontend', 'Dashboard', 'Animation']
    },
    {
      id: 4,
      title: 'Ethyl Consumption Card Redesign',
      date: '12 Ekim 2025',
      icon: Droplet,
      color: 'cyan',
      details: 'Etil Alkol ve Etil Asetat kartı yeniden tasarlandı. Değerler ortada yan yana gösteriliyor, sol tarafta mavi akan damla animasyonu, sağ tarafta mor akan damla animasyonu eklendi. Float değerler (ondalıklı) gösteriliyor.',
      tags: ['Frontend', 'Dashboard', 'Animation']
    },
    {
      id: 5,
      title: 'Drag & Drop Dashboard System',
      date: '12 Ekim 2025',
      icon: Layout,
      color: 'green',
      details: 'Dashboard kartlarına sürükle-bırak özelliği eklendi. Tüm kartlar artık sürüklenebilir (Job, OEE, Production Summary dahil). Kart pozisyonları veritabanına kaydediliyor ve sayfa yenilendiğinde korunuyor. Smooth animasyonlar ve akıllı yerleştirme algoritması eklendi.',
      tags: ['Frontend', 'Dashboard', 'UX']
    },
    {
      id: 6,
      title: 'Profile Page',
      date: '12 Ekim 2025',
      icon: User,
      color: 'indigo',
      details: 'Kullanıcı profil sayfası oluşturuldu. Kullanıcı bilgileri (username, email, role, theme) ve oturum bilgileri (createdAt, lastLogin, lastSeen, isActive, isOnline) gösteriliyor. Gelecekte dashboard istatistikleri eklenecek.',
      tags: ['Frontend', 'UI', 'User Management']
    },
    {
      id: 7,
      title: 'Database Restructuring',
      date: '12 Ekim 2025',
      icon: Database,
      color: 'red',
      details: 'UserPreferences ve Users tabloları yeniden yapılandırıldı. LanguageSelection, LastSelectedMachineId ve ColorSettings kullanıcı bazlı olduğu için Users tablosuna taşındı. SQL migration scriptleri hazırlandı.',
      tags: ['Backend', 'Database', 'Migration']
    },
    {
      id: 8,
      title: 'DashboardBackend Oluşturuldu',
      date: '12 Ekim 2025',
      icon: Server,
      color: 'yellow',
      details: 'Yeni bir C# ASP.NET Core backend oluşturuldu (192.168.1.44:5199). Users, UserPreferences, MachineLists, Feedbacks, Comments, FeedbackReactions tablolarını yönetiyor. JWT authentication, CORS ve Swagger yapılandırıldı.',
      tags: ['Backend', 'API', 'C#']
    },
    {
      id: 9,
      title: 'Multi-Backend Architecture',
      date: '12 Ekim 2025',
      icon: GitBranch,
      color: 'pink',
      details: '3 farklı API entegrasyonu: DashboardBackend (user/auth/preferences), BobstDashboardAPI (reports/shifts/stoppage - dinamik IP), PLC Data Collector (live sensor data - dinamik IP). Tek JWT token ile tüm backend\'lere erişim sağlandı.',
      tags: ['Backend', 'Architecture', 'API']
    },
    {
      id: 10,
      title: 'Dynamic Machine Selection',
      date: '12 Ekim 2025',
      icon: Settings,
      color: 'teal',
      details: 'Makina listesi DashboardBackend\'den dinamik olarak çekiliyor. Seçilen makinanın IP adresi kullanılarak ilgili makina backend\'ine (BobstDashboardAPI) ve PLC Data Collector\'a bağlanılıyor. "Main Dashboard" seçeneği eklendi.',
      tags: ['Frontend', 'Backend', 'Dynamic']
    },
    {
      id: 11,
      title: 'JWT Synchronization',
      date: '12 Ekim 2025',
      icon: Lock,
      color: 'gray',
      details: 'DashboardBackend ve BobstDashboardAPI\'daki JWT Key, Issuer ve Audience değerleri senkronize edildi. Tek token ile her iki backend\'e de erişim sağlanıyor. Token\'lar 8 saat geçerli.',
      tags: ['Backend', 'Security', 'Authentication']
    },
    {
      id: 12,
      title: 'Feedback System Migration',
      date: '12 Ekim 2025',
      icon: MessageSquare,
      color: 'blue',
      details: 'Feedback, Comments ve FeedbackReactions tabloları Dashboard veritabanına taşındı. DashboardBackend\'de yeni controller\'lar oluşturuldu. Frontend\'de endpoint\'ler güncellendi. Circular reference sorunları çözüldü.',
      tags: ['Backend', 'Database', 'Migration']
    },
    {
      id: 13,
      title: 'ShiftManagement API Fixes',
      date: '12 Ekim 2025',
      icon: Calendar,
      color: 'violet',
      details: 'ShiftManagement sayfasındaki tüm API çağrıları dinamik makina API\'sine (machineApi) dönüştürüldü. Seçilen makinanın IP adresine göre vardiya yönetimi verileri çekiliyor.',
      tags: ['Frontend', 'Backend', 'API']
    },
    {
      id: 14,
      title: 'Loading States & Optimizations',
      date: '12 Ekim 2025',
      icon: Zap,
      color: 'amber',
      details: 'Dashboard sayfasında loading state eklendi. Sayfa yenilendiğinde veya yeni giriş yapıldığında önce seçilen kartlar render ediliyor (tüm kartlar gösterilip sonra filtreleme yapılmıyor). Debouncing ile layout kaydetme optimize edildi.',
      tags: ['Frontend', 'Performance', 'UX']
    },
    {
      id: 15,
      title: 'Code Quality & Documentation',
      date: '12 Ekim 2025',
      icon: Check,
      color: 'emerald',
      details: 'Tüm değişiklikler için detaylı README dosyaları oluşturuldu. Migration scriptleri hazırlandı. Console log\'lar eklenerek debugging kolaylaştırıldı. Kod düzenlemeleri ve refactoring yapıldı.',
      tags: ['Documentation', 'Quality', 'Best Practices']
    },
    {
      id: 16,
      title: 'Card Settings Modal & Visibility Control',
      date: '12 Ekim 2025',
      icon: Eye,
      color: 'blue',
      details: 'Kullanıcılar dashboard\'da hangi kartların görüneceğini seçebiliyor. Job kartı da artık seçilebilir/gizlenebilir. Kart tercihleri makina bazlı kaydediliyor. Modal açıldığında mevcut seçili kartlar doğru şekilde gösteriliyor. Boş kart seçimi uyarı veriyor.',
      tags: ['Frontend', 'Dashboard', 'UX']
    },
    {
      id: 17,
      title: 'Main Dashboard - Machine Overview Cards',
      date: '12 Ekim 2025',
      icon: Monitor,
      color: 'cyan',
      details: 'Main Dashboard seçildiğinde tüm makinaların özet bilgilerini gösteren özel kartlar render ediliyor. Her kart: hız (progress bar), kalıp hızı (progress bar), OEE (circular progress - renk kodlu), üretim (counter animation), fire (uyarı animasyonu) gösteriyor. 2 saniyede bir otomatik güncelleme. 3 sütunlu responsive grid layout.',
      tags: ['Frontend', 'Dashboard', 'Real-time', 'Animation']
    },
    {
      id: 18,
      title: 'Machine Overview Card - Premium Animations',
      date: '12 Ekim 2025',
      icon: Sparkles,
      color: 'purple',
      details: 'Main Dashboard için görsel olarak zengin makine kartları tasarlandı. Gradient arka planlar, pulse animasyonları, hover efektleri, progress bar\'lar (500ms smooth transition), circular OEE göstergesi (dinamik renk: yeşil/turuncu/kırmızı), animate-ping canlı nokta. Fire %5 üzerindeyse pulse animasyonu. Header\'da yeşil/gri gradient (çalışıyor/durmuş).',
      tags: ['Frontend', 'UI/UX', 'Animation', 'Premium']
    },
    {
      id: 19,
      title: 'StoppageChart & OEE Dimensions Fix',
      date: '12 Ekim 2025',
      icon: BarChart3,
      color: 'red',
      details: 'StoppageChart boyutu 2x3 (2 kolon x 3 satır) olarak ayarlandı. OEE Gauge 1x3 olarak güncellendi. Layout yüklendiğinde cardDimensions\'dan doğru boyutlar otomatik olarak uygulanıyor. processLayout fonksiyonu eklenerek eski boyutlar override ediliyor.',
      tags: ['Frontend', 'Dashboard', 'Layout']
    },
    {
      id: 20,
      title: 'Auto-resize Textarea & MentionInput Improvements',
      date: '12 Ekim 2025',
      icon: MessageSquare,
      color: 'indigo',
      details: 'Feedback yorumlarındaki textarea otomatik olarak büyüyor (min: 2 satır, max: 200px). @mention dropdown imlecin hemen altından çıkıyor (satır yüksekliği hesaplaması ile). MentionInput komponenti API endpoint\'leri güncellendi.',
      tags: ['Frontend', 'UX', 'Feedback']
    },
    {
      id: 21,
      title: 'Admin Panel & Database Admin Enhancements',
      date: '12 Ekim 2025',
      icon: Settings,
      color: 'yellow',
      details: 'Admin Panel tüm kullanıcı yönetim özelliklerini kullanıyor (DashboardBackend endpoint\'leri). Database Admin\'e IP Address alanı eklendi. Makina ekleme formunda IP adresi giriliyor ve kaydediliyor. Duruş sebepleri yönetimi dinamik makina API\'si ile çalışıyor.',
      tags: ['Frontend', 'Backend', 'Admin']
    },
    {
      id: 22,
      title: 'Identity Column Fixes & Database Integrity',
      date: '12 Ekim 2025',
      icon: Database,
      color: 'emerald',
      details: 'Feedbacks, Comments, FeedbackReactions tablolarındaki Id sütunları IDENTITY olarak ayarlandı. SSMS GUI ile veri kaybı olmadan yapılandırma yapıldı. "Cannot insert NULL into Id" hataları çözüldü. Circular reference sorunları DTO projeksiyonu ile çözüldü.',
      tags: ['Database', 'Backend', 'Bug Fix']
    }
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-500 dark:bg-blue-600',
      light: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-700'
    },
    purple: {
      bg: 'bg-purple-500 dark:bg-purple-600',
      light: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-300 dark:border-purple-700'
    },
    orange: {
      bg: 'bg-orange-500 dark:bg-orange-600',
      light: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-300 dark:border-orange-700'
    },
    cyan: {
      bg: 'bg-cyan-500 dark:bg-cyan-600',
      light: 'bg-cyan-100 dark:bg-cyan-900/30',
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-300 dark:border-cyan-700'
    },
    green: {
      bg: 'bg-green-500 dark:bg-green-600',
      light: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-300 dark:border-green-700'
    },
    indigo: {
      bg: 'bg-indigo-500 dark:bg-indigo-600',
      light: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-300 dark:border-indigo-700'
    },
    red: {
      bg: 'bg-red-500 dark:bg-red-600',
      light: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-300 dark:border-red-700'
    },
    yellow: {
      bg: 'bg-yellow-500 dark:bg-yellow-600',
      light: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-300 dark:border-yellow-700'
    },
    pink: {
      bg: 'bg-pink-500 dark:bg-pink-600',
      light: 'bg-pink-100 dark:bg-pink-900/30',
      text: 'text-pink-700 dark:text-pink-300',
      border: 'border-pink-300 dark:border-pink-700'
    },
    teal: {
      bg: 'bg-teal-500 dark:bg-teal-600',
      light: 'bg-teal-100 dark:bg-teal-900/30',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-300 dark:border-teal-700'
    },
    gray: {
      bg: 'bg-gray-500 dark:bg-gray-600',
      light: 'bg-gray-100 dark:bg-gray-900/30',
      text: 'text-gray-700 dark:text-gray-300',
      border: 'border-gray-300 dark:border-gray-700'
    },
    violet: {
      bg: 'bg-violet-500 dark:bg-violet-600',
      light: 'bg-violet-100 dark:bg-violet-900/30',
      text: 'text-violet-700 dark:text-violet-300',
      border: 'border-violet-300 dark:border-violet-700'
    },
    amber: {
      bg: 'bg-amber-500 dark:bg-amber-600',
      light: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-300 dark:border-amber-700'
    },
    emerald: {
      bg: 'bg-emerald-500 dark:bg-emerald-600',
      light: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-300 dark:border-emerald-700'
    },
    rose: {
      bg: 'bg-rose-500 dark:bg-rose-600',
      light: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-300 dark:border-rose-700'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          📊 Proje Geliştirme Timeline
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          EGEM Makine Takip Sistemi - Son Güncellemeler
        </p>
        <div className="flex items-center gap-4 mt-4">
          <span className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold">
            📦 {timelineData.length} Özellik
          </span>
          <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">
            ✅ 100% Tamamlandı
          </span>
          <span className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-semibold">
            🚀 Son Güncelleme: 13 Aralık 2025
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-7xl mx-auto relative">
        {/* Vertical Line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 dark:from-blue-600 dark:via-purple-600 dark:to-pink-600"></div>

        {/* Timeline Items */}
        <div className="space-y-6">
          {timelineData.map((item, index) => {
            const Icon = item.icon;
            const colors = colorClasses[item.color];
            
            return (
              <div
                key={item.id}
                className="relative pl-20 pr-4 group"
              >
                {/* Icon Circle */}
                <div className={`absolute left-3 w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Content Card */}
                <div
                  onClick={() => setSelectedItem(item)}
                  className={`cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border-l-4 ${colors.border} transform hover:-translate-y-1`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {item.title}
                        </h3>
                        <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {item.date}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${colors.light} ${colors.text}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Panel - Sliding from Right */}
      {selectedItem && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => setSelectedItem(null)}
          ></div>

          {/* Detail Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
            <div className="p-8">
              {/* Close Button */}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Icon */}
              <div className={`w-16 h-16 rounded-2xl ${colorClasses[selectedItem.color].bg} flex items-center justify-center mb-6 shadow-lg`}>
                {React.createElement(selectedItem.icon, { className: "w-8 h-8 text-white" })}
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {selectedItem.title}
              </h2>

              {/* Date */}
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {selectedItem.date}
              </p>

              {/* Details */}
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                  {selectedItem.details}
                </p>
              </div>

              {/* Tags */}
              <div className="mt-8 flex flex-wrap gap-3">
                {selectedItem.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${colorClasses[selectedItem.color].light} ${colorClasses[selectedItem.color].text}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ProjectTimelinePage;

