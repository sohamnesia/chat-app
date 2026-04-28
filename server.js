require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { mountAuthRoutes, verifyToken, accounts } = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Mount auth REST routes + static files
mountAuthRoutes(app);
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-memory chat state ────────────────────────────────────
const onlineUsers = {}; // socketId -> { email, name, color }
const messages = [];    // last 100 messages

function getOnlineList() {
  return Object.entries(onlineUsers).map(([id, u]) => ({
    id, email: u.email, name: u.name, color: u.color, avatar: u.avatar || ''
  }));
}

// ─── Socket.io ───────────────────────────────────────────────
io.on('connection', (socket) => {

  // Auth handshake — client sends JWT token
  socket.on('auth', (token) => {
    const payload = verifyToken(token);
    if (!payload) {
      socket.emit('auth_error', 'Invalid or expired session. Please log in again.');
      return;
    }

    const acc = accounts[payload.email];
    if (!acc || !acc.verified) {
      socket.emit('auth_error', 'Account not found or unverified.');
      return;
    }

    onlineUsers[socket.id] = {
      email: payload.email,
      name: acc.name,
      color: acc.color,
      avatar: acc.avatar || '',
      isAdmin: !!acc.isAdmin,
    };

    socket.emit('auth_ok', {
      email: payload.email,
      name: acc.name,
      color: acc.color,
      avatar: acc.avatar || '',
      isAdmin: !!acc.isAdmin,
    });
    socket.emit('history', messages.slice(-60));
    io.emit('online_users', getOnlineList());
    io.emit('system_message', { text: `${acc.name} joined the chat`, ts: Date.now() });

    console.log(`[+] ${acc.name} (${payload.email}) connected`);
  });

  // Chat message
  socket.on('message', (text) => {
    const user = onlineUsers[socket.id];
    if (!user || !text?.trim()) return;

    const msg = {
      id: Date.now() + Math.random(),
      socketId: socket.id,
      name: user.name,
      avatar: user.avatar || '',
      color: user.color,
      text: text.trim().slice(0, 1000),
      ts: Date.now(),
    };

    messages.push(msg);
    if (messages.length > 100) messages.shift();
    io.emit('message', msg);
  });

  // Typing indicator
  socket.on('typing', (isTyping) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    socket.broadcast.emit('typing', { socketId: socket.id, name: user.name, isTyping });
  });

  socket.on('profile_updated', ({ name, avatar }) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    if (typeof name === 'string' && name.trim()) user.name = name.trim().slice(0, 24);
    if (typeof avatar === 'string') user.avatar = avatar;
    io.emit('online_users', getOnlineList());
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user) {
      delete onlineUsers[socket.id];
      io.emit('online_users', getOnlineList());
      io.emit('system_message', { text: `${user.name} left the chat`, ts: Date.now() });
      console.log(`[-] ${user.name} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Chat server → http://localhost:${PORT}\n`);
});
