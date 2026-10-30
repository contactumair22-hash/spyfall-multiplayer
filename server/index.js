import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { Server } from 'socket.io';
import crypto from 'node:crypto';

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin }));
app.use(express.json({ limit: '32kb' }));

const io = new Server(server, {
  cors: { origin: allowedOrigin === '*' ? true : allowedOrigin, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = Number(process.env.PORT || 3001);
const rooms = new Map();
const LOCATIONS = [
  { name: 'Airport', roles: ['Pilot', 'Passenger', 'Security Officer', 'Flight Attendant', 'Ground Crew'] },
  { name: 'Hospital', roles: ['Doctor', 'Nurse', 'Patient', 'Surgeon', 'Receptionist'] },
  { name: 'School', roles: ['Teacher', 'Student', 'Principal', 'Coach', 'Librarian'] },
  { name: 'Beach', roles: ['Lifeguard', 'Tourist', 'Surfer', 'Vendor', 'Photographer'] },
  { name: 'Movie Theater', roles: ['Actor', 'Director', 'Usher', 'Moviegoer', 'Projectionist'] },
  { name: 'Space Station', roles: ['Commander', 'Engineer', 'Scientist', 'Pilot', 'Medic'] },
  { name: 'Restaurant', roles: ['Chef', 'Waiter', 'Customer', 'Food Critic', 'Manager'] },
  { name: 'Police Station', roles: ['Detective', 'Officer', 'Chief', 'Witness', 'Clerk'] },
  { name: 'Museum', roles: ['Curator', 'Guard', 'Tourist', 'Artist', 'Historian'] },
  { name: 'Train Station', roles: ['Conductor', 'Commuter', 'Ticket Inspector', 'Vendor', 'Engineer'] },
  { name: 'Wedding', roles: ['Bride', 'Groom', 'Photographer', 'Guest', 'Wedding Planner'] },
  { name: 'Supermarket', roles: ['Cashier', 'Shopper', 'Manager', 'Stock Clerk', 'Security Guard'] },
  { name: 'Casino', roles: ['Dealer', 'Player', 'Pit Boss', 'Magician', 'Security Guard'] },
  { name: 'Cruise Ship', roles: ['Captain', 'Chef', 'Tourist', 'Entertainer', 'Crew Member'] },
  { name: 'Farm', roles: ['Farmer', 'Veterinarian', 'Visitor', 'Tractor Driver', 'Ranch Hand'] },
  { name: 'Bank', roles: ['Teller', 'Customer', 'Manager', 'Security Guard', 'Auditor'] },
  { name: 'Library', roles: ['Librarian', 'Student', 'Author', 'Researcher', 'Archivist'] },
  { name: 'Stadium', roles: ['Athlete', 'Coach', 'Referee', 'Fan', 'Commentator'] },
  { name: 'Hotel', roles: ['Concierge', 'Guest', 'Housekeeper', 'Manager', 'Chef'] },
  { name: 'Submarine', roles: ['Captain', 'Navigator', 'Engineer', 'Sonar Operator', 'Medic'] }
];

const cleanName = value => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 18);
const makeCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(crypto.randomBytes(6), b => alphabet[b % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
};
const publicRoom = room => ({
  code: room.code,
  hostId: room.hostId,
  status: room.status,
  round: room.round,
  maxPlayers: room.maxPlayers,
  players: [...room.players.values()].map(p => ({
    id: p.id, name: p.name, connected: p.connected, isHost: p.id === room.hostId,
    score: p.score, ready: p.ready
  })),
  locationName: room.status === 'playing' || room.status === 'results' ? room.location?.name : null,
  deadline: room.deadline,
  votes: room.status === 'voting' ? room.votes.size : 0,
  votedCount: room.status === 'voting' ? room.votes.size : 0,
  totalPlayers: room.players.size,
  winner: room.winner || null,
  message: room.message || ''
});
function broadcastRoom(room) { io.to(room.code).emit('room:update', publicRoom(room)); }
function sendPrivateRoles(room) {
  for (const p of room.players.values()) {
    io.to(p.id).emit('game:role', p.id === room.spyId
      ? { isSpy: true, location: null, role: 'THE SPY' }
      : { isSpy: false, location: room.location.name, role: p.role });
  }
}
function stopTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
}
function startQuestionTimer(room) {
  stopTimer(room);
  room.deadline = Date.now() + 5 * 60 * 1000;
  room.timer = setTimeout(() => {
    if (room.status === 'playing') {
      room.status = 'voting';
      room.message = 'Time is up. Vote for who you think is the spy.';
      broadcastRoom(room);
    }
  }, 5 * 60 * 1000);
}
function resetRound(room) {
  stopTimer(room);
  room.status = 'lobby';
  room.location = null;
  room.spyId = null;
  room.votes = new Map();
  room.winner = null;
  room.deadline = null;
  room.message = 'Ready for another round? The host can start when everyone is ready.';
  for (const p of room.players.values()) p.ready = false;
}
function startRound(room, socket) {
  if (socket.id !== room.hostId) return socket.emit('game:error', 'Only the host can start a round.');
  const active = [...room.players.values()].filter(p => p.connected);
  if (active.length < 3) return socket.emit('game:error', 'At least 3 players are needed to start.');
  if (room.status === 'playing' || room.status === 'voting') return socket.emit('game:error', 'A round is already in progress.');
  room.round += 1;
  room.location = LOCATIONS[crypto.randomInt(LOCATIONS.length)];
  room.spyId = active[crypto.randomInt(active.length)].id;
  const rolePool = [...room.location.roles];
  for (const p of active) {
    p.role = p.id === room.spyId ? null : rolePool.splice(crypto.randomInt(rolePool.length), 1)[0] || 'Visitor';
  }
  room.votes = new Map();
  room.winner = null;
  room.status = 'playing';
  room.message = 'Ask questions, answer carefully, and find the spy. You have 5 minutes.';
  startQuestionTimer(room);
  sendPrivateRoles(room);
  broadcastRoom(room);
}
function resolveVotes(room) {
  const counts = new Map();
  for (const target of room.votes.values()) counts.set(target, (counts.get(target) || 0) + 1);
  let accused = null, max = 0, tie = false;
  for (const [id, count] of counts) {
    if (count > max) { accused = id; max = count; tie = false; }
    else if (count === max) tie = true;
  }
  const spyCaught = !tie && accused === room.spyId;
  room.status = 'results';
  room.winner = spyCaught ? 'players' : 'spy';
  room.message = tie ? 'The vote ended in a tie. The spy escapes!' :
    spyCaught ? `${room.players.get(accused)?.name || 'The accused player'} was the spy! The group wins.` :
    `${room.players.get(accused)?.name || 'No one'} was accused. The spy wins!`;
  if (spyCaught) {
    for (const p of room.players.values()) if (p.id !== room.spyId) p.score += 1;
  } else {
    const spy = room.players.get(room.spyId);
    if (spy) spy.score += 2;
  }
  stopTimer(room);
  room.deadline = null;
  io.to(room.code).emit('game:reveal', {
    spyName: room.players.get(room.spyId)?.name || 'Unknown',
    location: room.location?.name || 'Unknown',
    accusedName: accused ? room.players.get(accused)?.name || 'Unknown' : null,
    tie
  });
  broadcastRoom(room);
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'spyfall-server', rooms: rooms.size }));
app.get('/api/locations/count', (_req, res) => res.json({ count: LOCATIONS.length }));

io.on('connection', socket => {
  socket.on('room:create', ({ name }, ack = () => {}) => {
    const playerName = cleanName(name);
    if (!playerName) return ack({ error: 'Enter a display name first.' });
    const code = makeCode();
    const player = { id: socket.id, name: playerName, connected: true, score: 0, ready: false, role: null };
    const room = { code, hostId: socket.id, status: 'lobby', round: 0, maxPlayers: 12,
      players: new Map([[socket.id, player]]), location: null, spyId: null,
      votes: new Map(), deadline: null, timer: null, winner: null, message: 'Invite friends with the room code.' };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    ack({ ok: true, room: publicRoom(room), playerId: socket.id });
    broadcastRoom(room);
  });

  socket.on('room:join', ({ code, name }, ack = () => {}) => {
    const roomCode = String(code ?? '').trim().toUpperCase();
    const playerName = cleanName(name);
    const room = rooms.get(roomCode);
    if (!playerName) return ack({ error: 'Enter a display name first.' });
    if (!room) return ack({ error: 'Room not found. Check the code and try again.' });
    if (room.players.size >= room.maxPlayers) return ack({ error: 'This room is full (12 players maximum).' });
    if (room.status !== 'lobby') return ack({ error: 'This round has already started. Join after it finishes.' });
    if ([...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase()))
      return ack({ error: 'That name is already in this room. Try another one.' });
    const player = { id: socket.id, name: playerName, connected: true, score: 0, ready: false, role: null };
    room.players.set(socket.id, player);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    ack({ ok: true, room: publicRoom(room), playerId: socket.id });
    broadcastRoom(room);
  });

  socket.on('room:rejoin', ({ code, playerId }, ack = () => {}) => {
    const room = rooms.get(String(code ?? '').toUpperCase());
    if (!room || !room.players.has(playerId)) return ack({ error: 'Your previous session could not be restored. Rejoin as a new player.' });
    const old = room.players.get(playerId);
    if (old.connected) return ack({ error: 'That player session is already connected.' });
    // Socket ids are identity keys; reconnect restores the original player under the new socket id.
    room.players.delete(playerId);
    old.id = socket.id; old.connected = true;
    room.players.set(socket.id, old);
    if (room.hostId === playerId) room.hostId = socket.id;
    if (room.spyId === playerId) room.spyId = socket.id;
    if (room.votes.has(playerId)) { const vote = room.votes.get(playerId); room.votes.delete(playerId); room.votes.set(socket.id, vote); }
    for (const [voter, target] of room.votes) if (target === playerId) room.votes.set(voter, socket.id);
    socket.join(room.code); socket.data.roomCode = room.code;
    ack({ ok: true, room: publicRoom(room), playerId: socket.id });
    if (room.status === 'playing') {
      const p = room.players.get(socket.id);
      socket.emit('game:role', p.id === room.spyId ? { isSpy: true, location: null, role: 'THE SPY' } : { isSpy: false, location: room.location?.name, role: p.role });
    }
    broadcastRoom(room);
  });

  socket.on('player:ready', ({ ready }, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.status !== 'lobby') return ack({ error: 'Ready status can only change in the lobby.' });
    player.ready = Boolean(ready); broadcastRoom(room); ack({ ok: true });
  });

  socket.on('game:start', (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack({ error: 'Room not found.' });
    if (socket.id !== room.hostId) return ack({ error: 'Only the host can start a round.' });
    if ([...room.players.values()].filter(p => p.connected).length < 3) return ack({ error: 'At least 3 players are needed to start.' });
    startRound(room, socket); ack({ ok: true });
  });

  socket.on('game:begin-vote', (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== 'playing') return ack({ error: 'Voting is not available right now.' });
    room.status = 'voting'; room.message = 'Choose the player you believe is the spy.';
    stopTimer(room); room.deadline = null; broadcastRoom(room); ack({ ok: true });
  });

  socket.on('game:vote', ({ targetId }, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== 'voting') return ack({ error: 'Voting is not open.' });
    if (!room.players.has(socket.id)) return ack({ error: 'You are not in this room.' });
    if (!room.players.has(targetId) || targetId === socket.id) return ack({ error: 'Choose another player.' });
    room.votes.set(socket.id, targetId);
    broadcastRoom(room);
    const connected = [...room.players.values()].filter(p => p.connected).length;
    if (room.votes.size >= connected) resolveVotes(room);
    ack({ ok: true });
  });

  socket.on('game:spy-guess', ({ guess }, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== 'playing' || socket.id !== room.spyId) return ack({ error: 'Only the spy can guess the location during a round.' });
    const chosen = String(guess ?? '').trim().toLowerCase();
    const correct = room.location?.name.toLowerCase() === chosen;
    room.status = 'results';
    room.winner = correct ? 'spy' : 'players';
    room.message = correct ? 'The spy guessed the location and wins!' : 'The spy guessed incorrectly. The group wins!';
    if (correct) { const p = room.players.get(room.spyId); if (p) p.score += 2; }
    else for (const p of room.players.values()) if (p.id !== room.spyId) p.score += 1;
    stopTimer(room); room.deadline = null;
    io.to(room.code).emit('game:reveal', { spyName: room.players.get(room.spyId)?.name || 'Unknown', location: room.location?.name || 'Unknown', accusedName: null, tie: false });
    broadcastRoom(room); ack({ ok: true });
  });

  socket.on('game:next-round', (_payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.id !== room.hostId) return ack({ error: 'Only the host can start the next round.' });
    if (room.status !== 'results') return ack({ error: 'Finish the current round first.' });
    resetRound(room); broadcastRoom(room); ack({ ok: true });
  });

  socket.on('room:leave', (_payload, ack = () => {}) => {
    leaveRoom(socket, true); ack({ ok: true });
  });

  socket.on('disconnect', () => leaveRoom(socket, false));
});

function leaveRoom(socket, explicit) {
  const code = socket.data.roomCode;
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(socket.id);
  if (!player) return;
  if (explicit) {
    room.players.delete(socket.id);
    room.votes.delete(socket.id);
    for (const [voter, target] of room.votes) if (target === socket.id) room.votes.delete(voter);
  } else {
    player.connected = false;
    // Keep the player record briefly so a transient network disconnect can be restored.
    setTimeout(() => {
      const currentRoom = rooms.get(code);
      const current = currentRoom?.players.get(socket.id);
      if (current && !current.connected) {
        currentRoom.players.delete(socket.id);
        currentRoom.votes.delete(socket.id);
        if (currentRoom.hostId === socket.id) {
          currentRoom.hostId = [...currentRoom.players.values()].find(p => p.connected)?.id || null;
        }
        if (currentRoom.players.size === 0) {
          stopTimer(currentRoom); rooms.delete(code);
        } else broadcastRoom(currentRoom);
      }
    }, 60_000);
  }
  if (room.hostId === socket.id) room.hostId = [...room.players.values()].find(p => p.connected && p.id !== socket.id)?.id || null;
  if (room.players.size === 0) { stopTimer(room); rooms.delete(code); }
  else broadcastRoom(room);
  socket.data.roomCode = null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
server.listen(PORT, () => console.log(`Spyfall server listening on port ${PORT}`));
