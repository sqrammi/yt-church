#!/usr/bin/env node

import OBSWebSocket from 'obs-websocket-js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { save } from './sheet.mjs';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const app = express();
const { obsPassword, webPassword } = require('./config.json');
const port = 3003;
let obs = new OBSWebSocket();
let obsConnected = false;

// API: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

const getCurrentScene = async () => {
  return (await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
};

//    await obs.call('SetCurrentProgramScene', { sceneName: 'Sacrament' });
//    console.log('scene', await getCurrentScene());
//  await obs.call('StartStream');
//  await obs.call('StopStream');

const obsConnect = async () => {
  await obs.connect('ws://127.0.0.1:3002', obsPassword);
  obsConnected = true;
};

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
//  console.log('got', req.url);
  // For Safari, for now
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT');
  next();
});

app.post('/login', async (req, res) => {
  console.log('body', req.body);
  if (req.body?.password !== webPassword)
    return;
  res.send({ success: true });
});

app.post('/shot', async (req, res) => {
  console.log('body', req.body);
  if (req.body?.password !== webPassword)
    return;
  if (obsConnected) {
    res.set('Content-Type', 'image/jpeg');
    const data = (await obs.call('GetSourceScreenshot', {
      sourceName: 'Chapel', imageHeight: 240, imageFormat: "jpeg" })).imageData;
    res.end(Buffer.from(atob(data.split('base64,')[1]), 'binary'));
  }
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

app.post('/sacrament', async (req, res) => {
  const code = String(fs.readFileSync('code.txt')).trim();
  const id = String(fs.readFileSync('id.txt')).trim();
  const ret = { success: false };

  if (code === req.body.pass) {
    ret.success = true;
    ret.url = `https://youtube.com/live/${id}`;
    poster.names.push({ name: req.body.name, email: req.body.email });
    posterSave();
  }

  res.send(ret);
});

app.listen(port, () => {
  console.log(`Running on port ${port}`)
});

obsConnect();
