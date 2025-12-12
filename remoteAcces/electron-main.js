const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');

// RobotJS'yi optional olarak yükle
let robot = null;
try {
  robot = require('robotjs');
  console.log('✅ RobotJS yüklendi');
} catch (error) {
  console.warn('⚠️ RobotJS yüklenemedi (fare/klavye kontrolü çalışmayacak):', error.message);
  console.warn('💡 Rebuild yapmayı deneyin: npm run rebuild');
}

const PORT = 4000;
let mainWindow;
let server;
let io;

// Express server başlat
function startServer() {
  const expressApp = express();
  server = http.createServer(expressApp);
  
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static(path.join(__dirname, 'public')));

  // WebRTC signaling için socket.io
  io.on('connection', (socket) => {
    console.log(`✅ Yeni bağlantı: ${socket.id}`);

    // Host olduğunu bildirme
    socket.on('i-am-host', (data) => {
      socket.data.isHost = true;
      socket.data.roomId = data.roomId;
      console.log(`👑 Host bildirildi: ${socket.id} (Oda: ${data.roomId})`);
      
      const room = io.sockets.adapter.rooms.get(data.roomId);
      if (room) {
        const clients = [];
        room.forEach(socketId => {
          const otherSocket = io.sockets.sockets.get(socketId);
          if (otherSocket && !otherSocket.data.isHost && socketId !== socket.id) {
            clients.push(socketId);
          }
        });
        
        if (clients.length > 0) {
          socket.emit('existing-clients', {
            clients: clients
          });
        }
      }
      
      socket.to(data.roomId).emit('host-ready', {
        hostId: socket.id
      });
    });

    // Oda oluşturma/katılma
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      console.log(`📦 Socket ${socket.id} odaya katıldı: ${roomId}`);
      
      const room = io.sockets.adapter.rooms.get(roomId);
      const roomSize = room ? room.size : 0;
      
      let hostId = null;
      room.forEach(socketId => {
        const otherSocket = io.sockets.sockets.get(socketId);
        if (otherSocket && otherSocket.data.isHost && socketId !== socket.id) {
          hostId = socketId;
        }
      });
      
      socket.to(roomId).emit('user-joined', {
        userId: socket.id,
        roomSize: roomSize
      });
      
      if (roomSize > 1) {
        const otherUsers = Array.from(room).filter(id => id !== socket.id);
        socket.emit('existing-users', {
          users: otherUsers,
          roomSize: roomSize,
          hostId: hostId
        });
        
        if (hostId) {
          io.to(hostId).emit('client-joined', {
            clientId: socket.id
          });
        }
      }
      
      io.to(roomId).emit('room-size', roomSize);
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
      socket.to(data.roomId).emit('offer', {
        offer: data.offer,
        senderId: socket.id
      });
    });

    socket.on('answer', (data) => {
      socket.to(data.roomId).emit('answer', {
        answer: data.answer,
        senderId: socket.id
      });
    });

    socket.on('ice-candidate', (data) => {
      socket.to(data.roomId).emit('ice-candidate', {
        candidate: data.candidate,
        senderId: socket.id
      });
    });

    // Fare ve klavye kontrolü - Desktop uygulamasında gerçek kontrol
    socket.on('mouse-move', (data) => {
      // Host'a gönder
      const hostSocket = Array.from(io.sockets.sockets.values()).find(s => 
        s.data.isHost && s.data.roomId === data.roomId
      );
      if (hostSocket) {
        hostSocket.emit('remote-mouse-move', data);
      }
    });

    socket.on('mouse-click', (data) => {
      const hostSocket = Array.from(io.sockets.sockets.values()).find(s => 
        s.data.isHost && s.data.roomId === data.roomId
      );
      if (hostSocket) {
        hostSocket.emit('remote-mouse-click', data);
      }
    });

    socket.on('key-press', (data) => {
      const hostSocket = Array.from(io.sockets.sockets.values()).find(s => 
        s.data.isHost && s.data.roomId === data.roomId
      );
      if (hostSocket) {
        hostSocket.emit('remote-key-press', data);
      }
    });

    socket.on('scroll', (data) => {
      const hostSocket = Array.from(io.sockets.sockets.values()).find(s => 
        s.data.isHost && s.data.roomId === data.roomId
      );
      if (hostSocket) {
        hostSocket.emit('remote-scroll', data);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Bağlantı kesildi: ${socket.id}`);
    });
  });

  expressApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Remote Access Server çalışıyor: http://localhost:${PORT}`);
    // Server başladıktan sonra pencereyi aç
    if (mainWindow === null) {
      createWindow();
    }
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    // Port kullanımda ise pencereyi yine de aç (mevcut server'a bağlan)
    if (error.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${PORT} zaten kullanımda, mevcut server'a bağlanılıyor...`);
      console.log(`💡 Başka bir server çalışıyorsa, onu durdurun veya bu uygulamayı kullanın.`);
      // Pencereyi yine de aç (mevcut server'a bağlanacak)
      if (mainWindow === null) {
        setTimeout(() => {
          createWindow();
        }, 500);
      }
    } else {
      // Diğer hatalar için de pencereyi aç
      if (mainWindow === null) {
        setTimeout(() => {
          createWindow();
        }, 500);
      }
    }
  });
}

// Electron window oluştur
function createWindow() {
  try {
    console.log('🪟 Pencere oluşturuluyor...');
    
    // Eğer pencere zaten varsa, önce kapat
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    mainWindow = new BrowserWindow({
      width: Math.min(1400, width),
      height: Math.min(900, height),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'electron-preload.js'),
        webSecurity: false,
        allowRunningInsecureContent: true
      },
      title: 'Remote Access - Uzaktan Erişim',
      show: true, // Hemen göster
      autoHideMenuBar: true
    });

    console.log('✅ BrowserWindow oluşturuldu');

    // URL yükleme
    const url = `http://localhost:${PORT}`;
    console.log(`📡 URL yükleniyor: ${url}`);
    
    // Biraz bekle (server'ın hazır olması için)
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(url).then(() => {
          console.log('✅ URL yüklendi');
        }).catch((error) => {
          console.error('❌ URL yükleme hatası:', error);
          // Hata durumunda birkaç saniye sonra tekrar dene
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              console.log('🔄 URL tekrar yükleniyor...');
              mainWindow.loadURL(url);
            }
          }, 2000);
        });
      }
    }, 1000);

    // Dev tools (geliştirme için)
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      console.log('❌ Pencere kapatıldı');
      mainWindow = null;
    });

    // Hata yakalama
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ Sayfa yükleme hatası:', errorCode, errorDescription, validatedURL);
      // Birkaç saniye sonra tekrar dene
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log('🔄 Sayfa tekrar yükleniyor...');
          mainWindow.loadURL(`http://localhost:${PORT}`);
        }
      }, 3000);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Sayfa yükleme tamamlandı');
    });

    console.log('✅ Pencere oluşturma tamamlandı');
  } catch (error) {
    console.error('❌ Pencere oluşturma hatası:', error);
    console.error(error.stack);
  }
}

// IPC handlers - Desktop kontrolü için
ipcMain.on('mouse-move', (event, data) => {
  if (!robot) {
    console.warn('⚠️ RobotJS yüklü değil, fare kontrolü çalışmıyor');
    return;
  }
  try {
    const screenSize = robot.getScreenSize();
    const x = Math.round((data.x / data.videoWidth) * screenSize.width);
    const y = Math.round((data.y / data.videoHeight) * screenSize.height);
    robot.moveMouse(x, y);
  } catch (error) {
    console.error('Mouse move error:', error);
  }
});

ipcMain.on('mouse-click', (event, data) => {
  if (!robot) {
    console.warn('⚠️ RobotJS yüklü değil, fare kontrolü çalışmıyor');
    return;
  }
  try {
    const screenSize = robot.getScreenSize();
    const x = Math.round((data.x / data.videoWidth) * screenSize.width);
    const y = Math.round((data.y / data.videoHeight) * screenSize.height);
    
    robot.moveMouse(x, y);
    
    if (data.type === 'mousedown') {
      if (data.button === 0) {
        robot.mouseToggle('down', 'left');
      } else if (data.button === 1) {
        robot.mouseToggle('down', 'middle');
      } else if (data.button === 2) {
        robot.mouseToggle('down', 'right');
      }
    } else if (data.type === 'mouseup') {
      if (data.button === 0) {
        robot.mouseToggle('up', 'left');
      } else if (data.button === 1) {
        robot.mouseToggle('up', 'middle');
      } else if (data.button === 2) {
        robot.mouseToggle('up', 'right');
      }
    } else if (data.type === 'dblclick') {
      robot.mouseClick('left', true);
    }
  } catch (error) {
    console.error('Mouse click error:', error);
  }
});

ipcMain.on('key-press', (event, data) => {
  if (!robot) {
    console.warn('⚠️ RobotJS yüklü değil, klavye kontrolü çalışmıyor');
    return;
  }
  try {
    if (data.type === 'keydown') {
      // Özel tuşlar
      if (data.ctrlKey) robot.keyToggle('control', 'down');
      if (data.shiftKey) robot.keyToggle('shift', 'down');
      if (data.altKey) robot.keyToggle('alt', 'down');
      if (data.metaKey) robot.keyToggle('command', 'down');
      
      // Ana tuş
      if (data.key.length === 1) {
        robot.typeString(data.key);
      } else {
        // Özel tuşlar (Enter, Backspace, vb.)
        const keyMap = {
          'Enter': 'enter',
          'Backspace': 'backspace',
          'Delete': 'delete',
          'Tab': 'tab',
          'Escape': 'escape',
          'ArrowUp': 'up',
          'ArrowDown': 'down',
          'ArrowLeft': 'left',
          'ArrowRight': 'right',
          'Space': 'space'
        };
        
        if (keyMap[data.key]) {
          robot.keyTap(keyMap[data.key]);
        }
      }
    } else if (data.type === 'keyup') {
      if (data.ctrlKey) robot.keyToggle('control', 'up');
      if (data.shiftKey) robot.keyToggle('shift', 'up');
      if (data.altKey) robot.keyToggle('alt', 'up');
      if (data.metaKey) robot.keyToggle('command', 'up');
    }
  } catch (error) {
    console.error('Key press error:', error);
  }
});

ipcMain.on('scroll', (event, data) => {
  if (!robot) {
    console.warn('⚠️ RobotJS yüklü değil, scroll kontrolü çalışmıyor');
    return;
  }
  try {
    robot.scrollMouse(data.deltaX || 0, data.deltaY || 0);
  } catch (error) {
    console.error('Scroll error:', error);
  }
});

// Desktop sources için IPC handler
ipcMain.handle('get-desktop-sources', async (event, options) => {
  try {
    console.log('🖥️ Main process: desktopCapturer.getSources çağrılıyor...', options);
    const sources = await desktopCapturer.getSources(options);
    console.log('✅ Main process: Desktop sources alındı:', sources.length);
    return sources;
  } catch (error) {
    console.error('❌ Main process: Desktop sources error:', error);
    throw error;
  }
});

// App lifecycle
app.whenReady().then(() => {
  console.log('🚀 Electron app hazır');
  try {
    startServer();
    // Server başladıktan sonra pencere açılacak (server.listen callback'inde)
    // Eğer 3 saniye içinde açılmazsa yine de aç
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        console.log('⏰ Timeout: Pencere açılıyor...');
        createWindow();
      }
    }, 3000);
  } catch (error) {
    console.error('❌ App başlatma hatası:', error);
    console.error(error.stack);
    // Hata olsa bile pencereyi aç
    setTimeout(() => {
      createWindow();
    }, 1000);
  }

  app.on('activate', () => {
    console.log('🔄 App activate');
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

