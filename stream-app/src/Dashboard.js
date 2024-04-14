import black from './SMPTE_Color_Bars.svg';
import Recording from './recording.svg';
import './Dashboard.css';

const { useCallback, useEffect, useRef, useState } = require('react');
const { Image, Button, Modal } = require('react-bootstrap');
const { Header, Title, Body, Footer } = Modal;

const base = `https://alta.jeffhansen.com/api`;

const headers = {
  'Content-type': 'application/json',
};

function SceneButton({ scene, setScene, currentScene }) {
  return <Button size="sm" variant={scene === currentScene ? 'primary' : 'secondary'}
    onClick={() => setScene({ scene })}>{scene}</Button>
}

function Dashboard({ password, setPassword }) {
  const [ image, setImage ] = useState('');
  const [ confirming, setConfirming ] = useState();
  const [ currentScene, setCurrentScene ] = useState('unknown');
  const [ streaming, setStreaming ] = useState();

  const loadingImage = useRef({});
  const loadingState = useRef({});

  const loadImage = useCallback(async () => {
    if (loadingImage.current.loading)
      return;

    loadingImage.current.loading = true;
    try {
      const req = await fetch(`${base}/snap`, {
        method: 'POST', headers, body: JSON.stringify({ password }),
      });

      if (req.headers.get('content-type') === 'image/jpeg')
        setImage(URL.createObjectURL(await req.blob()));
      else {
        const resp = await req.json();
        if (resp.unauthorized)
          setPassword('');
        else setImage(black);
      }
    } catch (e) {
      console.log('error getting image', e);
      setPassword('');
    }
    delete loadingImage.current.loading;
  }, [ password, setPassword ]);

  const loadState = useCallback(async () => {
    if (loadingState.current.loading)
      return;

    loadingState.current.loading = true;
    try {
      const req = await fetch(`${base}/state`, {
        method: 'POST', headers, body: JSON.stringify({ password }),
      });

      const resp = await req.json();
      setStreaming(!!resp?.streaming);
      setCurrentScene(resp?.scene || 'unknown');
    } catch (e) {
      console.log('error getting state', e);
    }
    delete loadingState.current.loading;
  }, [ password, setStreaming ]);

  useEffect(() => {
    const intervalImage = setInterval(loadImage, 1000);
    const intervalState = setInterval(loadState, 1000);
    return () => {
      clearInterval(intervalImage);
      clearInterval(intervalState);
    }
  }, [ loadImage, loadState ]);

  const imageProps = {};
  imageProps.src = image || black;

  const zoom = async (opts) => {
    const req = await fetch(`${base}/zoom`, {
      method: 'POST', headers, body: JSON.stringify({ password, ...opts }),
    });
    await req.json();
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
        <Button size="sm" onClick={() => zoom({ PresetID: 2, PresetName: 'Center' })}>Zoom In</Button>
        <Button size="sm" onClick={() => zoom({ PresetID: 0, PresetName: 'Center-Out1' })}>Zoom Out</Button>
      </div>
      <div className="d-flex mt-3 gap-1">
        <SceneButton scene='Chapel' {...sceneButtons}/>
        <SceneButton scene='Sacrament' {...sceneButtons}/>
        <SceneButton scene='Blank' {...sceneButtons}/>
      </div>
      <div className="d-flex mt-5 gap-1">
        <Button size="sm" variant={streaming ? 'danger' : 'secondary'} onClick={() => setConfirming(false)}>Stop</Button>
        <Button size="sm" variant={streaming ? 'secondary' : 'success'}  onClick={() => setConfirming(true)}>Start</Button>
        { streaming && <Image width="30" height="30" src={Recording}/> }
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
