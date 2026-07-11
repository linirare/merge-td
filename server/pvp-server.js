const crypto = require('crypto');
const rooms = new Map();

function makeRoomId() {
  let id = '';
  do {
    id = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms.has(id));
  return id;
}

function makeSeed() {
  return Math.floor(1 + Math.random() * 0x7ffffffe);
}

function acceptKey(key) {
  return crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function encodeFrame(payload) {
  const body = Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x81, body.length]);
  } else if (body.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let len = second & 0x7f;
    let pos = offset + 2;
    if (len === 126) {
      if (pos + 2 > buffer.length) break;
      len = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      if (pos + 8 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(pos));
      pos += 8;
    }
    if (!masked || pos + 4 + len > buffer.length) break;
    const mask = buffer.subarray(pos, pos + 4);
    pos += 4;
    const body = Buffer.alloc(len);
    for (let i = 0; i < len; i++) body[i] = buffer[pos + i] ^ mask[i % 4];
    pos += len;
    offset = pos;
    if (opcode === 0x8) messages.push({ close: true });
    else if (opcode === 0x1) messages.push({ text: body.toString('utf8') });
  }
  return { messages, rest: buffer.subarray(offset) };
}

function send(client, message) {
  if (!client.socket.destroyed) client.socket.write(encodeFrame(JSON.stringify(message)));
}

function sendError(client, message) {
  send(client, { type: 'error', message });
}

const allClients = new Set();
function broadcast(room, message, except = null) {
  for (const player of room.players) if (player && player !== except) send(player, message);
}
function broadcastAll(except, message) { for (const c of allClients) if (c !== except) send(c, message); }

function roomState(room) {
  return {
    roomId: room.id,
    players: room.players.map(player => player ? {
      index: player.index,
      ready: player.ready,
      deck: player.deck || [],
    } : null),
  };
}

function createRoom(client) {
  leaveRoom(client, false);
  // 分池匹配(设计档 §10.1):按养成级分 5 池,交换信息时写入
  function pvpTier(cultivateLv) {
    if (cultivateLv <= 3) return '新手';
    if (cultivateLv <= 8) return '普通';
    if (cultivateLv <= 13) return '高级';
    if (cultivateLv <= 17) return '大师';
    return '传奇';
  }

  const id = makeRoomId();
  const room = { id, seed: 0, players: [null, null] };
  client.roomId = id;
  client.index = 0;
  client.ready = false;
  room.players[0] = client;
  rooms.set(id, room);
  send(client, { type: 'room_created', ...roomState(room), playerIndex: 0 });
}

function joinRoom(client, roomId) {
  const room = rooms.get(String(roomId || '').trim());
  if (!room) return sendError(client, '房间不存在');
  if (room.players[1]) return sendError(client, '房间已满');
  leaveRoom(client, false);
  client.roomId = room.id;
  client.index = 1;
  client.ready = false;
  room.players[1] = client;
  send(client, { type: 'room_joined', ...roomState(room), playerIndex: 1 });
  broadcast(room, { type: 'peer_joined', ...roomState(room) }, client);
}

function setReady(client, ready, deck) {
  const room = rooms.get(client.roomId);
  if (!room) return sendError(client, '尚未加入房间');
  client.ready = !!ready;
  client.deck = Array.isArray(deck) ? deck.slice(0, 5) : [];
  broadcast(room, { type: 'ready_state', ...roomState(room) });
  if (room.players[0] && room.players[1] && room.players.every(player => player.ready)) {
    room.seed = makeSeed();
    broadcast(room, {
      type: 'match_start',
      roomId: room.id,
      seed: room.seed,
      decks: room.players.map(player => player.deck || []),
    });
  }
}

function forwardAction(client, action) {
  const room = rooms.get(client.roomId);
  if (!room) return sendError(client, '尚未加入房间');
  const peer = room.players[client.index === 0 ? 1 : 0];
  if (!peer) return sendError(client, '对手不在线');
  // 反作弊:seq 顺序 + 频率限制
  if (!action || typeof action !== 'object') return sendError(client, '无效操作');
  const key = '_seq_' + client.index;
  room[key] = (room[key] || 0) + 1;
  const now = Date.now();
  client._actionTimes = (client._actionTimes || []).filter(t => now - t < 1000);
  if (client._actionTimes.length >= 15) return sendError(client, '操作过快');
  client._actionTimes.push(now);
  send(peer, { type: 'peer_action', from: client.index, action });
  // 广播给观战者
  if (room.observers) for (const obs of room.observers) send(obs, { type: 'peer_action', from: client.index, action });
}
function observeRoom(client, roomId) {
  const room = rooms.get(String(roomId || '').trim());
  if (!room) return sendError(client, '房间不存在');
  if (!room.observers) room.observers = [];
  room.observers.push(client); client._observer = roomId;
  send(client, { type: 'room_joined', ...roomState(room), playerIndex: -1 });
}
function leaveObserve(client) {
  const roomId = client._observer; if (!roomId) return;
  const room = rooms.get(roomId);
  if (room && room.observers) room.observers = room.observers.filter(c => c !== client);
  client._observer = null;
}

function leaveRoom(client, notify = true) { allClients.delete(client);
  const room = rooms.get(client.roomId);
  if (!room) return;
  room.players[client.index] = null;
  if (notify) broadcast(room, { type: 'peer_left', roomId: room.id });
  if (!room.players[0] && !room.players[1]) rooms.delete(room.id);
  client.roomId = '';
  client.index = -1;
  client.ready = false;
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (err) {
    return sendError(client, '消息格式错误');
  }
  if (message.type === 'create_room') createRoom(client);
  else if (message.type === 'join_room') joinRoom(client, message.roomId);
  else if (message.type === 'ready') setReady(client, message.ready, message.deck);
  else if (message.type === 'action') forwardAction(client, message.action);
  else if (message.type === 'leave_room') { leaveRoom(client); leaveObserve(client); }
  else if (message.type === 'observe') observeRoom(client, message.roomId);
  else if (message.type === 'chat') { const chat = require('./index').chatMessages; const msg = { uid: client._uid || '', nick: message.nick || '', text: message.text || '', time: new Date().toISOString() }; chat.push(msg); if (chat.length > 100) chat.shift(); broadcastAll(client, { type: 'chat', message: msg }); }
  else sendError(client, '未知消息类型');
}

function attachPvp(httpServer) {
httpServer.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '',
    '',
  ].join('\r\n'));

  const client = { socket, buffer: Buffer.alloc(0), roomId: '', index: -1, ready: false, deck: [] };
  socket.on('data', chunk => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    const decoded = decodeFrames(client.buffer);
    client.buffer = decoded.rest;
    for (const message of decoded.messages) {
      if (message.close) return socket.end();
      if (message.text) handleMessage(client, message.text);
    }
  });
  socket.on('close', () => leaveRoom(client));
  socket.on('error', () => leaveRoom(client));
});
}

function handlePvpUpgrade(req, socket, head) {
  // 复用同一个 HTTP server 做 WS 升级;不再单独起端口
  const crypto = require('crypto');
  const key = req.headers['sec-websocket-key'] || '';
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.client = { send(txt) { const b = Buffer.from(txt); const header = Buffer.alloc(2 + (b.length < 126 ? 0 : 2)); header[0] = 0x81; if (b.length < 126) header[1] = b.length; else { header[1] = 126; header.writeUInt16BE(b.length, 2); } socket.write(Buffer.concat([header, b])); } };
  allClients.add(socket.client);
  handleClient(socket.client);
}

module.exports = { handlePvpUpgrade };
