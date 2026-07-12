const assert = require('assert');
const http = require('http');
const net = require('net');
const { handlePvpUpgrade, _internals } = require('../server/pvp-server');

function encodeClientFrame(value) {
  const body = Buffer.from(JSON.stringify(value));
  const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x81, 0x80 | body.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(body.length, 2);
  }
  const masked = Buffer.alloc(body.length);
  for (let i = 0; i < body.length; i++) masked[i] = body[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, masked]);
}

function decodeServerFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
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
    if (pos + len > buffer.length) break;
    const body = buffer.subarray(pos, pos + len);
    pos += len;
    offset = pos;
    if (opcode === 0x1) messages.push(JSON.parse(body.toString('utf8')));
  }
  return { messages, rest: buffer.subarray(offset) };
}

class RawWs {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.messages = [];
    this.waiters = [];
    socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      const decoded = decodeServerFrames(this.buffer);
      this.buffer = decoded.rest;
      this.messages.push(...decoded.messages);
      this.flush();
    });
  }

  static connect(port) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
        socket.write([
          'GET /pvp HTTP/1.1',
          'Host: 127.0.0.1',
          'Upgrade: websocket',
          'Connection: Upgrade',
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
      });
      let header = Buffer.alloc(0);
      const onData = chunk => {
        header = Buffer.concat([header, chunk]);
        const idx = header.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const text = header.subarray(0, idx).toString('utf8');
        assert.match(text, /101 Switching Protocols/);
        socket.off('data', onData);
        const client = new RawWs(socket);
        const rest = header.subarray(idx + 4);
        if (rest.length) socket.emit('data', rest);
        resolve(client);
      };
      socket.on('data', onData);
      socket.on('error', reject);
    });
  }

  send(value) {
    this.socket.write(encodeClientFrame(value));
  }

  flush() {
    while (this.waiters.length && this.messages.length) {
      const next = this.waiters.shift();
      next(this.messages.shift());
    }
  }

  next(timeoutMs = 1000) {
    if (this.messages.length) return Promise.resolve(this.messages.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for websocket message')), timeoutMs);
      this.waiters.push(message => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  async nextType(type, timeoutMs = 1000) {
    for (;;) {
      let message;
      try {
        message = await this.next(timeoutMs);
      } catch (err) {
        err.message = `timed out waiting for ${type}; queued=${this.messages.map(m => m.type).join(',') || 'none'}`;
        throw err;
      }
      if (message.type === type) return message;
    }
  }

  close() {
    this.socket.destroy();
  }

  disconnect() {
    this.socket.end();
  }
}

(async () => {
  _internals.rooms.clear();
  _internals.allClients.clear();
  const server = http.createServer();
  server.on('upgrade', handlePvpUpgrade);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const host = await RawWs.connect(port);
  const guest = await RawWs.connect(port);
  let completed = false;
  try {
    host.send({ type: 'create_room' });
    const created = await host.nextType('room_created');
    assert.ok(/^\d{4}$/.test(created.roomId));

    guest.send({ type: 'join_room', roomId: created.roomId });
    const joined = await guest.nextType('room_joined');
    assert.strictEqual(joined.roomId, created.roomId);
    await host.nextType('peer_joined');

    host.send({ type: 'ready', ready: true, deck: ['watermelon_guard', 'grape_archer'] });
    guest.send({ type: 'ready', ready: true, deck: ['banana_raider', 'orange_cannon'] });
    const startA = await host.nextType('match_start');
    const startB = await guest.nextType('match_start');
    assert.strictEqual(startA.seed, startB.seed);
    assert.ok(Number.isInteger(startA.seed));

    host.send({ type: 'action', action: { seq: 1, seed: startA.seed, timestamp: Date.now(), type: 'summon_cell', payload: { r: 1, c: 2 } } });
    const peerAction = await guest.nextType('peer_action');
    assert.strictEqual(peerAction.action.seq, 1);
    assert.strictEqual(peerAction.action.seed, startA.seed);
    assert.strictEqual(peerAction.action.type, 'summon_cell');

    host.send({ type: 'action', action: { seq: 1, seed: startA.seed, timestamp: Date.now(), type: 'summon_cell', payload: { r: 0, c: 0 } } });
    const duplicate = await host.nextType('error');
    assert.strictEqual(duplicate.message, 'invalid_action');

    host.send({ type: 'action', action: { seq: 2, seed: startA.seed, timestamp: Date.now(), type: 'hack_gold', payload: { gold: 999999 } } });
    const invalidType = await host.nextType('error');
    assert.strictEqual(invalidType.message, 'invalid_action');

    host.send({ type: 'action', action: { seq: 2, seed: startA.seed, timestamp: Date.now(), type: 'summon_cell', payload: { r: 1, c: 1, blob: 'x'.repeat(2048) } } });
    const hugePayload = await host.nextType('error');
    assert.strictEqual(hugePayload.message, 'invalid_action');

    host.send({ type: 'result', result: { seed: startA.seed, winner: 0, duration: 42, wallLeft: 66, actionCount: 3, reason: 'normal' } });
    const result = await guest.nextType('match_result');
    assert.strictEqual(result.result.seed, startA.seed);
    assert.strictEqual(result.result.winner, 0);
    assert.strictEqual(result.result.duration, 42);

    for (let seq = 2; seq <= 18; seq++) {
      host.send({ type: 'action', action: { seq, seed: startA.seed, timestamp: Date.now(), type: 'summon_cell', payload: { r: seq % 3, c: seq % 5 } } });
    }
    const limited = await host.nextType('error');
    assert.strictEqual(limited.message, 'action_rate_limited');

    guest.disconnect();
    const left = await host.nextType('peer_left', 3000);
    assert.strictEqual(left.roomId, created.roomId);

    completed = true;
  } finally {
    host.close();
    guest.close();
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 250);
      server.close(() => { clearTimeout(timer); resolve(); });
    });
    _internals.rooms.clear();
    _internals.allClients.clear();
  }
  assert.ok(completed, 'pvp flow should complete all assertions');
  if (completed) process.stdout.write('OK: pvp room handshake, action sync, seq/rate guard, result, and disconnect work\n');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
