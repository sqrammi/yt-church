// Keep one OBS session at a time. Failed requests are never replayed.
export function createObsConnection({
  createClient,
  url,
  password,
  eventSubscriptions,
  retryMs = 3000,
  timeoutMs = 15000,
  log = console,
}) {
  let running = false;
  let current = null;
  let retryTimer = null;
  let connected = false;
  let streaming = false;

  const unavailable = () => Object.assign(new Error('OBS is disconnected; reconnecting'), {
    status: 503,
  });

  function scheduleRetry() {
    if (!running || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, retryMs);
  }

  function retire(session, reason) {
    if (current !== session) return;
    current = null;
    connected = false;
    streaming = false;
    for (const reject of session.pending) reject(unavailable());
    session.pending.clear();
    // Closing may emit ConnectionClosed again; the identity check above handles it.
    try {
      Promise.resolve(session.client.disconnect()).catch(() => {});
    } catch {}
    if (running) {
      log.warn(`OBS unavailable: ${reason?.message || 'connection closed'}. Retrying in ${retryMs / 1000}s.`);
      scheduleRetry();
    }
  }

  async function waitFor(session, operation, description) {
    let timer;
    let cancel;
    try {
      const result = await Promise.race([
        operation,
        new Promise((_, reject) => {
          cancel = reject;
          session.pending.add(reject);
          if (current !== session) reject(unavailable());
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Object.assign(
            new Error(`OBS timed out: ${description}`), { status: 504 },
          )), timeoutMs);
        }),
      ]);
      if (current !== session) throw unavailable();
      return result;
    } finally {
      clearTimeout(timer);
      session.pending.delete(cancel);
    }
  }

  async function connect() {
    if (!running || current) return;
    let session;
    try {
      session = { client: createClient(), streamRevision: 0, pending: new Set() };
      current = session;
      session.client.on('ConnectionClosed', error => retire(session, error));
      session.client.on('ConnectionError', error => retire(session, error));
      session.client.on('StreamStateChanged', event => {
        if (current !== session) return;
        session.streamRevision++;
        streaming = Boolean(event.outputActive);
      });

      await waitFor(session, session.client.connect(url, password, {
        eventSubscriptions,
      }), 'connecting');
      const revision = session.streamRevision;
      const state = await waitFor(session, session.client.call('GetStreamStatus'), 'reading stream status');
      // An event received during the status request is newer than its snapshot.
      if (revision === session.streamRevision) streaming = Boolean(state.outputActive);
      connected = true;
      log.log('OBS connected');
    } catch (error) {
      if (session) retire(session, error);
      else {
        log.warn(`OBS client could not start: ${error.message}`);
        scheduleRetry();
      }
    }
  }

  return {
    get connected() { return connected; },
    get streaming() { return streaming; },
    start() {
      if (running) return;
      running = true;
      void connect();
    },
    stop() {
      running = false;
      clearTimeout(retryTimer);
      retryTimer = null;
      if (current) retire(current);
    },
    async call(requestType, requestData) {
      const session = current;
      if (!connected || !session) throw unavailable();
      try {
        return await waitFor(session, session.client.call(requestType, requestData), requestType);
      } catch (error) {
        if (error.status === 504) retire(session, error);
        throw error;
      }
    },
  };
}
