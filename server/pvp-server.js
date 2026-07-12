const crypto = require('crypto');
const { verifyToken } = require('./auth');

const rooms = new Map();
const allClients = new Set();

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
    .update(String(key || '') + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
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
      const longLen = buffer.readBigUInt64BE(pos);
      if (longLen > BigInt(64 * 1024)) throw new Error('frame too large');
      len = Number(longLen);
      pos += 8;
    }

    if (!masked) throw new Error('client frames must be masked');
    if (len > 64 * 1024) throw new Error('frame too large');
    if (pos + 4 + len > buffer.length) break;

    const mask = buffer.subarray(pos, pos + 4);
    pos += 4;
    const body = Buffer.alloc(len);
    for (let i = 0; i < len; i++) body[i] = buffer[pos + i] ^ mask[i % 4];
    pos += len;
    offset = pos;

    if (opcode === 0x8) messages.push({ close: true });
    else if (opcode === 0x1) messages.push({ text: body.toString('utf8') });
    else if (opcode === 0x9) messages.push({ ping: body });
  }
  return { messages, rest: buffer.subarray(offset) };
}

function send(client, message) {
  if (!client || !client.socket || client.socket.destroyed) return;
  client.socket.write(encodeFrame(JSON.stringify(message)));
}

// 回 pong(opcode 0xA):响应客户端 ping,维持连接活性
function sendPong(client, payload) {
  if (!client || !client.socket || client.socket.destroyed) return;
  const body = Buffer.isBuffer(payload) ? payload.subarray(0, 125) : Buffer.alloc(0);
  const header = Buffer.from([0x8a, body.length]);
  client.socket.write(Buffer.concat([header, body]));
}

function sendError(client, message) {
  send(client, { type: 'error', message });
}

function broadcast(room, message, except = null) {
  for (const player of room.players) if (player && player !== except) send(player, message);
}

function broadcastAll(except, message) {
  for (const client of allClients) if (client !== except) send(client, message);
}

function sanitizeText(value, max = 40) {
  const clean = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim();
  return Array.from(clean).slice(0, max).join('');
}

function sanitizeDeck(deck) {
  if (!Array.isArray(deck)) return [];
  return deck
    .map(id => sanitizeText(id, 40))
    .filter(id => /^[a-z0-9_-]+$/i.test(id))
    .slice(0, 5);
}

const ACTION_TYPES = new Set(['summon_cell', 'move_cell', 'merge_or_swap_cell', 'urgent_dispatch']);
const ACTION_PAYLOAD_MAX_BYTES = 1024;

function clampCell(value, maxExclusive) {
  return Math.round(clampNumber(value, 0, maxExclusive - 1, 0));
}

function actionPayloadBytes(payload) {
  try { return Buffer.byteLength(JSON.stringify(payload || {}), 'utf8'); }
  catch (e) { return ACTION_PAYLOAD_MAX_BYTES + 1; }
}

function normalizeActionPayload(type, payload) {
  if (!payload || typeof payload !== 'object') payload = {};
  if (actionPayloadBytes(payload) > ACTION_PAYLOAD_MAX_BYTES) return null;
  if (type === 'summon_cell') {
    return {
      r: clampCell(payload.r, 3),
      c: clampCell(payload.c, 5),
      type: sanitizeText(payload.type || '', 40),
      level: Math.round(clampNumber(payload.level, 1, 8, 1)),
      spawnTimer: clampNumber(payload.spawnTimer, 0, 30, 0),
      cost: Math.round(clampNumber(payload.cost, 0, 20, 0)),
    };
  }
  if (type === 'move_cell' || type === 'merge_or_swap_cell') {
    return {
      fromR: clampCell(payload.fromR, 3),
      fromC: clampCell(payload.fromC, 5),
      toR: clampCell(payload.toR, 3),
      toC: clampCell(payload.toC, 5),
    };
  }
  if (type === 'urgent_dispatch') {
    return {
      r: clampCell(payload.r, 3),
      c: clampCell(payload.c, 5),
      cost: Math.round(clampNumber(payload.cost, 0, 20, 0)),
    };
  }
  return null;
}

function roomState(room) {
  return {
    roomId: room.id,
    players: room.players.map(player => player ? {
      index: player.index,
      ready: !!player.ready,
      deck: sanitizeDeck(player.deck || []),
    } : null),
  };
}

function leaveObserve(client) {
  const roomId = client._observer;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room && room.observers) room.observers = room.observers.filter(c => c !== client);
  client._observer = '';
}

function leaveRoom(client, notify = true) {
  const room = rooms.get(client.roomId);
  if (!room) {
    client.roomId = '';
    client.index = -1;
    client.ready = false;
    return;
  }

  if (client.index >= 0 && room.players[client.index] === client) {
    room.players[client.index] = null;
  }
  if (notify) {
    broadcast(room, { type: 'peer_left', roomId: room.id }, client);
    if (room.observers) for (const obs of room.observers) send(obs, { type: 'peer_left', roomId: room.id });
  }
  if (!room.players[0] && !room.players[1]) rooms.delete(room.id);

  client.roomId = '';
  client.index = -1;
  client.ready = false;
  client.deck = [];
}

function disconnectClient(client) {
  leaveObserve(client);
  leaveRoom(client, true);
  allClients.delete(client);
}

function createRoom(client) {
  leaveObserve(client);
  leaveRoom(client, false);

  const id = makeRoomId();
  const room = { id, seed: 0, players: [null, null], observers: [], result: null };
  client.roomId = id;
  client.index = 0;
  client.ready = false;
  client.deck = [];
  client._lastActionSeq = 0;
  room.players[0] = client;
  rooms.set(id, room);
  send(client, { type: 'room_created', ...roomState(room), playerIndex: 0 });
}

function joinRoom(client, roomId) {
  const room = rooms.get(String(roomId || '').trim());
  if (!room) return sendError(client, 'room_not_found');
  if (room.players[1]) return sendError(client, 'room_full');

  leaveObserve(client);
  leaveRoom(client, false);
  client.roomId = room.id;
  client.index = 1;
  client.ready = false;
  client.deck = [];
  client._lastActionSeq = 0;
  room.players[1] = client;
  send(client, { type: 'room_joined', ...roomState(room), playerIndex: 1 });
  broadcast(room, { type: 'peer_joined', ...roomState(room) }, client);
}

function setReady(client, ready, deck) {
  const room = rooms.get(client.roomId);
  if (!room) return sendError(client, 'not_in_room');

  client.ready = !!ready;
  client.deck = sanitizeDeck(deck);
  broadcast(room, { type: 'ready_state', ...roomState(room) });

  if (room.players[0] && room.players[1] && room.players.every(player => player.ready)) {
    room.seed = makeSeed();
    for (const player of room.players) player._lastActionSeq = 0;
    room.result = null;
    broadcast(room, {
      type: 'match_start',
      roomId: room.id,
      seed: room.seed,
      decks: room.players.map(player => sanitizeDeck(player.deck || [])),
    });
  }
}

function normalizeAction(client, room, action) {
  if (!action || typeof action !== 'object') return null;
  const now = Date.now();
  const seq = Number.isInteger(action.seq) && action.seq > 0 ? action.seq : client._lastActionSeq + 1;
  if (seq <= (client._lastActionSeq || 0)) return null;
  if (Number.isInteger(action.seed) && action.seed !== room.seed) return null;
  const type = sanitizeText(action.type, 48);
  if (!ACTION_TYPES.has(type)) return null;
  const payload = normalizeActionPayload(type, action.payload);
  if (!payload) return null;
  client._lastActionSeq = seq;

  return {
    seq,
    seed: Number.isInteger(action.seed) ? action.seed : room.seed,
    timestamp: Number.isFinite(action.timestamp) ? action.timestamp : now,
    matchTime: Number.isFinite(action.matchTime) ? action.matchTime : 0,
    type,
    payload,
  };
}

function forwardAction(client, action) {
  const room = rooms.get(client.roomId);
  if (!room) return sendError(client, 'not_in_room');
  const peer = room.players[client.index === 0 ? 1 : 0];
  if (!peer) return sendError(client, 'peer_offline');

  const now = Date.now();
  client._actionTimes = (client._actionTimes || []).filter(t => now - t < 1000);
  if (client._actionTimes.length >= 15) return sendError(client, 'action_rate_limited');
  client._actionTimes.push(now);

  const normalized = normalizeAction(client, room, action);
  if (!normalized) return sendError(client, 'invalid_action');

  const message = { type: 'peer_action', from: client.index, action: normalized };
  send(peer, message);
  if (room.observers) for (const obs of room.observers) send(obs, message);
}

function clampNumber(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function summarizeResult(client, room, result) {
  if (!result || typeof result !== 'object') return null;
  if (Number.isInteger(result.seed) && result.seed !== room.seed) return null;
  const winner = clampNumber(result.winner, 0, 1, client.index);
  const duration = Math.round(clampNumber(result.duration, 0, 900, 0));
  const wallLeft = Math.round(clampNumber(result.wallLeft, 0, 100, 0));
  const actionCount = Math.round(clampNumber(result.actionCount, 0, 5000, 0));
  return {
    seed: room.seed,
    winner,
    duration,
    wallLeft,
    actionCount,
    reason: sanitizeText(result.reason || 'normal', 24) || 'normal',
  };
}

function reportResult(client, result) {
  const room = rooms.get(client.roomId);
  if (!room) return sendError(client, 'not_in_room');
  const summary = summarizeResult(client, room, result);
  if (!summary) return sendError(client, 'invalid_result');
  if (room.result && (
    room.result.seed !== summary.seed ||
    room.result.winner !== summary.winner ||
    Math.abs(room.result.duration - summary.duration) > 10
  )) {
    return sendError(client, 'result_conflict');
  }
  room.result = room.result || summary;
  const message = { type: 'match_result', roomId: room.id, from: client.index, result: room.result };
  broadcast(room, message);
  if (room.observers) for (const obs of room.observers) send(obs, message);
}

function observeRoom(client, roomId) {
  const room = rooms.get(String(roomId || '').trim());
  if (!room) return sendError(client, 'room_not_found');
  if ((room.observers || []).length >= 20) return sendError(client, 'observers_full');
  leaveObserve(client);
  leaveRoom(client, false);
  room.observers.push(client);
  client._observer = room.id;
  send(client, { type: 'room_joined', ...roomState(room), playerIndex: -1 });
}

function pushChat(client, message) {
  const chat = require('./index').chatMessages;
  const text = sanitizeText(message.text || message.m || '', 80);
  if (!text) return;
  // 昵称一律取服务端认证信息,忽略客户端自报 —— 杜绝冒充他人昵称
  const nick = client._uid
    ? (sanitizeText(client._nick || '', 24) || ('玩家' + String(client._uid).slice(0, 4)))
    : '游客';
  const msg = {
    uid: sanitizeText(client._uid || '', 32),
    nick,
    nickname: nick,
    text,
    time: new Date().toISOString(),
  };
  chat.push(msg);
  if (chat.length > 100) chat.shift();
  broadcastAll(client, { type: 'chat', message: msg });
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (err) {
    return sendError(client, 'bad_json');
  }

  if (message.type === 'create_room') createRoom(client);
  else if (message.type === 'join_room') joinRoom(client, message.roomId);
  else if (message.type === 'ready') setReady(client, message.ready, message.deck);
  else if (message.type === 'action') forwardAction(client, message.action);
  else if (message.type === 'result') reportResult(client, message.result);
  else if (message.type === 'leave' || message.type === 'leave_room') { leaveObserve(client); leaveRoom(client); }
  else if (message.type === 'observe') observeRoom(client, message.roomId);
  else if (message.type === 'chat') pushChat(client, message);
  else sendError(client, 'unknown_message_type');
}

function flushClientBuffer(client) {
  const decoded = decodeFrames(client.buffer);
  client.buffer = decoded.rest;
  for (const message of decoded.messages) {
    if (message.close) return client.socket.end();
    if (message.ping) { sendPong(client, message.ping); continue; }
    if (message.text) handleMessage(client, message.text);
  }
}

function attachSocket(socket, head = null, auth = null) {
  const client = {
    socket, buffer: Buffer.alloc(0), roomId: '', index: -1, ready: false, deck: [], _observer: '',
    _uid: (auth && auth.uid) || '', _nick: (auth && auth.nick) || '',
  };
  allClients.add(client);
  // 空闲超时:120s 无任何数据自动断开,清理半开(掉线未发 FIN)连接
  socket.setTimeout(120000, () => { try { socket.end(); } catch (e) {} });
  if (head && head.length) client.buffer = Buffer.concat([client.buffer, head]);

  const onData = (chunk) => {
    try {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      flushClientBuffer(client);
    } catch (err) {
      sendError(client, 'websocket_protocol_error');
      socket.end();
    }
  };

  socket.on('data', onData);
  socket.on('end', () => disconnectClient(client));
  socket.on('close', () => disconnectClient(client));
  socket.on('error', () => disconnectClient(client));

  if (client.buffer.length) {
    try { flushClientBuffer(client); }
    catch (err) { sendError(client, 'websocket_protocol_error'); socket.end(); }
  }
}

// 从连接 URL 的 ?token= 解析并校验 JWT;返回 {uid, nick}(游客为空串)
function authFromUrl(url) {
  try {
    const q = new URL(String(url || ''), 'http://pvp.local').searchParams;
    const token = q.get('token');
    if (!token) return { uid: '', nick: '' };
    const payload = verifyToken(token);
    if (!payload || !payload.uid) return { uid: '', nick: '' };
    let nick = '';
    try {
      const db = require('./db');
      const row = db.prepare('SELECT nickname FROM users WHERE uid = ?').get(payload.uid);
      nick = (row && row.nickname) || '';
    } catch (e) { nick = ''; }
    return { uid: payload.uid, nick };
  } catch (e) {
    return { uid: '', nick: '' };
  }
}

function handlePvpUpgrade(req, socket, head) {
  if (!String(req.url || '').startsWith('/pvp')) {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();

  const auth = authFromUrl(req.url);
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '',
    '',
  ].join('\r\n'));
  attachSocket(socket, head, auth);
}

function attachPvp(httpServer) {
  httpServer.on('upgrade', handlePvpUpgrade);
}

module.exports = {
  handlePvpUpgrade,
  attachPvp,
  _internals: {
    rooms,
    allClients,
    acceptKey,
    encodeFrame,
    decodeFrames,
    sanitizeDeck,
    sanitizeText,
  },
};
