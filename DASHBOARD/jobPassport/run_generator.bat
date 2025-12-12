@echo off
echo EGEM Makine Takip Sistemi - Job Passport API
echo ============================================
echo.

REM Python'un yüklü olup olmadığını kontrol et
python --version >nul 2>&1
if errorlevel 1 (
    echo HATA: Python yüklü değil!
    echo Lütfen Python'u yükleyin: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Gerekli paketleri yükle
echo Gerekli paketler yükleniyor...
pip install -r requirements.txt

echo.
echo Job Passport API başlatılıyor...
echo.
echo Web arayüzü: http://localhost:5000
echo API endpoint: http://localhost:5000/api/job-data
echo.
echo Çıkmak için Ctrl+C tuşlarına basın.
echo.

REM Python scriptini çalıştır
python job_passport_generator.py

echo.
echo API durduruldu. Çıkmak için bir tuşa basın...
pause
