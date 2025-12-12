const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
      // Odadaki client'ları bul ve host'a bildir
      const clients = [];
      room.forEach(socketId => {
        const otherSocket = io.sockets.sockets.get(socketId);
        if (otherSocket && !otherSocket.data.isHost && socketId !== socket.id) {
          clients.push(socketId);
        }
      });
      
      // Eğer client varsa, host'a bildir
      if (clients.length > 0) {
        socket.emit('existing-clients', {
          clients: clients
        });
      }
    }
    
    // Odadaki diğer kullanıcılara host'un hazır olduğunu bildir
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
    
    // Odadaki host'u bul
    let hostId = null;
    room.forEach(socketId => {
      const otherSocket = io.sockets.sockets.get(socketId);
      if (otherSocket && otherSocket.data.isHost && socketId !== socket.id) {
        hostId = socketId;
      }
    });
    
    // Odadaki diğer kullanıcılara bildir
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      roomSize: roomSize
    });
    
    // Yeni katılan kullanıcıya odadaki diğer kullanıcıları gönder
    if (roomSize > 1) {
      const otherUsers = Array.from(room).filter(id => id !== socket.id);
      socket.emit('existing-users', {
        users: otherUsers,
        roomSize: roomSize,
        hostId: hostId
      });
      
      // Eğer host varsa, host'a yeni client'ın bağlandığını bildir
      if (hostId) {
        io.to(hostId).emit('client-joined', {
          clientId: socket.id
        });
      }
    }
    
    // Odadaki kullanıcı sayısını gönder
    io.to(roomId).emit('room-size', roomSize);
  });

  // WebRTC offer gönderme
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      senderId: socket.id
    });
  });

  // WebRTC answer gönderme
  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      senderId: socket.id
    });
  });

  // ICE candidate gönderme
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      senderId: socket.id
    });
  });

  // Fare ve klavye kontrolü
  socket.on('mouse-move', (data) => {
    socket.to(data.roomId).emit('remote-mouse-move', data);
  });

  socket.on('mouse-click', (data) => {
    socket.to(data.roomId).emit('remote-mouse-click', data);
  });

  socket.on('key-press', (data) => {
    socket.to(data.roomId).emit('remote-key-press', data);
  });

  socket.on('scroll', (data) => {
    socket.to(data.roomId).emit('remote-scroll', data);
  });

  // Bağlantı kesilme
  socket.on('disconnect', () => {
    console.log(`❌ Bağlantı kesildi: ${socket.id}`);
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Remote Access Server çalışıyor:`);
  console.log(`   📍 http://localhost:${PORT}`);
  console.log(`   📍 http://192.168.1.44:${PORT}`);
  console.log(`   🌐 remote.bychome.xyz tunnel edilebilir`);
  console.log(`\n💡 Tarayıcıda açın ve bağlanmaya başlayın!`);
});

