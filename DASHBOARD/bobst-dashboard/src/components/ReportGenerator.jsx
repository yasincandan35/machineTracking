import React from 'react';

const ReportGenerator = {
  // Generate report HTML content - Modal'ın birebir aynısı
  generateReportHTML: (report, oeeData, stoppageData, operatorSummary, speedData) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>EGEM Makine Takip Sistemi - Rapor ${report.siparis_no}</title>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            background: #f3f4f6;
            padding: 20px;
          }
          
          .modal-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
          }
          
          .modal-header {
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .modal-title {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
          }
          
          .modal-content {
            padding: 24px;
          }
          
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
          }
          
          .card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
          }
          
          .card-header {
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #374151;
            font-size: 14px;
          }
          
          .card-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
          }
          
          .info-label {
            color: #6b7280;
          }
          
          .info-value {
            font-weight: 500;
            color: #111827;
          }
          
          .info-value.font-medium {
            font-weight: 600;
          }
          
          .info-value.text-xs {
            font-size: 12px;
          }
          
          .section {
            margin-top: 24px;
          }
          
          .section-header {
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #374151;
            font-size: 16px;
          }
          
          .oee-section {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
          }
          
          .oee-main {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .oee-value {
            font-size: 36px;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 8px;
          }
          
          .oee-components {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }
          
          .oee-component {
            background: white;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            border: 1px solid #e5e7eb;
          }
          
          .oee-component-value {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          
          .oee-component-label {
            font-size: 12px;
            color: #6b7280;
          }
          
          .chart-section {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
          }
          
          .chart-title {
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #374151;
            font-size: 14px;
          }
          
          .chart-placeholder {
            height: 200px;
            background: #f3f4f6;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
            font-style: italic;
            border: 2px dashed #d1d5db;
          }
          
          .footer {
            background: #f9fafb;
            padding: 16px 24px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            
            .modal-container {
              box-shadow: none;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="modal-container">
          <!-- Modal Header -->
          <div class="modal-header">
            <h2 class="modal-title">Rapor Detayları</h2>
          </div>
          
          <!-- Modal Content -->
          <div class="modal-content">
            <!-- Ana Grid - Sol ve Sağ Panel -->
            <div class="grid">
              <!-- Sol Panel - Genel Bilgiler -->
              <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- İş Emri Bilgileri -->
                <div class="card">
                  <div class="card-header">
                    🎯 İş Emri Bilgileri
                  </div>
                  <div class="card-content">
                    <div class="info-item">
                      <span class="info-label">İş Emri No:</span>
                      <span class="info-value font-medium">${report.siparis_no}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Toplam Miktar:</span>
                      <span class="info-value">${report.toplam_miktar?.toLocaleString() || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Kalan Miktar:</span>
                      <span class="info-value">${report.kalan_miktar?.toLocaleString() || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Set Sayısı:</span>
                      <span class="info-value">${report.set_sayisi || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Üretim Tipi:</span>
                      <span class="info-value">${report.uretim_tipi || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Stok Adı:</span>
                      <span class="info-value text-xs">${report.stok_adi || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Bundle:</span>
                      <span class="info-value">${report.bundle || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Silindir Çevresi:</span>
                      <span class="info-value">${report.silindir_cevresi || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Hedef Hız:</span>
                      <span class="info-value">${report.hedef_hiz || 0}</span>
                    </div>
                  </div>
                </div>

                <!-- Zaman Bilgileri -->
                <div class="card">
                  <div class="card-header">
                    🕐 Zaman Bilgileri
                  </div>
                  <div class="card-content">
                    <div class="info-item">
                      <span class="info-label">Başlangıç:</span>
                      <span class="info-value">${new Date(report.jobStartTime).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Bitiş:</span>
                      <span class="info-value">${new Date(report.jobEndTime).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Süre:</span>
                      <span class="info-value font-medium">${ReportGenerator.formatDuration(report.jobStartTime, report.jobEndTime)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sağ Panel - Üretim ve Duruş Bilgileri -->
              <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- Üretim Bilgileri -->
                <div class="card">
                  <div class="card-header">
                    📈 Üretim Bilgileri
                  </div>
                  <div class="card-content">
                    <div class="info-item">
                      <span class="info-label">Gerçek Üretim:</span>
                      <span class="info-value font-medium">${report.actualProduction?.toLocaleString() || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Kalan İş:</span>
                      <span class="info-value">${report.remainingWork?.toLocaleString() || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Tamamlanma Oranı:</span>
                      <span class="info-value font-medium">%${report.completionPercentage || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Fazla Üretim:</span>
                      <span class="info-value">${report.overProduction?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                </div>

                <!-- Fire Bilgileri -->
                <div class="card">
                  <div class="card-header">
                    ⚠️ Fire Bilgileri
                  </div>
                  <div class="card-content">
                    <div class="info-item">
                      <span class="info-label">Die Öncesi Fire:</span>
                      <span class="info-value">${report.wastageBeforeDie?.toFixed(2) || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Die Sonrası Fire:</span>
                      <span class="info-value">${report.wastageAfterDie?.toFixed(2) || 0}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Fire Oranı:</span>
                      <span class="info-value font-medium">%${report.wastageRatio?.toFixed(2) || 0}</span>
                    </div>
                  </div>
                </div>

                <!-- Tüketim Bilgileri -->
                <div class="card">
                  <div class="card-header">
                    ✅ Tüketim Bilgileri
                  </div>
                  <div class="card-content">
                    <div class="info-item">
                      <span class="info-label">Etil Alkol:</span>
                      <span class="info-value">${report.ethylAlcoholConsumption?.toFixed(2) || 0}L</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Etil Asetat:</span>
                      <span class="info-value">${report.ethylAcetateConsumption?.toFixed(2) || 0}L</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Kağıt:</span>
                      <span class="info-value">${report.paperConsumption?.toFixed(2) || 0}m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- OEE Hesaplama -->
            ${oeeData ? `
            <div class="oee-section">
              <div class="oee-main">
                <div class="oee-value">%${oeeData.oee}</div>
                <div>Genel OEE (Overall Equipment Effectiveness)</div>
              </div>
              <div class="oee-components">
                <div class="oee-component">
                  <div class="oee-component-value">%${oeeData.availability}</div>
                  <div class="oee-component-label">Availability<br>Erişilebilirlik</div>
                </div>
                <div class="oee-component">
                  <div class="oee-component-value">%${oeeData.performance}</div>
                  <div class="oee-component-label">Performance<br>Performans</div>
                </div>
                <div class="oee-component">
                  <div class="oee-component-value">%${oeeData.quality}</div>
                  <div class="oee-component-label">Quality<br>Kalite</div>
                </div>
              </div>
              
              <!-- OEE Detayları -->
              <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="font-weight: 600; margin-bottom: 12px; color: #374151;">Hesaplama Detayları</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Planlanan Süre:</span>
                    <span style="font-weight: 500;">${ReportGenerator.formatDurationFromMinutes(oeeData.planlananSure)}${oeeData.setupTime > 0 ? ` (Setup: ${ReportGenerator.formatDurationFromMinutes(oeeData.setupTime)})` : ''}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Gerçek Çalışma:</span>
                    <span style="font-weight: 500;">${ReportGenerator.formatDurationFromMinutes(oeeData.gercekCalismaSuresi)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Hedef Üretim:</span>
                    <span style="font-weight: 500;">${oeeData.hedefUretim?.toLocaleString()} adet</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Gerçek Üretim:</span>
                    <span style="font-weight: 500;">${oeeData.actualProduction?.toLocaleString()} adet</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Die Öncesi Fire:</span>
                    <span style="font-weight: 500;">${oeeData.dieOncesiAdet} adet</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Die Sonrası Fire:</span>
                    <span style="font-weight: 500;">${oeeData.wastageAfterDie} adet</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Toplam Fire:</span>
                    <span style="font-weight: 500;">${oeeData.hataliUretim} adet</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280;">Duruş Süresi:</span>
                    <span style="font-weight: 500;">${ReportGenerator.formatDurationFromMinutes(oeeData.totalStoppageDuration / 60)}</span>
                  </div>
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Duruş Dağılımı -->
            ${stoppageData && stoppageData.length > 0 ? `
            <div class="chart-section">
              <div class="chart-title">📊 Duruş Dağılımı</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px;">
                ${stoppageData.map(item => `
                  <div style="background: white; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb;">
                    <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${item.categoryName || 'Bilinmeyen'}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${item.reasonName || 'Bilinmeyen Sebep'}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 14px; font-weight: 500;">${ReportGenerator.formatDurationFromSeconds(item.totalDurationSeconds)}</span>
                      <span style="font-size: 12px; color: #6b7280;">${item.count} kez</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- Operatör Özeti -->
            ${operatorSummary && operatorSummary.length > 0 ? `
            <div class="chart-section">
              <div class="chart-title">👥 Operatör/Shift Çalışma Süreleri</div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-top: 16px;">
                ${operatorSummary.map(item => `
                  <div style="background: white; border-radius: 8px; padding: 12px; border: 1px solid #e5e7eb;">
                    <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">${item.operatorName || 'Bilinmeyen Operatör'}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${item.shiftName || 'Bilinmeyen Vardiya'}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-size: 14px; font-weight: 500;">${ReportGenerator.formatDurationFromSeconds(item.totalWorkSeconds)}</span>
                      <span style="font-size: 12px; color: #6b7280;">${item.jobCount} iş</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <!-- Hız Grafiği -->
            ${speedData && speedData.length > 0 ? `
            <div class="chart-section">
              <div class="chart-title">📈 Makine Hız Grafiği</div>
              <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 2px;"></div>
                    <span style="font-size: 14px; color: #374151;">Gerçek Hız</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 2px;"></div>
                    <span style="font-size: 14px; color: #374151;">Hedef Hız</span>
                  </div>
                </div>
                <div style="height: 200px; background: #f9fafb; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-style: italic;">
                  Hız Grafiği: ${speedData.length} veri noktası<br>
                  <small>Grafik görselleştirmesi için SVG veya Chart.js gerekli</small>
                </div>
                <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #6b7280;">
                  <div>Ortalama Hız: ${Math.round(speedData.reduce((sum, item) => sum + item.machineSpeed, 0) / speedData.length)} m/dk</div>
                  <div>Maksimum Hız: ${Math.max(...speedData.map(item => item.machineSpeed))} m/dk</div>
                </div>
              </div>
            </div>
            ` : ''}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>EGEM Makine Takip Sistemi - ${new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.</p>
            <p>Tüm süreler SS:DD:SS formatında gösterilmektedir (Saat:Dakika:Saniye)</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  // Format duration helper
  formatDuration: (startTime, endTime) => {
    if (!startTime || !endTime) return '00:00:00';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  // Format duration from seconds
  formatDurationFromSeconds: (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  // Format duration from minutes
  formatDurationFromMinutes: (totalMinutes) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  // Export to PDF
  exportToPDF: (report, oeeData, stoppageData, operatorSummary, speedData) => {
    try {
      const printWindow = window.open('', '_blank');
      const reportContent = ReportGenerator.generateReportHTML(report, oeeData, stoppageData, operatorSummary, speedData);
      
      printWindow.document.write(reportContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
      return { success: true, message: 'PDF yazdırma penceresi açıldı!' };
    } catch (error) {
      console.error('PDF export error:', error);
      return { success: false, message: 'PDF oluşturulamadı: ' + error.message };
    }
  },

  // Print report
  printReport: (report, oeeData, stoppageData, operatorSummary, speedData) => {
    try {
      const printWindow = window.open('', '_blank');
      const reportContent = ReportGenerator.generateReportHTML(report, oeeData, stoppageData, operatorSummary, speedData);
      
      printWindow.document.write(reportContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
      return { success: true, message: 'Yazdırma penceresi açıldı!' };
    } catch (error) {
      console.error('Print error:', error);
      return { success: false, message: 'Yazdırılamadı: ' + error.message };
    }
  }
};

export default ReportGenerator;
