const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const rooms = new Map();
app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'TEN NIGHTS IN A HOTEL' }));
function cleanRoom(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); }
io.on('connection', socket => {
  socket.on('room:create', (callback) => {
    let code;
    do { code = Math.random().toString(36).slice(2, 7).toUpperCase(); } while (rooms.has(code));
    rooms.set(code, { players: new Map() });
    joinRoom(socket, code, callback);
  });
  socket.on('room:join', (raw, callback) => {
    const code = cleanRoom(raw);
    const room = rooms.get(code);
    if (!room) return typeof callback === 'function' && callback({ ok: false, error: 'Комната не найдена. Проверь код.' });
    if (room.players.size >= 2) return typeof callback === 'function' && callback({ ok: false, error: 'В комнате уже 2 игрока.' });
    joinRoom(socket, code, callback);
  });
  socket.on('player:state', data => {
    const code = socket.data.room;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    const state = { camera: Math.max(1, Math.min(8, Number(data && data.camera) || 1)), tabletOpen: !!(data && data.tabletOpen), updatedAt: Date.now() };
    room.players.set(socket.id, state);
    socket.to(code).emit('player:state', state);
  });
  socket.on('disconnect', () => leaveRoom(socket));
});
function joinRoom(socket, code, callback) {
  const room = rooms.get(code);
  if (!room || room.players.size >= 2) return typeof callback === 'function' && callback({ ok: false, error: 'Не удалось войти в комнату.' });
  socket.join(code); socket.data.room = code;
  room.players.set(socket.id, { camera: 1, tabletOpen: false, updatedAt: Date.now() });
  socket.emit('room:joined', { code, players: room.players.size });
  socket.to(code).emit('room:peer', { connected: true });
  if (typeof callback === 'function') callback({ ok: true, code, players: room.players.size });
}
function leaveRoom(socket) {
  const code = socket.data.room; if (!code || !rooms.has(code)) return;
  const room = rooms.get(code); room.players.delete(socket.id); socket.to(code).emit('room:peer', { connected: false });
  if (room.players.size === 0) rooms.delete(code); socket.data.room = null;
}
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log(`TEN NIGHTS server listening on ${port}`));
