import black from './SMPTE_Color_Bars.svg';
import './Dashboard.css';

const { useEffect, useRef, useState } = require('react');
const { Image, Button } = require('react-bootstrap');

const base = `http://draper600ts.jeffhansen.com:3003`;

const headers = {
  'Content-type': 'application/json',
};

function Dashboard({ password, setPassword }) {
  const [ image, setImage ] = useState('');

  const loading = useRef({});

  const loadImage = async () => {
    if (loading.current.loading)
      return;

    loading.current.loading = true;
    try {
      const req = await fetch(`${base}/snap`, {
        method: 'POST', headers, body: JSON.stringify({ password }),
      });

      if (req.headers.get('content-type') === 'image/jpeg')
        setImage(URL.createObjectURL(await req.blob()));
      else setImage(black);
    } catch (e) {
      console.log('error getting image', e);
      setPassword('');
    }
    delete loading.current.loading;
  };

  useEffect(() => {
    const interval = setInterval(loadImage, 1000);
    return () => clearInterval(interval);
  }, []);

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

  return <div className="dashboard mt-3">
    <div className="d-flex flex-column">
      <Image width="320" height="240" {...imageProps}/>
      <div className="d-flex mt-1 gap-1">
        <Button size="sm" onClick={() => zoom({ PresetID: 2, PresetName: 'Center' })}>Zoom In</Button>
        <Button size="sm" onClick={() => zoom({ PresetID: 0, PresetName: 'Center-Out1' })}>Zoom Out</Button>
      </div>
      <div className="d-flex mt-1 gap-1">
        <Button size="sm" onClick={() => scene({ scene: 'Chapel' })}>Chapel</Button>
        <Button size="sm" onClick={() => scene({ scene: 'Sacrament' })}>Sacrament</Button>
        <Button size="sm" onClick={() => scene({ scene: 'Blank' })}>Blank</Button>
      </div>
      <div className="d-flex mt-5 gap-1">
        <Button size="sm" onClick={() => broadcast({ start: false })}>Stop</Button>
        <Button size="sm" onClick={() => broadcast({ start: true })}>Start</Button>
      </div>
    </div>
  </div>;
}

export default Dashboard;
