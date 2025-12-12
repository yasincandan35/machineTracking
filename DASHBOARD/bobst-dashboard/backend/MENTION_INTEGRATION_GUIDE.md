# @ Mention Özelliği - Mevcut Backend'e Entegrasyon Rehberi

## 📋 Durum

✅ **Frontend**: Tamamen hazır, @ mention çalışıyor  
⚠️ **Backend**: Sadece 2 küçük ekleme gerekiyor

Zaten çalışan backend'iniz var (`http://192.168.1.237:5199`), yeni backend GEREKMEZ!

## 🎯 Mevcut Backend'inize Yapılacak Değişiklikler

### 1. E-posta Servisi Ekleyin

**Dosya**: `email_service.py` (zaten oluşturuldu ✅)

Bu dosyayı mevcut backend projenize kopyalayın. Değişiklik GEREKMEZ.

### 2. Mevcut API Endpoint'lerinizi Güncelleyin

#### A. `/api/feedback` POST endpoint'ini güncelleyin:

**MEVCUT KOD (muhtemelen şöyle bir şey):**
```python
@app.route('/api/feedback', methods=['POST'])
def create_feedback():
    data = request.get_json()
    content = data.get('content')
    user_id = data.get('userId')
    user_name = data.get('userName')
    
    # Veritabanına kaydet...
    
    return jsonify(new_feedback)
```

**YENİ KOD (sadece eklemeler):**
```python
from email_service import email_service  # ← EKLE (dosyanın başına)
import re  # ← EKLE (dosyanın başına)

@app.route('/api/feedback', methods=['POST'])
def create_feedback():
    data = request.get_json()
    content = data.get('content')
    user_id = data.get('userId')
    user_name = data.get('userName')
    mentions = data.get('mentions', [])  # ← EKLE
    
    # Veritabanına kaydet... (mevcut kodunuz)
    
    # ↓↓↓ SADECE BURAYI EKLE ↓↓↓
    # Mention edilen kullanıcılara email gönder
    if mentions:
        for username in mentions:
            user = get_user_by_username(username)  # Mevcut fonksiyonunuzu kullanın
            if user and user.get('email'):
                email_service.send_mention_in_feedback(
                    to_email=user['email'],
                    username=user['username'],
                    mentioned_by=user_name,
                    feedback_content=content,
                    feedback_id=new_feedback['id']
                )
    # ↑↑↑ SADECE BURAYI EKLE ↑↑↑
    
    return jsonify(new_feedback)
```

#### B. `/api/comments` POST endpoint'ini güncelleyin:

**MEVCUT KOD:**
```python
@app.route('/api/comments', methods=['POST'])
def create_comment():
    data = request.get_json()
    feedback_id = data.get('feedbackId')
    content = data.get('content')
    user_id = data.get('userId')
    user_name = data.get('userName')
    
    # Veritabanına kaydet...
    
    return jsonify(new_comment)
```

**YENİ KOD:**
```python
@app.route('/api/comments', methods=['POST'])
def create_comment():
    data = request.get_json()
    feedback_id = data.get('feedbackId')
    content = data.get('content')
    user_id = data.get('userId')
    user_name = data.get('userName')
    mentions = data.get('mentions', [])  # ← EKLE
    
    # Veritabanına kaydet... (mevcut kodunuz)
    
    # ↓↓↓ SADECE BURAYI EKLE ↓↓↓
    # Feedback sahibine bildirim gönder
    feedback = get_feedback_by_id(feedback_id)  # Mevcut fonksiyonunuzu kullanın
    if feedback and feedback['userId'] != user_id:
        feedback_owner = get_user_by_id(feedback['userId'])
        if feedback_owner and feedback_owner.get('email'):
            email_service.send_feedback_reply_notification(
                to_email=feedback_owner['email'],
                username=feedback_owner['username'],
                replier=user_name,
                comment_content=content,
                original_feedback=feedback['content'],
                feedback_id=feedback_id
            )
    
    # Mention edilen kullanıcılara email gönder
    if mentions:
        for username in mentions:
            user = get_user_by_username(username)
            if user and user.get('email'):
                email_service.send_mention_in_comment(
                    to_email=user['email'],
                    username=user['username'],
                    mentioned_by=user_name,
                    comment_content=content,
                    feedback_id=feedback_id
                )
    # ↑↑↑ SADECE BURAYI EKLE ↑↑↑
    
    return jsonify(new_comment)
```

#### C. `/api/users` endpoint'i zaten var mı kontrol edin:

Frontend'den `/api/users` endpoint'ine istek gidiyor. Eğer bu endpoint yoksa ekleyin:

```python
@app.route('/api/users', methods=['GET'])
def get_users():
    """Mention için kullanıcı listesi"""
    # Tüm kullanıcıları veritabanından çek
    users = get_all_users()  # Mevcut fonksiyonunuzu kullanın
    
    # Sadece gerekli alanları döndür
    return jsonify([{
        'id': user['id'],
        'username': user['username'],
        'email': user.get('email'),
        'fullName': user.get('fullName')
    } for user in users])
```

## 🔧 Gmail Kurulumu

### 1. App Password Oluşturun:
1. https://myaccount.google.com/ → Güvenlik
2. 2 Adımlı Doğrulama'yı aktif edin
3. Uygulama şifreleri → E-posta seçin
4. Şifreyi kopyalayın

### 2. Ortam Değişkeni (Windows PowerShell - Admin):
```powershell
[System.Environment]::SetEnvironmentVariable('EMAIL_PASSWORD', 'sizin-app-password', 'User')
```

### 3. Email Ayarları

`email_service.py` dosyasında ayarları kontrol edin:
```python
self.sender_email = "yasin.egemambalaj@gmail.com"  # Gönderen email
```

## 📝 Özet

**Frontend**: ✅ Tamamen hazır
- MentionInput komponenti çalışıyor
- @ ile kullanıcı önerileri geliyor
- Mentions backend'e gönderiliyor

**Backend**: ⚠️ Sadece 3 ekleme:
1. `email_service.py` dosyasını import edin
2. `/api/feedback` POST'a mention handling ekleyin (5-10 satır)
3. `/api/comments` POST'a mention handling ekleyin (10-15 satır)
4. `/api/users` endpoint'i varsa kontrol, yoksa ekleyin

**Toplam ekleme**: ~30-40 satır kod!

## 🎬 Nasıl Çalışacak?

1. Kullanıcı `@admin` yazar → Frontend mention listesi gösterir
2. Kullanıcı göndere basar → Frontend `mentions: ["admin"]` parametresi gönderir
3. Backend feedback/comment'i kaydeder
4. Backend mention edilen kullanıcıyı bulur
5. Email gönderilir ✉️

## ❓ Sorular

**S: Yeni backend kurmam gerekiyor mu?**  
C: HAYIR! Mevcut backend'inize sadece yukarıdaki kodları ekleyin.

**S: Veritabanında değişiklik gerekli mi?**  
C: HAYIR! Tablolar zaten var (Users, Feedback, Comments).

**S: Frontend'de başka değişiklik var mı?**  
C: HAYIR! Frontend tamamen hazır.

**S: Mevcut backend kodum nerede?**  
C: `192.168.1.237:5199` adresinde çalışıyor. Kaynak kodunu bana gösterirseniz, tam olarak nerelere ekleme yapacağınızı gösterebilirim.

---

**© 2025 EGEM Makine Takip Sistemi**

