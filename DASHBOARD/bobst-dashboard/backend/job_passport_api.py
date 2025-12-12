#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EGEM Makine Takip Sistemi - Job Passport API
Veritabanından veri çekerek iş pasaportu bilgilerini API olarak sunar
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from sqlalchemy import create_engine, text
import os
from datetime import datetime
import json

# Flask uygulaması oluştur
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # CORS desteği ekle

class JobPassportAPI:
    def __init__(self):
        self.connection_string = (
            "mssql+pyodbc://bakim:3542@192.168.0.251/EGEM2025?"
            "driver=ODBC+Driver+17+for+SQL+Server&"
            "TrustServerCertificate=yes"
        )
        self.engine = None
        self.connection = None
        
        # Lemanic 1 makinası için DR Blade Açıları tablosu
        self.dr_blade_table = [
            # F, V, H
            (400, 58, 36), (410, 56, 36), (420, 53, 36), (430, 50, 36), (440, 47, 36), (450, 43, 36), (460, 40, 36), (470, 37, 36), (480, 34, 36), (490, 31, 36), (500, 27, 36), (510, 25, 36), (520, 24, 35), (530, 22, 35),
            (540, 20, 34), (550, 18, 34), (560, 16, 34), (570, 15, 33), (580, 12, 33), (590, 12, 32), (600, 10, 32), (610, 8, 31), (620, 6, 31), (630, 5, 30), (640, 3, 30), (650, 2, 29), (660, 1, 28), (670, 0, 28),
            (680, 0, 26), (690, 0, 25), (700, 0, 24), (710, 0, 23), (720, 0, 21), (730, 0, 20), (740, 0, 19), (750, 0, 17), (760, 0, 16), (770, 0, 15), (780, 0, 14), (790, 0, 12), (800, 0, 11)
        ]
        
    def connect_database(self):
        """Veritabanına bağlan"""
        try:
            self.engine = create_engine(self.connection_string)
            self.connection = self.engine.connect()
            print("Veritabanına başarıyla bağlandı")
            return True
        except Exception as e:
            print(f"Veritabanı bağlantı hatası: {e}")
            return False
    
    def disconnect_database(self):
        """Veritabanı bağlantısını kapat"""
        if self.connection:
            self.connection.close()
            print("Veritabanı bağlantısı kapatıldı")
    
    def get_job_data_by_stok_kodu(self, stok_kodu):
        """stok_kodu ile iş verilerini veritabanından çek"""
        if not self.connection:
            return None
            
        try:
            # EGEM_GRAVUR_SIPARIS_IZLEME tablosundan veri çek
            query = text("""
            SELECT * FROM [EGEM2025].[dbo].[EGEM_GRAVUR_SIPARIS_IZLEME] 
            WHERE stok_kodu LIKE :stok_kodu
            """)
            
            result = self.connection.execute(query, {"stok_kodu": "%" + stok_kodu + "%"})
            job_data = result.fetchone()
            
            if job_data:
                # Result'ı dictionary'ye çevir
                job_dict = dict(job_data._mapping)
                return self.process_job_data(job_dict)
            else:
                print("stok_kodu '" + stok_kodu + "' ile veri bulunamadı")
                return None
                
        except Exception as e:
            print(f"Veri çekme hatası: {e}")
            return None
    
    def process_job_data(self, raw_data):
        """Ham veriyi işle ve formatla"""
        print("🚀 Job data işleniyor...")
        silindir_cevresi = self.get_silindir_cevresi(raw_data)
        print(f"📏 Silindir çevresi: {silindir_cevresi}")
        
        dr_blade_angles = self.get_dr_blade_angles(silindir_cevresi)
        print(f"🔧 DR Blade açıları: {dr_blade_angles}")
        
        processed_data = {
            'is_adi': raw_data.get('stok_kodu', ''),
            'silindir_cevresi': silindir_cevresi,
            'dr_blade_angles': dr_blade_angles,  # F, V, H değerleri
            'karton': raw_data.get('hammadde_kodu', ''),
            'renk_siralama': self.get_renk_siralama(raw_data),
            'silindir_kodlari': self.get_silindir_kodlari(raw_data),
            'murekkep_kodlari': self.get_murekkep_kodlari(raw_data),
            'vizkozite': self.get_vizkozite(raw_data),
            'solvent_orani': self.get_solvent_orani(raw_data),
            'medium_kodlari': self.get_medium_kodlari(raw_data),
            'toner_kodlari': self.get_toner_kodlari(raw_data)
        }
        print(f"✅ Processed data hazır: {processed_data}")
        return processed_data
    
    def get_silindir_cevresi(self, data):
        """Silindir çevresini belirle (silindir_cevresi, silindir_cevre1-12)"""
        # Önce ana silindir_cevresi'ne bak
        if data.get('silindir_cevresi') and data.get('silindir_cevresi') != 0:
            return str(data['silindir_cevresi'])
        
        # Sonra silindir_cevre1-12'ye bak
        for i in range(1, 13):
            field_name = 'silindir_cevre' + str(i)
            if data.get(field_name) and data.get(field_name) != 0:
                return str(data[field_name])
        
        return "0.00"
    
    def get_dr_blade_angles(self, silindir_cevresi_str):
        """Silindir çevresine göre DR Blade açılarını hesapla (F, V, H) - Düşük değere yuvarlama"""
        print(f"🔍 DR Blade açıları hesaplanıyor - Silindir çevresi: {silindir_cevresi_str}")
        try:
            # Virgülü noktaya çevir (Türkçe format: 707,348 -> 707.348)
            silindir_cevresi_str = silindir_cevresi_str.replace(',', '.')
            silindir_cevresi = float(silindir_cevresi_str)
            print(f"📊 Float değeri: {silindir_cevresi}")
            
            # Tabloda tam eşleşme ara
            for f, v, h in self.dr_blade_table:
                if f == silindir_cevresi:
                    result = {'F': f, 'V': v, 'H': h}
                    print(f"✅ Tam eşleşme bulundu: F={f}, V={v}, H={h}")
                    return result
            
            # Tam eşleşme yoksa düşük değere yuvarla (floor mantığı)
            # Tabloyu F değerine göre sırala
            sorted_table = sorted(self.dr_blade_table, key=lambda x: x[0])
            
            # Silindir çevresinden küçük veya eşit en büyük değeri bul
            result = {'F': 0, 'V': 0, 'H': 0}
            for f, v, h in sorted_table:
                if f <= silindir_cevresi:
                    result = {'F': f, 'V': v, 'H': h}
                    print(f"🔄 Düşük değere yuvarlama: F={f}, V={v}, H={h}")
                else:
                    break  # İlk büyük değerde dur
            
            print(f"🎯 Final sonuç: F={result['F']}, V={result['V']}, H={result['H']}")
            return result
            
        except (ValueError, TypeError) as e:
            print(f"❌ Hata: {e}")
            return {'F': 0, 'V': 0, 'H': 0}
    
    def get_renk_siralama(self, data):
        """Renk sıralamasını al (RENK_SIRA1-12) - HER ZAMAN 12 ELEMAN"""
        renkler = []
        for i in range(1, 13):
            field_name = 'RENK_SIRA' + str(i)
            renkler.append(data.get(field_name, ''))
        return renkler
    
    def get_silindir_kodlari(self, data):
        """Silindir kodlarını al (silindir_no1-12) - HER ZAMAN 12 ELEMAN"""
        kodlar = []
        for i in range(1, 13):
            field_name = 'silindir_no' + str(i)
            kodlar.append(data.get(field_name, ''))
        return kodlar
    
    def get_murekkep_kodlari(self, data):
        """Mürekkep kodlarını al (MUREKKEP_KODU1-12) - HER ZAMAN 12 ELEMAN"""
        kodlar = []
        for i in range(1, 13):
            field_name = 'MUREKKEP_KODU' + str(i)
            kodlar.append(data.get(field_name, ''))
        return kodlar
    
    def get_vizkozite(self, data):
        """Vizkozite değerlerini al (VIZ_RENK_1-12) - HER ZAMAN 12 ELEMAN"""
        vizkoziteler = []
        for i in range(1, 13):
            field_name = 'VIZ_RENK_' + str(i)
            vizkoziteler.append(data.get(field_name, ''))
        return vizkoziteler
    
    def get_solvent_orani(self, data):
        """Solvent oranlarını al (INCELTICI1-12) - HER ZAMAN 12 ELEMAN"""
        oranlar = []
        for i in range(1, 13):
            field_name = 'INCELTICI' + str(i)
            oranlar.append(data.get(field_name, ''))
        return oranlar
    
    def get_medium_kodlari(self, data):
        """Medium kodlarını al (MEDIUM_KOD1-12) - HER ZAMAN 12 ELEMAN"""
        mediumlar = []
        for i in range(1, 13):
            field_name = 'MEDIUM_KOD' + str(i)
            mediumlar.append(data.get(field_name, ''))
        return mediumlar
    
    def get_toner_kodlari(self, data):
        """Toner kodlarını al (TONER_KOD_1_1 - TONER_KOD_4_12) - HER ZAMAN 12 ELEMAN"""
        # Her ünite için 4 toner olabilir
        toner_data = []
        for unite in range(1, 13):  # 12 ünite
            unite_tonerler = []
            for toner_no in range(1, 5):  # 4 toner
                field_name = 'TONER_KOD_' + str(toner_no) + '_' + str(unite)
                toner_value = data.get(field_name, '')
                if toner_value:
                    unite_tonerler.append(toner_value)
            # Tonerları birleştir
            if unite_tonerler:
                toner_data.append(', '.join(unite_tonerler))
            else:
                toner_data.append('')
        return toner_data

# Global API instance
job_api = JobPassportAPI()

@app.route('/test')
def test():
    return "Flask çalışıyor!"

@app.route('/api/health', methods=['GET'])
def health_check():
    """Backend sağlık kontrolü"""
    return jsonify({
        'status': 'online',
        'service': 'Job Passport API',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/job-data', methods=['POST'])
def get_job_data():
    """stok_kodu ile iş verilerini getir"""
    print("API endpoint çağrıldı!")
    try:
        data = request.get_json()
        print("Gelen veri: " + str(data))
        stok_kodu = data.get('stok_kodu', '').strip()
        
        if not stok_kodu:
            return jsonify({
                'success': False,
                'error': 'Stok kodu boş olamaz'
            }), 400
        
        # Veritabanına bağlan
        if not job_api.connect_database():
            return jsonify({
                'success': False,
                'error': 'Veritabanı bağlantı hatası'
            }), 500
        
        # Veriyi çek
        job_data = job_api.get_job_data_by_stok_kodu(stok_kodu)
        
        # Bağlantıyı kapat
        job_api.disconnect_database()
        
        if job_data:
            return jsonify({
                'success': True,
                'data': job_data
            })
        else:
            return jsonify({
                'success': False,
                'error': 'SIPARIS_NO "' + stok_kodu + '" ile veri bulunamadı'
            }), 404
            
    except Exception as e:
        print("Hata oluştu: " + str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/lpng/<path:filename>')
def serve_image(filename):
    """PNG dosyalarını sun"""
    try:
        # lpng klasörünün yolu
        lpng_path = os.path.join(os.path.dirname(__file__), '..', 'lpng', filename)
        lpng_path = os.path.abspath(lpng_path)
        
        # Dosya kontrolü
        if not os.path.exists(lpng_path):
            return "Dosya bulunamadı", 404
        
        return send_file(lpng_path)
    except Exception as e:
        print("Görsel yükleme hatası: " + str(e))
        return "Görsel yükleme hatası: " + str(e), 500

if __name__ == "__main__":
    import os
    # .env dosyası okumayı devre dışı bırak
    os.environ['FLASK_SKIP_DOTENV'] = '1'
    
    print("EGEM Makine Takip Sistemi - Job Passport API başlatılıyor...")
    print("API URL: http://192.168.1.44:3000")
    print("HTML Sayfası: http://192.168.1.44:3000")
    print("Network'ten erişilebilir - Tüm cihazlar bağlanabilir")
    app.run(debug=True, host='0.0.0.0', port=3000)

