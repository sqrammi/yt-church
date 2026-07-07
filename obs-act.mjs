#!/usr/bin/env node

import OBSWebSocket from 'obs-websocket-js';
import process from 'process';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { argv } = process;
const { obsPassword, webPassword } = require('./config.json');
const obs = new OBSWebSocket();

const params = argv.slice(3).reduce((a, v) => {
  const key = v.replace(/^([^=]+)=.*/, '$1');
  const value = v.replace(/^([^=]+)=(.*)/, '$2');
  if (value.match(/^[0-9]+$/))
    a[key] = parseInt(value);
  else a[key] = value;
  return a;
}, {});

const obsConnect = async () => {
  await obs.connect('ws://127.0.0.1:3002', obsPassword);
  console.log('got', await obs.call('GetSourceActive', {
    sourceName: 'RTSP',
  }));
  await obs.disconnect();
};

obsConnect();
