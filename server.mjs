#!/usr/bin/env node

import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';
import express from 'express';
import child_process from 'child_process';
import cors from 'cors';
import fs from 'fs';
import { save } from './sheet.mjs';
import { zoom } from './zoom.mjs';
import { createPtzController } from './ptz.mjs';
import { createObsConnection } from './obs-connection.mjs';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const app = express();
const { obsPassword, obsCamScene, webPassword, ptz: ptzConfig } = require('./config.json');
const ptz = createPtzController(ptzConfig);
const port = 3003;
const obs = createObsConnection({
  createClient: () => new OBSWebSocket(),
  url: 'ws://127.0.0.1:3002',
  password: obsPassword,
  eventSubscriptions: EventSubscription.All,
});

// API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

console.log('Always run this in a loop!');
const getCurrentScene = async () => {
  try {
    return (await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
  } catch (e) {
    return 'unknown';
  }
};

//    await obs.call('SetCurrentProgramScene', { sceneName: 'Sacrament' });
//    console.log('scene', await getCurrentScene());
//  await obs.call('StartStream');
//  await obs.call('StopStream');

var allowlist = ['https://s3-us-west-2.amazonaws.com', 'https://draper7.org'];
var corsOptionsDelegate = function (req, callback) {
  var corsOptions;
//  console.log('origin', req.header('Origin'));
  if (allowlist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response
  } else {
    corsOptions = { origin: false }; // disable CORS for this request
  }
  callback(null, corsOptions); // callback expects two parameters: error and options
}

if (false) {
app.options('*', cors(corsOptionsDelegate));
app.post('*', cors(corsOptionsDelegate));
app.get('*', cors(corsOptionsDelegate));
}
app.use(express.json());

app.use((req, res, next) => {
  if (req.method !== 'OPTIONS' && !req.url.match(/^\/(snap|zoom|scene|broadcast|sacrament|state)/))
    console.log(req.method, req.url);
  // TODO: Lock down
  res.set('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT');
  next();
});

app.options((req, res, next) => {
  res.send(200);
});

const sendJson = ({ res, body }) => {
  res.set('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const obsFailure = (res, error) => res.status(error?.status || 502).json({
  success: false,
  connected: obs.connected,
  error: error?.message || 'OBS is disconnected; reconnecting',
});

const authorized = ({ req, res }) => {
  if (req.body?.password !== webPassword) {
    sendJson({ res, body: { unauthorized: true }});
    return false;
  } else return true;
};

app.post('/login', async (req, res) => {
  if (!authorized({ req, res }))
    return;
  sendJson({ res, body: { success: true }});
});

app.post('/snap', async (req, res) => {
  if (!authorized({ req, res }))
    return;
  if (obs.connected) {
    try {
      const data = (await obs.call('GetSourceScreenshot', {
        sourceName: obsCamScene, imageHeight: 240, imageFormat: "jpeg" })).imageData;
      res.set('Content-Type', 'image/jpeg');
      res.end(Buffer.from(atob(data.split('base64,')[1]), 'binary'));
    } catch (e) {
      if (obs.connected && !e.message.match(/Failed to render screenshot/))
        console.log('snap error', e);
      return obsFailure(res, e);
    }
  } else return obsFailure(res, { status: 503 });
});

app.post('/zoom', async (req, res) => {
  if (!authorized({ req, res }))
    return;
  await zoom({ ...req.body });
});

app.post('/ptz', async (req, res) => {
  if (!authorized({ req, res })) return;
  try {
    if (req.body.control === 'start') {
      const holdId = await ptz.startHold(req.body.action);
      return res.json({ success: true, holdId });
    }
    if (req.body.control === 'keepalive') ptz.keepHold(req.body.holdId);
    else if (req.body.control === 'stop') await ptz.stopHold(req.body.holdId);
    else if (req.body.control) return res.status(400).json({ success: false, error: 'Unknown PTZ control' });
    else if (req.body.action === 'preset') await ptz.recallPreset(req.body.preset);
    else await ptz.nudge(req.body.action);
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 502).json({ success: false, error: error.message });
  }
});

app.post('/scene', async (req, res) => {
  if (!authorized({ req, res }))
    return;
  const { scene } = req.body;
  if (obs.connected) {
    try {
      await obs.call('SetCurrentProgramScene', { sceneName: scene });
    } catch (e) {
      console.log('scene error', e);
      return obsFailure(res, e);
    }
  } else return obsFailure(res, { status: 503 });

  sendJson({ res, body: { success: true }});
});

app.post('/broadcast', async (req, res) => {
  if (!authorized({ req, res }))
    return;
  const { start } = req.body;
  if (obs.connected) {
    try {
      await obs.call(`${start ? 'Start' : 'Stop'}Stream`);
      if (!start) {
        const org = String(fs.readFileSync(`orgs/current`)).trim();
        child_process.exec(`./stop.mjs`);
      }
    } catch (e) {
      console.log('broadcast error', e);
      return obsFailure(res, e);
    }
  } else return obsFailure(res, { status: 503 });

  sendJson({ res, body: { success: true }});
});

app.post('/test', async (req, res) => {
  console.log('body', req.body);
  sendJson({ res, body: { success: true }});
});

const poster = { names: [], staged: [] };

const posterSave = async () => {
  if (!poster.running) {
    poster.running = true;
    poster.staged = poster.names;
    poster.names = [];
    await save(poster.staged);
    poster.running = false;
  } else {
    if (poster.timeout)
      clearTimeout(poster.timeout);
    poster.timeout = setTimeout(() => {
      posterSave();
    }, 3000);
  }
};

app.post('/state', async (req, res) => {
  if (!authorized({ req, res }))
    return;
  const scene = await getCurrentScene();
  res.send({ success: obs.connected, connected: obs.connected, streaming: obs.streaming, scene });
});

app.post('/sacrament', async (req, res) => {
  const { pass, name, email, org } = req.body;
  const orgDir = `./orgs/${parseInt(org)}`;
  let code;
  try {
    code = String(fs.readFileSync(`${orgDir}/code.txt`)).trim();
  } catch (e) {}
  const id = String(fs.readFileSync(`${orgDir}/id.txt`)).trim();
  const ret = { success: false };

  if (!code || code === pass) {
    ret.success = true;
    ret.url = `https://youtube.com/live/${id}`;
    poster.names.push({ name, email, org });
    posterSave();
  }

  res.send(ret);
});

app.listen(port, () => {
  console.log(`Running on port ${port}`)
});

obs.start();
