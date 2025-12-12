const socket = io();
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentRoomId = null;
let isHost = false;

// WebRTC yapılandırması
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Socket bağlantı durumu
socket.on('connect', () => {
    updateStatus('connected', 'Sunucuya bağlandı');
    console.log('✅ Socket bağlantısı kuruldu:', socket.id);
});

socket.on('disconnect', () => {
    updateStatus('disconnected', 'Sunucu bağlantısı kesildi');
    console.log('❌ Socket bağlantısı kesildi');
});

// Oda işlemleri
socket.on('user-joined', (data) => {
    console.log('👤 Yeni kullanıcı katıldı:', data.userId);
});

socket.on('client-joined', (data) => {
    console.log('👤 Yeni client bağlandı:', data.clientId);
    // Eğer host isek ve ekran paylaşımı yapıyorsak, offer gönder
    if (isHost && localStream) {
        // Peer connection yoksa oluştur
        if (!peerConnection) {
            createPeerConnection();
            // Track'leri ekle
            setTimeout(() => {
                if (localStream && peerConnection) {
                    localStream.getTracks().forEach(track => {
                        const existingSender = peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
                        if (!existingSender) {
                            peerConnection.addTrack(track, localStream);
                            console.log('✅ Track eklendi:', track.kind);
                        }
                    });
                }
            }, 100);
        }
        // Offer gönder
        setTimeout(() => {
            if (peerConnection && localStream) {
                console.log('📤 Client bağlandı, offer gönderiliyor...');
                createOffer();
            }
        }, 500);
    }
});

socket.on('existing-users', (data) => {
    console.log('👥 Odadaki mevcut kullanıcılar:', data.users);
    console.log('👑 Host ID:', data.hostId);
    // Eğer client isek ve host varsa, bekle (host offer gönderecek)
    if (!isHost) {
        if (data.hostId) {
            updateStatus('waiting', 'Host\'un ekran paylaşımını bekliyor...');
        } else {
            updateStatus('waiting', 'Host bekleniyor...');
        }
    }
});

socket.on('host-ready', (data) => {
    console.log('👑 Host hazır:', data.hostId);
    // Eğer client isek ve host hazırsa, bekle (host offer gönderecek)
    if (!isHost) {
        updateStatus('waiting', 'Host\'un ekran paylaşımını bekliyor...');
    }
});

socket.on('existing-clients', (data) => {
    console.log('👥 Mevcut client\'lar:', data.clients);
    // Eğer host isek ve ekran paylaşımı yapıyorsak, hemen offer gönder
    if (isHost && localStream && peerConnection) {
        setTimeout(() => {
            createOffer();
        }, 300);
    }
});

socket.on('room-size', (size) => {
    console.log(`📦 Odadaki kullanıcı sayısı: ${size}`);
});

// WebRTC signaling
socket.on('offer', async (data) => {
    console.log('📨 Offer alındı:', data.senderId);
    // Eğer aynı kullanıcıdan geliyorsa ignore et
    if (data.senderId === socket.id) return;
    
    // Eğer peer connection yoksa oluştur
    if (!peerConnection) {
        createPeerConnection();
    }
    
    // Answer gönder
    await createAnswer(data.offer);
});

socket.on('answer', async (data) => {
    console.log('📨 Answer alındı:', data.senderId);
    // Eğer aynı kullanıcıdan geliyorsa ignore et
    if (data.senderId === socket.id) return;
    
    if (peerConnection && peerConnection.signalingState !== 'stable') {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('✅ Answer set edildi');
        } catch (error) {
            console.error('❌ Answer set etme hatası:', error);
        }
    }
});

socket.on('ice-candidate', async (data) => {
    // Eğer aynı kullanıcıdan geliyorsa ignore et
    if (data.senderId === socket.id) return;
    
    console.log('🧊 ICE candidate alındı:', data.senderId);
    if (peerConnection && peerConnection.remoteDescription) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('❌ ICE candidate ekleme hatası:', error);
        }
    }
});

// Uzak kontrol sinyalleri
socket.on('remote-mouse-move', (data) => {
    if (isHost) {
        console.log('🖱️ Uzak fare hareketi:', data);
        // Electron uygulamasında gerçek fare kontrolü
        if (window.electronAPI && window.electronAPI.isElectron) {
            const video = document.getElementById('localVideo');
            if (video && video.videoWidth && video.videoHeight) {
                window.electronAPI.mouseMove({
                    x: data.x,
                    y: data.y,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });
            }
        }
    }
});

socket.on('remote-mouse-click', (data) => {
    if (isHost) {
        console.log('🖱️ Uzak fare tıklaması:', data);
        // Electron uygulamasında gerçek tıklama
        if (window.electronAPI && window.electronAPI.isElectron) {
            const video = document.getElementById('localVideo');
            if (video && video.videoWidth && video.videoHeight) {
                window.electronAPI.mouseClick({
                    x: data.x,
                    y: data.y,
                    button: data.button,
                    type: data.type,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });
            }
        }
    }
});

socket.on('remote-key-press', (data) => {
    if (isHost) {
        console.log('⌨️ Uzak tuş basımı:', data);
        // Electron uygulamasında gerçek tuş basımı
        if (window.electronAPI && window.electronAPI.isElectron) {
            window.electronAPI.keyPress(data);
        }
    }
});

socket.on('remote-scroll', (data) => {
    if (isHost) {
        console.log('📜 Uzak scroll:', data);
        // Electron uygulamasında gerçek scroll
        if (window.electronAPI && window.electronAPI.isElectron) {
            window.electronAPI.scroll(data);
        }
    }
});

// Ekran paylaşımı başlat
async function startSharing() {
    try {
        let stream;
        
        // Electron'da desktopCapturer kullan
        if (window.electronAPI && window.electronAPI.isElectron) {
            console.log('🖥️ Electron: desktopCapturer kullanılıyor...');
            
            // Ekran kaynaklarını al
            const sources = await window.electronAPI.getDesktopSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 150, height: 150 }
            });
            
            // Kullanıcıya ekran seçtir (basit bir dialog)
            if (sources.length === 0) {
                throw new Error('Ekran kaynağı bulunamadı');
            }
            
            // İlk ekranı seç (veya kullanıcı seçim yapabilir)
            const selectedSource = sources[0]; // İlk ekranı seç
            
            // getUserMedia ile desktopCapturer stream'i al
            // Electron'da constraints formatı farklı
            const constraints = {
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSource.id
                    }
                }
            };
            
            // Eski API formatı (Electron için)
            if (navigator.mediaDevices.getUserMedia) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (err) {
                    // Eğer getUserMedia çalışmazsa, eski API'yi dene
                    console.log('getUserMedia başarısız, eski API deneniyor...');
                    stream = await navigator.getUserMedia(constraints);
                }
            } else {
                // Eski API
                stream = await new Promise((resolve, reject) => {
                    navigator.getUserMedia(constraints, resolve, reject);
                });
            }
        } else {
            // Web tarayıcısında getDisplayMedia kullan
            const displayMediaOptions = {
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false,
                preferCurrentTab: false
            };
            stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        }

        localStream = stream;
        document.getElementById('localVideo').srcObject = localStream;
        
        updateStatus('connected', 'Ekran paylaşımı aktif - Host modu');
        document.getElementById('shareBtn').disabled = true;
        document.getElementById('connectBtn').disabled = false;
        
        // Host olarak işaretle
        isHost = true;
        
        // Eğer zaten bir odaya bağlıysak, peer connection oluştur ve track ekle
        if (currentRoomId) {
            if (!peerConnection) {
                createPeerConnection();
            }
            // Track'leri ekle
            if (peerConnection) {
                localStream.getTracks().forEach(track => {
                    // Eğer track zaten ekli değilse ekle
                    const existingSender = peerConnection.getSenders().find(s => s.track && s.track.kind === track.kind);
                    if (!existingSender) {
                        peerConnection.addTrack(track, localStream);
                        console.log('✅ Track eklendi:', track.kind);
                    } else {
                        existingSender.replaceTrack(track);
                        console.log('✅ Track değiştirildi:', track.kind);
                    }
                });
            }
        }
        
        // Ekran paylaşımı durduğunda
        localStream.getVideoTracks()[0].onended = () => {
            stopSharing();
        };

        console.log('✅ Ekran paylaşımı başlatıldı');
    } catch (error) {
        console.error('❌ Ekran paylaşımı hatası:', error);
        alert('Ekran paylaşımı başlatılamadı: ' + error.message);
    }
}

// Odaya bağlan
function connectToRoom() {
    let roomId = document.getElementById('roomId').value.trim();
    
    if (!roomId) {
        roomId = generateRandomRoomId();
        document.getElementById('roomId').value = roomId;
    }

    currentRoomId = roomId;
    
    // Eğer ekran paylaşımı yapıyorsak, host oluruz
    if (localStream) {
        createPeerConnection();
        isHost = true;
        updateStatus('connected', 'Host modu - Bağlantı bekleniyor');
        
        // Server'a host olduğumuzu bildir
        socket.emit('i-am-host', { roomId: roomId });
    } else {
        // Ekran paylaşımı yapmıyorsak, client oluruz
        isHost = false;
        createPeerConnection(); // Client olarak da peer connection oluştur (remote stream almak için)
        updateStatus('waiting', 'Host\'un ekran paylaşımını bekliyor...');
    }
    
    socket.emit('join-room', roomId);

    document.getElementById('connectBtn').disabled = true;
    document.getElementById('disconnectBtn').disabled = false;
    
    console.log(`🔗 Odaya katıldı: ${roomId}, Host: ${isHost}`);
}

// Peer connection oluştur
function createPeerConnection() {
    // Eğer zaten bir peer connection varsa, önce kapat
    if (peerConnection) {
        peerConnection.close();
    }
    
    peerConnection = new RTCPeerConnection(rtcConfiguration);

    // Local stream'i ekle (sadece host için)
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Remote stream'i al (hem host hem client için)
    peerConnection.ontrack = (event) => {
        console.log('📹 Remote stream alındı');
        remoteStream = event.streams[0];
        document.getElementById('remoteVideo').srcObject = remoteStream;
        
        if (isHost) {
            updateStatus('connected', 'Bağlantı kuruldu! Client bağlandı.');
        } else {
            updateStatus('connected', 'Bağlantı kuruldu! Host\'un ekranı görünüyor.');
        }
    };

    // ICE candidate
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && currentRoomId) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                roomId: currentRoomId
            });
        }
    };

    // Bağlantı durumu
    peerConnection.onconnectionstatechange = () => {
        console.log('🔌 Bağlantı durumu:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            if (isHost) {
                updateStatus('connected', 'Bağlantı kuruldu! Client bağlandı.');
            } else {
                updateStatus('connected', 'Bağlantı kuruldu! Host\'un ekranı görünüyor.');
            }
        } else if (peerConnection.connectionState === 'disconnected' || 
                   peerConnection.connectionState === 'failed') {
            if (isHost) {
                updateStatus('connected', 'Host modu - Bağlantı bekleniyor');
            } else {
                updateStatus('waiting', 'Host\'un ekran paylaşımını bekliyor...');
            }
        }
    };
    
    // ICE connection durumu
    peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE bağlantı durumu:', peerConnection.iceConnectionState);
    };
}

// Offer oluştur
async function createOffer() {
    if (!peerConnection) {
        createPeerConnection();
    }

    try {
        // Eğer zaten bir offer varsa, bekle
        if (peerConnection.signalingState !== 'stable') {
            console.log('⏳ Signaling state stable değil, bekleniyor...');
            return;
        }

        const offer = await peerConnection.createOffer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: false
        });
        
        await peerConnection.setLocalDescription(offer);

        socket.emit('offer', {
            offer: offer,
            roomId: currentRoomId
        });

        console.log('📤 Offer gönderildi');
    } catch (error) {
        console.error('❌ Offer oluşturma hatası:', error);
    }
}

// Answer oluştur
async function createAnswer(offer) {
    if (!peerConnection) {
        createPeerConnection();
    }

    try {
        // Eğer zaten bir remote description varsa, ignore et
        if (peerConnection.remoteDescription) {
            console.log('⚠️ Zaten bir remote description var, ignore ediliyor');
            return;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: false
        });
        await peerConnection.setLocalDescription(answer);

        socket.emit('answer', {
            answer: answer,
            roomId: currentRoomId
        });

        console.log('📤 Answer gönderildi');
    } catch (error) {
        console.error('❌ Answer oluşturma hatası:', error);
    }
}

// Bağlantıyı kes
function disconnect() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    document.getElementById('localVideo').srcObject = null;
    document.getElementById('remoteVideo').srcObject = null;

    document.getElementById('shareBtn').disabled = false;
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;

    currentRoomId = null;
    isHost = false;

    updateStatus('disconnected', 'Bağlantı kesildi');
    console.log('❌ Bağlantı kesildi');
}

// Ekran paylaşımını durdur
function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    document.getElementById('localVideo').srcObject = null;
    document.getElementById('shareBtn').disabled = false;
    updateStatus('disconnected', 'Ekran paylaşımı durduruldu');
}

// Rastgele oda ID oluştur
function generateRandomRoomId() {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
}

function generateRoomId() {
    document.getElementById('roomId').value = generateRandomRoomId();
}

// Durum güncelle
function updateStatus(type, message) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
}

// Uzak kontrol değişkenleri
let isControlling = false;
let remoteVideoElement = document.getElementById('remoteVideo');

// Tam ekran toggle
function toggleFullscreen() {
    const remoteVideoBox = document.getElementById('remoteVideoBox');
    const videoContainer = document.getElementById('videoContainer');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    if (!remoteVideoBox.classList.contains('fullscreen')) {
        remoteVideoBox.classList.add('fullscreen');
        videoContainer.classList.add('fullscreen-remote');
        fullscreenBtn.textContent = '⛶ Çıkış';
        
        // Fullscreen API kullan
        if (remoteVideoBox.requestFullscreen) {
            remoteVideoBox.requestFullscreen();
        }
    } else {
        remoteVideoBox.classList.remove('fullscreen');
        videoContainer.classList.remove('fullscreen-remote');
        fullscreenBtn.textContent = '⛶ Tam Ekran';
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Kontrol modu toggle
function toggleControl() {
    isControlling = !isControlling;
    const controlBtn = document.getElementById('controlBtn');
    const controlMode = document.getElementById('controlMode');
    
    if (isControlling) {
        remoteVideoElement.classList.add('controlling');
        controlBtn.textContent = '🖱️ Kontrolü Durdur';
        controlMode.checked = true;
    } else {
        remoteVideoElement.classList.remove('controlling');
        controlBtn.textContent = '🖱️ Kontrol Et';
        controlMode.checked = false;
    }
}

function toggleControlMode() {
    const controlMode = document.getElementById('controlMode');
    isControlling = controlMode.checked;
    const controlBtn = document.getElementById('controlBtn');
    
    if (isControlling) {
        remoteVideoElement.classList.add('controlling');
        controlBtn.textContent = '🖱️ Kontrolü Durdur';
    } else {
        remoteVideoElement.classList.remove('controlling');
        controlBtn.textContent = '🖱️ Kontrol Et';
    }
}

// Uzak ekranda fare ve klavye kontrolü
remoteVideoElement.addEventListener('mousemove', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        const rect = e.target.getBoundingClientRect();
        const video = e.target;
        if (video.videoWidth && video.videoHeight) {
            const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth;
            const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight;
            
            socket.emit('mouse-move', {
                roomId: currentRoomId,
                x: Math.round(x),
                y: Math.round(y),
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
        }
    }
});

remoteVideoElement.addEventListener('mousedown', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        const video = e.target;
        if (video.videoWidth && video.videoHeight) {
            const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth;
            const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight;
            
            socket.emit('mouse-click', {
                roomId: currentRoomId,
                button: e.button, // 0: sol, 1: orta, 2: sağ
                x: Math.round(x),
                y: Math.round(y),
                type: 'mousedown',
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
        }
    }
});

remoteVideoElement.addEventListener('mouseup', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        const video = e.target;
        if (video.videoWidth && video.videoHeight) {
            const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth;
            const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight;
            
            socket.emit('mouse-click', {
                roomId: currentRoomId,
                button: e.button,
                x: Math.round(x),
                y: Math.round(y),
                type: 'mouseup',
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
        }
    }
});

remoteVideoElement.addEventListener('wheel', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        e.preventDefault();
        socket.emit('scroll', {
            roomId: currentRoomId,
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaZ: e.deltaZ
        });
    }
});

// Klavye kontrolü
document.addEventListener('keydown', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        // Eğer input alanında değilsek
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            socket.emit('key-press', {
                roomId: currentRoomId,
                key: e.key,
                code: e.code,
                keyCode: e.keyCode,
                type: 'keydown',
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
            });
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            socket.emit('key-press', {
                roomId: currentRoomId,
                key: e.key,
                code: e.code,
                keyCode: e.keyCode,
                type: 'keyup',
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
            });
        }
    }
});

// Double click
remoteVideoElement.addEventListener('dblclick', (e) => {
    if (currentRoomId && !isHost && remoteStream && isControlling) {
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        const video = e.target;
        if (video.videoWidth && video.videoHeight) {
            const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth;
            const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight;
            
            socket.emit('mouse-click', {
                roomId: currentRoomId,
                button: 0,
                x: Math.round(x),
                y: Math.round(y),
                type: 'dblclick',
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
        }
    }
});

