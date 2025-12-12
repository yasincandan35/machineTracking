#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EGEM Makine Takip Sistemi - Job Passport API
Veritabanından veri çekerek iş pasaportu bilgilerini API olarak sunar
"""

from flask import Flask, request, jsonify
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
            "mssql+pyodbc://bakim:Bakim.2025@192.168.0.251/EGEM2025?"
            "driver=ODBC+Driver+17+for+SQL+Server&"
            "TrustServerCertificate=yes"
        )
        self.engine = None
        self.connection = None
        
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
        processed_data = {
            'is_adi': raw_data.get('stok_kodu', ''),
            'silindir_cevresi': self.get_silindir_cevresi(raw_data),
            'karton': raw_data.get('hammadde_kodu', ''),
            'renk_siralama': self.get_renk_siralama(raw_data),
            'silindir_kodlari': self.get_silindir_kodlari(raw_data),
            'murekkep_kodlari': self.get_murekkep_kodlari(raw_data),
            'vizkozite': self.get_vizkozite(raw_data),
            'solvent_orani': self.get_solvent_orani(raw_data),
            'medium_kodlari': self.get_medium_kodlari(raw_data),
            'toner_kodlari': self.get_toner_kodlari(raw_data)
        }
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
    
    def get_renk_siralama(self, data):
        """Renk sıralamasını al (RENK_SIRA1-12)"""
        renkler = []
        for i in range(1, 13):
            field_name = 'RENK_SIRA' + str(i)
            renkler.append(data.get(field_name, ''))
        return renkler
    
    def get_silindir_kodlari(self, data):
        """Silindir kodlarını al (silindir_no1-12)"""
        kodlar = []
        for i in range(1, 13):
            field_name = 'silindir_no' + str(i)
            kodlar.append(data.get(field_name, ''))
        return kodlar
    
    def get_murekkep_kodlari(self, data):
        """Mürekkep kodlarını al (MUREKKEP_KODU1-12)"""
        kodlar = []
        for i in range(1, 13):
            field_name = 'MUREKKEP_KODU' + str(i)
            kodlar.append(data.get(field_name, ''))
        return kodlar
    
    def get_vizkozite(self, data):
        """Vizkozite değerlerini al (VIZ_RENK_1-12)"""
        vizkoziteler = []
        for i in range(1, 13):
            field_name = 'VIZ_RENK_' + str(i)
            vizkoziteler.append(data.get(field_name, ''))
        return vizkoziteler
    
    def get_solvent_orani(self, data):
        """Solvent oranlarını al (INCELTICI1-12)"""
        oranlar = []
        for i in range(1, 13):
            field_name = 'INCELTICI' + str(i)
            oranlar.append(data.get(field_name, ''))
        return oranlar
    
    def get_medium_kodlari(self, data):
        """Medium kodlarını al (MEDIUM_KOD1-12)"""
        mediumlar = []
        for i in range(1, 13):
            field_name = 'MEDIUM_KOD' + str(i)
            mediumlar.append(data.get(field_name, ''))
        return mediumlar
    
    def get_toner_kodlari(self, data):
        """Toner kodlarını al (TONER_KOD_1_1 - TONER_KOD_4_12)"""
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
    
    def generate_html(self, job_data):
        """HTML sayfasını oluştur"""
        html_template = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EGEM Makine Takip Sistemi - İş Pasaportu</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Arial', sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 28px;
            margin-bottom: 10px;
        }}
        
        .header p {{
            font-size: 16px;
            opacity: 0.9;
        }}
        
        .job-info {{
            padding: 30px;
            background: #fafafa;
            border-bottom: 2px solid #e0e0e0;
        }}
        
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }}
        
        .info-item {{
            background: white;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }}
        
        .info-label {{
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .info-value {{
            color: #666;
            font-size: 16px;
        }}
        
        .machine-diagram {{
            padding: 30px;
            text-align: center;
            background: white;
        }}
        
        .diagram-title {{
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
        }}
        
        .main-image {{
            max-width: 100%;
            height: auto;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }}
        
        .units-container {{
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 15px;
            margin-top: 20px;
        }}
        
        .unit {{
            background: #f8f9fa;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            min-width: 120px;
            text-align: center;
            transition: all 0.3s ease;
        }}
        
        .unit:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            border-color: #667eea;
        }}
        
        .unit-number {{
            font-size: 18px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 8px;
        }}
        
        .unit-data {{
            font-size: 12px;
            color: #666;
            line-height: 1.4;
        }}
        
        .unit-data div {{
            margin-bottom: 3px;
        }}
        
        .footer {{
            background: #333;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
        }}
        
        @media (max-width: 768px) {{
            .info-grid {{
                grid-template-columns: 1fr;
            }}
            
            .units-container {{
                flex-direction: column;
                align-items: center;
            }}
            
            .unit {{
                width: 100%;
                max-width: 300px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>EGEM Makine Takip Sistemi</h1>
            <p>İş Pasaportu - {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
        </div>
        
        <div class="job-info">
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">İşin Adı</div>
                    <div class="info-value">{job_data['is_adi']}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Silindir Çevresi</div>
                    <div class="info-value">{job_data['silindir_cevresi']} mm</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Karton</div>
                    <div class="info-value">{job_data['karton']}</div>
                </div>
            </div>
        </div>
        
        <div class="machine-diagram">
            <div class="diagram-title">Lemanic 12 Ünite Makine Diyagramı</div>
            <img src="lpng/lemanic12unit.png" alt="Lemanic 12 Ünite" class="main-image">
            
            <div class="units-container">
                {self.generate_units_html(job_data)}
            </div>
        </div>
        
        <div class="footer">
            <p>© 2024 EGEM Makine Takip Sistemi - Tüm hakları saklıdır.</p>
        </div>
    </div>
</body>
</html>
        """
        return html_template
    
    def generate_units_html(self, job_data):
        """12 ünite için HTML oluştur"""
        units_html = ""
        
        # Sağdan sola doğru sıralama (12'den 1'e)
        for i in range(12, 0, -1):
            unit_index = i - 1  # Array index (0-11)
            
            # Verileri al
            renk = job_data['renk_siralama'][unit_index] if unit_index < len(job_data['renk_siralama']) else '-'
            silindir = job_data['silindir_kodlari'][unit_index] if unit_index < len(job_data['silindir_kodlari']) else '-'
            murekkep = job_data['murekkep_kodlari'][unit_index] if unit_index < len(job_data['murekkep_kodlari']) else '-'
            vizkozite = job_data['vizkozite'][unit_index] if unit_index < len(job_data['vizkozite']) else '-'
            solvent = job_data['solvent_orani'][unit_index] if unit_index < len(job_data['solvent_orani']) else '-'
            
            units_html += """
                <div class="unit">
                    <div class="unit-number">Ünite """ + str(i) + """</div>
                    <div class="unit-data">
                        <div><strong>Renk:</strong> """ + str(renk) + """</div>
                        <div><strong>Silindir:</strong> """ + str(silindir) + """</div>
                        <div><strong>Mürekkep:</strong> """ + str(murekkep) + """</div>
                        <div><strong>Vizkozite:</strong> """ + str(vizkozite) + """</div>
                        <div><strong>Solvent:</strong> """ + str(solvent) + """%</div>
                    </div>
                </div>
            """
        
        return units_html
    
    def save_html(self, html_content, filename="job_passport.html"):
        """HTML dosyasını kaydet"""
        try:
            filepath = os.path.join(os.path.dirname(__file__), filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"HTML dosyası kaydedildi: {filepath}")
            return True
        except Exception as e:
            print(f"Dosya kaydetme hatası: {e}")
            return False
    
# API instance oluştur
api = JobPassportAPI()

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
    print("API endpoint çağrıldı!")  # Debug için
    try:
        data = request.get_json()
        print(f"Gelen veri: {data}")  # Debug için
        stok_kodu = data.get('stok_kodu', '').strip()
        
        if not stok_kodu:
            return jsonify({'error': 'stok_kodu gerekli'}), 400
        
        # Veritabanına bağlan
        if not api.connect_database():
            return jsonify({'error': 'Veritabanı bağlantı hatası'}), 500
        
        try:
            # İş verilerini al
            job_data = api.get_job_data_by_stok_kodu(stok_kodu)
            
            if job_data:
                return jsonify({
                    'success': True,
                    'data': job_data
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'stok_kodu "' + stok_kodu + '" ile veri bulunamadı'
                }), 200
                
        finally:
            api.disconnect_database()
            
    except Exception as e:
        print(f"API hatası: {e}")  # Debug için
        return jsonify({'error': f'API hatası: {str(e)}'}), 500

@app.route('/')
def index():
    """Ana sayfa - HTML dosyasını döndür"""
    try:
        import os
        static_path = os.path.join(os.path.dirname(__file__), 'static', 'index.html')
        with open(static_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"HTML dosyası bulunamadı: {e}"

@app.route('/lpng/<path:filename>')
def serve_lpng(filename):
    """lpng klasöründeki dosyaları serve et"""
    try:
        import os
        lpng_path = os.path.join(os.path.dirname(__file__), 'lpng', filename)
        if os.path.exists(lpng_path):
            from flask import send_file
            return send_file(lpng_path)
        else:
            return f"Görsel bulunamadı: {filename}", 404
    except Exception as e:
        return f"Görsel yükleme hatası: {e}", 500

if __name__ == "__main__":
    import os
    # .env dosyası okumayı devre dışı bırak
    os.environ['FLASK_SKIP_DOTENV'] = '1'
    
    print("EGEM Makine Takip Sistemi - Job Passport API başlatılıyor...")
    print("API URL: http://192.168.1.44:3000")
    print("HTML Sayfası: http://192.168.1.44:3000")
    print("Network'ten erişilebilir - Tüm cihazlar bağlanabilir")
    app.run(debug=True, host='0.0.0.0', port=3000)
