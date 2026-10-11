import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';

export default function PtzControls({ base, password, onUnauthorized }) {
  const motionRef = useRef(null);
  const releaseRef = useRef(null);
  const mounted = useRef(true);
  const [activeAction, setActiveAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function request(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${base}/ptz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, ...payload }),
        signal: controller.signal,
        keepalive: payload.control === 'stop',
      });
      const result = await response.json();
      if (result.unauthorized) {
        if (mounted.current) onUnauthorized();
        throw new Error('Please log in again');
      }
      if (!response.ok || !result.success)
        throw new Error(result.error || 'Camera control failed');
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  function stop(motion) {
    if (!motion.holdId) return;
    if (!motion.stopping) {
      motion.stopping = request({ control: 'stop', holdId: motion.holdId });
      // Release/pagehide can send this before the movement loop awaits it.
      motion.stopping.catch(() => {});
    }
    return motion.stopping;
  }

  function release() {
    const motion = motionRef.current;
    if (!motion || motion.released) return;
    motion.released = true;
    motion.wake?.();
    if (mounted.current) setActiveAction(null);
    // Do not wait for an in-flight keepalive before sending the stop.
    stop(motion);
  }
  releaseRef.current = release;

  useEffect(() => {
    mounted.current = true;
    const release = () => releaseRef.current();
    const hide = () => { if (document.hidden) release(); };
    const pointerRelease = event => {
      if (motionRef.current?.pointerId === event.pointerId) release();
    };
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    window.addEventListener('pointerup', pointerRelease);
    window.addEventListener('pointercancel', pointerRelease);
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      release();
      window.removeEventListener('blur', release);
      window.removeEventListener('pagehide', release);
      window.removeEventListener('pointerup', pointerRelease);
      window.removeEventListener('pointercancel', pointerRelease);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);

  function begin(action, input) {
    if (motionRef.current) return;
    const motion = { action, ...input, released: false };
    motionRef.current = motion;
    setActiveAction(action);
    setBusy(true);
    setError('');

    (async () => {
      try {
        const result = await request({ control: 'start', action });
        if (!result.holdId) throw new Error('Update the server to support hold controls');
        motion.holdId = result.holdId;
        while (!motion.released) {
          await new Promise(resolve => {
            const timer = setTimeout(resolve, 250);
            motion.wake = () => { clearTimeout(timer); resolve(); };
          });
          motion.wake = null;
          if (!motion.released)
            await request({ control: 'keepalive', holdId: motion.holdId });
        }
      } catch (error) {
        if (!motion.released && mounted.current)
          setError(error.name === 'AbortError' ? 'Camera request timed out. Check the connection.' : error.message);
      } finally {
        motion.released = true;
        motion.wake?.();
        try { await stop(motion); }
        catch (error) {
          if (mounted.current) setError(`Could not confirm camera stop: ${error.message}`);
        }
        if (motionRef.current === motion) {
          motionRef.current = null;
          if (mounted.current) {
            setActiveAction(null);
            setBusy(false);
          }
        }
      }
    })();
  }

  const control = (action, label, symbol) => (
    <Button size="sm" variant="outline-secondary" className={`ptz-button ptz-${action}`}
      aria-label={label} title={label} active={activeAction === action}
      aria-pressed={activeAction === action} disabled={busy && activeAction !== action}
      onPointerDown={event => {
        if (event.button !== 0 || motionRef.current) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        begin(action, { pointerId: event.pointerId });
      }}
      onPointerUp={event => { if (motionRef.current?.pointerId === event.pointerId) release(); }}
      onPointerCancel={event => { if (motionRef.current?.pointerId === event.pointerId) release(); }}
      onLostPointerCapture={event => { if (motionRef.current?.pointerId === event.pointerId) release(); }}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (!event.repeat) begin(action, { key: event.key });
      }}
      onKeyUp={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault();
        if (motionRef.current?.key === event.key) release();
      }}
      onBlur={release}
      onContextMenu={event => event.preventDefault()}>
      <span aria-hidden="true">{symbol}</span>
    </Button>
  );

  return <section className="ptz-controls" aria-label="Camera controls">
    <div className="ptz-pad">
      {control('up', 'Tilt camera up', '↑')}
      {control('left', 'Pan camera left', '←')}
      <span className="ptz-center" aria-hidden="true">•</span>
      {control('right', 'Pan camera right', '→')}
      {control('down', 'Tilt camera down', '↓')}
    </div>
    <div className="ptz-zoom">
      {control('zoom-in', 'Zoom camera in', '+')}
      <span className="ptz-zoom-label">Zoom</span>
      {control('zoom-out', 'Zoom camera out', '−')}
    </div>
    {error && <div className="ptz-error" role="alert">{error}</div>}
  </section>;
}
