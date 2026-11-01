import black from './SMPTE_Color_Bars.svg';
import Recording from './recording.svg';
import PtzControls from './PtzControls';
import './Dashboard.css';

const { useCallback, useEffect, useRef, useState } = require('react');
const { Image, Button, Modal } = require('react-bootstrap');
const { Header, Title, Body, Footer } = Modal;

const headers = {
  'Content-type': 'application/json',
};

function SceneButton({ scene, setScene, currentScene }) {
  return <Button size="sm" variant={scene === currentScene ? 'primary' : 'secondary'}
    onClick={() => setScene({ scene })}>{scene}</Button>
}

function Dashboard({ password, setPassword, config }) {
  const base = config.apiBaseUrl;
  const [ image, setImage ] = useState('');
  const [ confirming, setConfirming ] = useState();
  const [ currentScene, setCurrentScene ] = useState('unknown');
  const [ streaming, setStreaming ] = useState();
  const [ recallingPreset, setRecallingPreset ] = useState(false);
  const [ presetError, setPresetError ] = useState('');
  const presetInFlight = useRef(false);

  const loadingImage = useRef({});
  const loadingState = useRef({});

  const loadImage = useCallback(async (signal) => {
    if (loadingImage.current.loading)
      return;

    loadingImage.current.loading = true;
    try {
      const req = await fetch(`${base}/snap`, {
        method: 'POST', headers, body: JSON.stringify({ password }), signal,
      });

      if (req.headers.get('content-type')?.split(';')[0] === 'image/jpeg') {
        const blob = await req.blob();
        if (!signal.aborted) setImage(URL.createObjectURL(blob));
      } else {
        const resp = await req.json();
        if (signal.aborted) return;
        if (resp.unauthorized)
          setPassword('');
        else setImage(black);
      }
    } catch (e) {
      if (!signal.aborted) {
        console.log('error getting image', e);
        setPassword('');
      }
    } finally {
      delete loadingImage.current.loading;
    }
  }, [ base, password, setPassword ]);

  const loadState = useCallback(async (signal) => {
    if (loadingState.current.loading)
      return;

    loadingState.current.loading = true;
    try {
      const req = await fetch(`${base}/state`, {
        method: 'POST', headers, body: JSON.stringify({ password }), signal,
      });

      const resp = await req.json();
      if (signal.aborted) return;
      setStreaming(!!resp?.streaming);
      setCurrentScene(resp?.scene || 'unknown');
    } catch (e) {
      if (!signal.aborted) console.log('error getting state', e);
    } finally {
      delete loadingState.current.loading;
    }
  }, [ base, password ]);

  useEffect(() => {
    const controller = new AbortController();
    const refreshImage = () => loadImage(controller.signal);
    const refreshState = () => loadState(controller.signal);
    refreshImage();
    refreshState();
    const intervalImage = setInterval(refreshImage, config.pollIntervalMs);
    const intervalState = setInterval(refreshState, config.pollIntervalMs);
    return () => {
      clearInterval(intervalImage);
      clearInterval(intervalState);
      controller.abort();
    }
  }, [ loadImage, loadState, config.pollIntervalMs ]);

  useEffect(() => () => {
    if (image.startsWith('blob:')) URL.revokeObjectURL(image);
  }, [ image ]);

  const imageProps = {};
  imageProps.src = image || black;

  const recallPreset = async (preset) => {
    if (presetInFlight.current) return;
    presetInFlight.current = true;
    setRecallingPreset(true);
    setPresetError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const req = await fetch(`${base}/ptz`, {
        method: 'POST', headers,
        body: JSON.stringify({ password, action: 'preset', preset }),
        signal: controller.signal,
      });
      const result = await req.json();
      if (result.unauthorized) return setPassword('');
      if (!req.ok || !result.success)
        throw new Error(result.error || 'Could not recall camera preset');
    } catch (error) {
      setPresetError(error.name === 'AbortError' ? 'Preset request timed out. Check the camera.' : error.message);
    } finally {
      clearTimeout(timeout);
      presetInFlight.current = false;
      setRecallingPreset(false);
    }
  };

  const scene = async (opts) => {
    const req = await fetch(`${base}/scene`, {
      method: 'POST', headers, body: JSON.stringify({ password, ...opts }),
    });
    await req.json();
  };

  const broadcast = async (opts) => {
    const req = await fetch(`${base}/broadcast`, {
      method: 'POST', headers, body: JSON.stringify({ password, ...opts }),
    });
    await req.json();
  };

  const doConfirm = () => {
    broadcast({ start: confirming });
    setConfirming();
  }

  const sceneButtons = {
    setScene: scene,
    currentScene,
  };

  return <div className="dashboard mt-3">
    <div className="d-flex flex-column">
      <Image width="320" height="180" {...imageProps}/>
      <div className="d-flex mt-3 gap-1">
        <Button size="sm" disabled={recallingPreset} title="Recall camera preset 1" onClick={() => recallPreset(1)}>Zoom In</Button>
        <Button size="sm" disabled={recallingPreset} title="Recall camera preset 2" onClick={() => recallPreset(2)}>Zoom Out</Button>
      </div>
      {presetError && <div className="preset-error" role="alert">{presetError}</div>}
      <div className="d-flex mt-3 gap-1">
        <SceneButton scene='Chapel' {...sceneButtons}/>
        <SceneButton scene='Sacrament' {...sceneButtons}/>
        <SceneButton scene='Blank' {...sceneButtons}/>
      </div>
      <div className="broadcast-camera-controls mt-5">
        <div className="broadcast-buttons d-flex gap-1">
        <Button size="sm" variant={streaming ? 'danger' : 'secondary'} onClick={() => setConfirming(false)}>Stop</Button>
        <Button size="sm" variant={streaming ? 'secondary' : 'success'}  onClick={() => setConfirming(true)}>Start</Button>
        { streaming && <Image width="30" height="30" src={Recording}/> }
        </div>
        <PtzControls base={base} password={password} onUnauthorized={() => setPassword('')}/>
      </div>
    </div>
    <Modal show={confirming !== undefined} onHide={() => setConfirming()}>
      <Header closeButton>
        <Title>Confirm {confirming ? 'Start' : 'Stop'}</Title>
      </Header>
      <Body>Are you sure?</Body>
      <Footer>
        <Button variant="secondary" onClick={() => setConfirming()}>No</Button>
        <Button variant="primary" onClick={doConfirm}>Yes</Button>
      </Footer>
    </Modal>
  </div>;
}

export default Dashboard;
