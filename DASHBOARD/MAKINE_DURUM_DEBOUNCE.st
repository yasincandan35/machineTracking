// ============================================
// Makine Durum Debounce - 2 Saniye Kontrolü
// ============================================
// Sorun: Makine durduğunda karton geri gidiyor ve çok uçuk period değerleri çıkıyor
// Bu da hızın 250'ye çıkmasına ve makine anlık çalıştı-durdu sinyali vermesine neden oluyor
// Çözüm: Makine çalıştı sinyali için 2 saniye boyunca 24.5'ten büyük olması gerekiyor

// ---------- Değişken Tanımlamaları (VAR bloğuna eklenecek) ----------
// VAR
//     startRunTimer : TON;              // Makine çalıştı timer'ı (2 saniye)
//     runConditionMet : BOOL := FALSE;  // 2 saniye boyunca koşul sağlandı mı?
// END_VAR

// ---------- Makine Durum Kontrolü (Debounce ile) ----------

// Makine durdu koşulu (anlık - değişmedi)
IF GVL.RollerSpeedValue < 24 OR GVL.g_Coils[4] THEN
    GVL.makinaDurdu.0 := TRUE;
    // Timer'ı sıfırla (makine durdu, timer çalışmasın)
    startRunTimer(IN := FALSE);
    runConditionMet := FALSE;
    
// Makine çalıştı koşulu (2 saniye debounce ile)
ELSIF GVL.RollerSpeedValue > 24.5 AND NOT GVL.g_Coils[4] THEN
    // Koşul sağlandı, timer'ı başlat
    startRunTimer(IN := TRUE, PT := T#2s);
    
    // Timer doldu mu? (2 saniye boyunca koşul sağlandı)
    IF startRunTimer.Q THEN
        runConditionMet := TRUE;
        GVL.makinaDurdu.0 := FALSE;
    ELSE
        // Timer henüz dolmadı, makine hala durmuş sayılır
        // (Önceki durumu koru - FALSE yapma, TRUE kalabilir)
        // Eğer önceki durum FALSE ise, TRUE yapma (bekle)
    END_IF;
    
ELSE
    // Ara durum (24 ile 24.5 arası veya g_Coils[4] durumu değişti)
    // Timer'ı sıfırla, koşul sağlanmadı
    startRunTimer(IN := FALSE);
    runConditionMet := FALSE;
    // Önceki durumu koru (GVL.makinaDurdu.0 değişmez)
END_IF;

// ============================================
// ALTERNATİF ÇÖZÜM: Daha Basit Versiyon
// ============================================
// Eğer yukarıdaki çözüm çalışmazsa, bu versiyonu deneyin:

// ---------- Alternatif: Sadece Timer ile ----------
// IF GVL.RollerSpeedValue < 24 OR GVL.g_Coils[4] THEN
//     GVL.makinaDurdu.0 := TRUE;
//     startRunTimer(IN := FALSE);  // Timer'ı sıfırla
//     
// ELSIF GVL.RollerSpeedValue > 24.5 AND NOT GVL.g_Coils[4] THEN
//     startRunTimer(IN := TRUE, PT := T#2s);
//     
//     // Timer dolduğunda makine çalışıyor say
//     IF startRunTimer.Q THEN
//         GVL.makinaDurdu.0 := FALSE;
//     END_IF;
//     
// ELSE
//     // Ara durum - timer'ı sıfırla
//     startRunTimer(IN := FALSE);
// END_IF;

// ============================================
// AÇIKLAMA
// ============================================
// 1. Makine durdu: Hız < 24 veya g_Coils[4] aktif → Hemen durdu sinyali ver
// 2. Makine çalıştı: Hız > 24.5 ve g_Coils[4] pasif → Timer başlat
// 3. Timer 2 saniye doldu: Makine çalışıyor sinyali ver
// 4. Timer dolmadan önce koşul bozulursa: Timer sıfırlanır, makine durmuş kalır
//
// Bu sayede:
// - Makine durduğunda anlık durdu sinyali verilir (güvenlik için)
// - Makine çalıştığında 2 saniye beklenir (yanlış alarm önlenir)
// - Kısa süreli hız artışları makineyi çalışır göstermez

