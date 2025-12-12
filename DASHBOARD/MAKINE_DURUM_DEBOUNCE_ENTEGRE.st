// ============================================
// Makine Durum Debounce - Mevcut Kodunuza Eklenecek
// ============================================
// VAR bloğuna eklenecek değişkenler:
//     startRunTimer : TON;  // Makine çalıştı timer'ı (2 saniye)

// ---------- Mevcut Kodunuzun Yerine Geçecek Bölüm ----------

// Makine durdu koşulu (anlık - hemen durdu sinyali ver)
IF GVL.RollerSpeedValue < 24 OR GVL.g_Coils[4] THEN
    GVL.makinaDurdu.0 := TRUE;
    startRunTimer(IN := FALSE);  // Timer'ı sıfırla
    
// Makine çalıştı koşulu (2 saniye debounce ile)
ELSIF GVL.RollerSpeedValue > 24.5 AND NOT GVL.g_Coils[4] THEN
    // Koşul sağlandı, timer'ı başlat
    startRunTimer(IN := TRUE, PT := T#2s);
    
    // Timer doldu mu? (2 saniye boyunca koşul sağlandı)
    IF startRunTimer.Q THEN
        GVL.makinaDurdu.0 := FALSE;  // 2 saniye sonra çalışıyor sinyali ver
    END_IF;
    
ELSE
    // Ara durum (24 ile 24.5 arası) - timer'ı sıfırla
    startRunTimer(IN := FALSE);
    // Önceki durumu koru (GVL.makinaDurdu.0 değişmez)
END_IF;

// ============================================
// AÇIKLAMA
// ============================================
// 1. Makine durdu: Hız < 24 veya g_Coils[4] aktif 
//    → Hemen GVL.makinaDurdu.0 := TRUE (güvenlik için anlık)
//    → Timer sıfırlanır
//
// 2. Makine çalıştı: Hız > 24.5 ve g_Coils[4] pasif
//    → Timer başlar (2 saniye)
//    → Timer dolduğunda GVL.makinaDurdu.0 := FALSE
//    → Timer dolmadan önce koşul bozulursa timer sıfırlanır
//
// 3. Ara durum: 24 ≤ Hız ≤ 24.5
//    → Timer sıfırlanır
//    → Önceki durum korunur (hysteresis)
//
// SONUÇ:
// ✅ Makine durduğunda anlık durdu sinyali (güvenlik)
// ✅ Makine çalıştığında 2 saniye beklenir (yanlış alarm önlenir)
// ✅ Kısa süreli hız artışları (karton geri gitme) makineyi çalışır göstermez

