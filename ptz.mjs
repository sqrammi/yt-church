import net from 'node:net';

const panStop = Buffer.from([0x81, 1, 6, 1, 1, 1, 3, 3, 0xff]);
const zoomStop = Buffer.from([0x81, 1, 4, 7, 0, 0xff]);

function integer(value, fallback, min, max) {
  const n = value ?? fallback;
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`PTZ setting must be an integer from ${min} to ${max}`);
  return n;
}

// Raw VISCA over TCP (not Sony's UDP packet framing). Match fragmented
// ACK/completion packets by VISCA socket number, including overlapping stop.
function connect(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const pending = [];
    let buffer = Buffer.alloc(0);
    let failure;
    const fail = error => {
      failure = error;
      clearTimeout(connectTimer);
      reject(error);
      pending.splice(0).forEach(item => {
        clearTimeout(item.timer);
        item.reject(error);
      });
      socket.destroy();
    };
    const connectTimer = setTimeout(() => fail(new Error('Camera connection timed out')), timeoutMs);
    socket.setNoDelay(true);
    socket.on('error', fail);
    socket.on('close', () => fail(failure || new Error('Camera disconnected')));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      let end;
      while ((end = buffer.indexOf(0xff)) !== -1) {
        const packet = buffer.subarray(0, end + 1);
        buffer = buffer.subarray(end + 1);
        if (packet.length < 3 || packet[0] !== 0x90) continue;
        const kind = packet[1] & 0xf0;
        const id = packet[1] & 0x0f;
        const item = kind === 0x40
          ? pending.find(item => item.id === null)
          : pending.find(item => item.id === id) || pending.find(item => item.id === null);
        if (!item) continue;
        if (kind === 0x40) item.id = id;
        else if (kind === 0x50 || kind === 0x60) {
          pending.splice(pending.indexOf(item), 1);
          clearTimeout(item.timer);
          if (kind === 0x60) item.reject(new Error(`Camera rejected VISCA command (0x${packet[2].toString(16)})`));
          else item.resolve();
        }
      }
      if (buffer.length > 1024) fail(new Error('Invalid camera response'));
    });
    socket.once('connect', () => {
      clearTimeout(connectTimer);
      resolve({
        command(bytes, commandTimeoutMs = timeoutMs) {
          return new Promise((resolve, reject) => {
            if (socket.destroyed) return reject(failure || new Error('Camera disconnected'));
            const item = { id: null, resolve, reject };
            item.timer = setTimeout(() => fail(new Error('Camera response timed out')), commandTimeoutMs);
            pending.push(item);
            socket.write(bytes);
          });
        },
        close() { socket.destroy(); },
      });
    });
  });
}

export function createPtzController(config = {}) {
  const { host } = config;
  const port = integer(config.port, 5678, 1, 65535);
  const panSpeed = integer(config.panSpeed, 2, 1, 24);
  const tiltSpeed = integer(config.tiltSpeed, 2, 1, 20);
  const zoomSpeed = integer(config.zoomSpeed, 0, 0, 7);
  const nudgeMs = integer(config.nudgeMs, 250, 100, 500);
  const timeoutMs = 1000;
  const directions = { up: [3, 1], down: [3, 2], left: [1, 3], right: [2, 3] };
  let busy = false;

  async function stop(session, zoomFirst) {
    // Attempt both axes even if one stop is rejected.
    const results = [];
    for (const bytes of (zoomFirst ? [zoomStop, panStop] : [panStop, zoomStop])) {
      try { await session.command(bytes); }
      catch (error) { results.push(error); }
    }
    if (results.length) throw results[0];
  }

  return {
    async recallPreset(preset) {
      if (preset !== 1 && preset !== 2)
        throw Object.assign(new Error('Preset must be 1 or 2'), { status: 400 });
      if (!host || typeof host !== 'string')
        throw Object.assign(new Error('Configure ptz.host in config.json to enable camera controls'), { status: 503 });
      if (busy) throw Object.assign(new Error('Camera is busy; try again'), { status: 409 });
      busy = true;
      let session;
      try {
        session = await connect(host, port, timeoutMs);
        // Recall camera memory, using the same slot numbers as the web UI.
        // A preset may take seconds to reach: wait for completion and do not
        // apply the manual nudge's 250 ms stop timer or overwrite the preset.
        await session.command(Buffer.from([0x81, 1, 4, 0x3f, 2, preset, 0xff]), 30000);
      } finally {
        session?.close();
        busy = false;
      }
    },
    async nudge(action) {
      let bytes;
      if (typeof action !== 'string')
        throw Object.assign(new Error('Unknown PTZ action'), { status: 400 });
      if (Object.hasOwn(directions, action))
        bytes = Buffer.from([0x81, 1, 6, 1, panSpeed, tiltSpeed, ...directions[action], 0xff]);
      else if (action === 'zoom-in' || action === 'zoom-out')
        bytes = Buffer.from([0x81, 1, 4, 7, (action === 'zoom-in' ? 0x20 : 0x30) + zoomSpeed, 0xff]);
      else throw Object.assign(new Error('Unknown PTZ action'), { status: 400 });
      if (!host || typeof host !== 'string')
        throw Object.assign(new Error('Configure ptz.host in config.json to enable camera controls'), { status: 503 });
      // Reject overlapping clients/taps; never build a queue of stale movements.
      if (busy) throw Object.assign(new Error('Camera is busy; try again'), { status: 409 });
      busy = true;
      let session;
      let sent = false;
      try {
        session = await connect(host, port, timeoutMs);
        sent = true;
        const movement = session.command(bytes);
        // Start the stop timer immediately, independently of replies or the HTTP
        // client. A lost ACK or closed browser must not prolong movement.
        const stopping = new Promise((resolve, reject) => {
          setTimeout(() => stop(session, action.startsWith('zoom-')).then(resolve, reject), nudgeMs);
        });
        const results = await Promise.allSettled([movement, stopping]);
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
      } catch (error) {
        if (sent) {
          // If the connection failed during movement, retry stops once on a
          // fresh connection; never replay the movement itself.
          session?.close();
          try {
            session = await connect(host, port, timeoutMs);
            await stop(session, action.startsWith('zoom-'));
          } catch {
            throw new Error('Camera connection failed and stop could not be confirmed; check the camera');
          }
        }
        throw error;
      } finally {
        session?.close();
        busy = false;
      }
    },
  };
}
