import os
os.environ['FLASK_SKIP_DOTENV'] = '1'

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymodbus.client import ModbusTcpClient
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# PLC baglanti bilgileri
PLC_IP = "192.168.0.104"
PLC_PORT = 1502
SLAVE_ID = 1

class PLCManager:
    def __init__(self):
        self.client = None
    
    def connect(self):
        try:
            if self.client is None:
                self.client = ModbusTcpClient(PLC_IP, port=PLC_PORT)
            
            if not self.client.is_socket_open():
                self.client.connect()
                logger.info(f"PLC'ye baglandi: {PLC_IP}:{PLC_PORT}")
                return True
            return True
        except Exception as e:
            logger.error(f"PLC baglanti hatasi: {e}")
            self.client = None
            return False
    
    def write_coil(self, address, value):
        try:
            if not self.connect():
                return False, "PLC baglantisi kurulamadi"
            
            result = self.client.write_coil(address, value, unit=SLAVE_ID)
            
            if result.isError():
                logger.error(f"Bit yazma hatasi: {result}")
                self.client = None
                return False, f"Bit yazma hatasi: {result}"
            
            logger.info(f"Bit yazildi: coil {address} = {value}")
            return True, "Basari"
            
        except Exception as e:
            logger.error(f"Genel hata: {e}")
            self.client = None
            return False, f"Genel hata: {e}"

# Global PLC manager
plc_manager = PLCManager()

def parse_address(address_string):
    try:
        # DB1.DBX0.0 formatindan parse et
        if 'DB' in address_string and 'DBX' in address_string:
            parts = address_string.split('.')
            if len(parts) == 3:
                db_num = int(parts[0].replace('DB', ''))
                byte_offset = int(parts[1].replace('DBX', ''))
                bit_offset = int(parts[2])
                coil_address = (db_num - 1) * 100 + byte_offset * 8 + bit_offset
                return coil_address
        
        # Eger sadece sayi ise direkt kullan
        return int(address_string)
        
    except Exception as e:
        raise ValueError(f"Gecersiz adres formati: {address_string} - {e}")

@app.route('/api/plc/write-bit', methods=['POST'])
def write_bit():
    try:
        data = request.get_json()
        address_string = data.get('address')
        value = data.get('value', False)
        
        if not address_string:
            return jsonify({'success': False, 'error': 'Adres gerekli'}), 400
        
        coil_address = parse_address(address_string)
        
        # PLC'ye bit yaz
        success, message = plc_manager.write_coil(coil_address, value)
        
        if success:
            return jsonify({
                'success': True, 
                'message': f'Bit yazildi: {address_string} = {value}',
                'address': address_string,
                'coil_address': coil_address,
                'value': value,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'success': False, 'error': message}), 500
        
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Genel hata: {e}")
        return jsonify({'success': False, 'error': f'Genel hata: {e}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'EGEM PLC Test Server',
        'plc_port': PLC_PORT,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    try:
        logger.info("EGEM PLC Test Server baslatiliyor...")
        logger.info(f"PLC Adresi: {PLC_IP}:{PLC_PORT}")
        app.run(host='127.0.0.1', port=5000, debug=False)
    except Exception as e:
        logger.error(f"Server hatasi: {e}")
