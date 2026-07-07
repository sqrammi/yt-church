#!/usr/bin/env node

import OBSWebSocket from 'obs-websocket-js';
import process from 'process';
import fs from 'fs';
import axios from 'axios';
import { oauth2Client } from './api.js';

const { argv } = process;

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { obsPassword } = require('./config.json');
const apiKey = String(fs.readFileSync('./api-key.txt')).trim();
const org = String(fs.readFileSync(`./orgs/current`)).trim();
const orgDir = `./orgs/${org}`;
const id = String(fs.readFileSync(`${orgDir}/id.txt`)).trim();

oauth2Client.setCredentials({
  refresh_token: String(fs.readFileSync('./refresh-token.txt')).trim(),
});

const login = async () => {
  return (await oauth2Client.refreshAccessToken()).credentials.access_token;
};

// stop obs too
let obs = new OBSWebSocket();

const stopObs = async () => {
  await obs.connect('ws://127.0.0.1:3002', obsPassword);
  try {
    await obs.call('StopStream');
  } catch (e) {
    // 500/501 at least means that it's already stopped
    if (e.code !== 500 && e.code !== 501)
      throw e;
  }
  await obs.disconnect();
};

const main = async () => {
  if (process.argv[2] !== '-C')
    await stopObs();

  const accessToken = await login();

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: `application/json`,
    'Content-Type': `application/json`,
  };

  try {
    const resp = await axios.post(
      `https://youtube.googleapis.com/youtube/v3/liveBroadcasts/transition?` +
      `broadcastStatus=complete&id=${id}`, '',
      { headers });
  } catch (e) {
    if (!e.response?.data?.error?.message?.match(/Redundant transition/))
      throw e;
  }

//  console.log('resp', resp.data);
};

main();
