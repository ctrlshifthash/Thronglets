// ─────────────────────────────────────────────────────────────────────
// Emergence presence server: counts how many observers are watching
// each town, nothing more. Stateless; the simulation never touches it.
// ─────────────────────────────────────────────────────────────────────
import { Server } from 'socket.io';

const PORT = Number(process.env.REALTIME_PORT || 3001);

const io = new Server(PORT, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

function broadcastPresence(room) {
  const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
  // Each client subtracts itself; send total minus one as "others".
  for (const sid of io.sockets.adapter.rooms.get(room) ?? []) {
    io.sockets.sockets.get(sid)?.emit('presence', { count: size - 1 });
  }
}

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    const room = String(data?.room ?? '').slice(0, 64);
    if (!room.startsWith('town:')) return;
    if (socket.data.room) {
      socket.leave(socket.data.room);
      broadcastPresence(socket.data.room);
    }
    socket.data.room = room;
    socket.join(room);
    const size = io.sockets.adapter.rooms.get(room)?.size ?? 1;
    socket.emit('roster', { count: size - 1 });
    broadcastPresence(room);
  });

  socket.on('disconnect', () => {
    if (socket.data.room) broadcastPresence(socket.data.room);
  });
});

console.log(`[realtime] Emergence presence server listening on :${PORT}`);
