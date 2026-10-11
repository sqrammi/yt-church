import { useRef, useState } from 'react';
import { Button } from 'react-bootstrap';

export default function PtzControls({ base, password, onUnauthorized }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function nudge(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${base}/ptz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (result.unauthorized) {
        onUnauthorized();
        return;
      }
      if (!response.ok || !result.success)
        throw new Error(result.error || 'Camera control failed');
    } catch (error) {
      setError(error.name === 'AbortError' ? 'Camera request timed out. Check the connection.' : error.message);
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setBusy(false);
    }
  }

  const control = (action, label, symbol) => (
    <Button size="sm" variant="outline-secondary" className={`ptz-button ptz-${action}`}
      aria-label={label} title={label} disabled={busy} onClick={() => nudge(action)}>
      <span aria-hidden="true">{symbol}</span>
    </Button>
  );

  return <section className="ptz-controls" aria-label="Camera controls" aria-busy={busy}>
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
    <small className="ptz-hint">Tap to adjust · Slow</small>
    {error && <div className="ptz-error" role="alert">{error}</div>}
  </section>;
}
