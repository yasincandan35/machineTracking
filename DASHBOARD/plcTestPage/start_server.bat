@echo off
echo EGEM Makine Takip Sistemi - PLC Test Server
echo ===========================================
echo.

echo Python paketleri yukleniyor...
pip install -r requirements.txt

echo.
echo PLC Test Server baslatiliyor...
echo API: http://localhost:5000
echo Test Sayfasi: http://localhost:5000/index.html
echo.

python plc_server.py

pause
