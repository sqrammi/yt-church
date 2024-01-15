#!/usr/bin/env node

const { oauth2Client } = require('./api');
const fs = require('fs');
const axios = require('axios');

const apiKey = String(fs.readFileSync('./api-key.txt')).trim();
const id = String(fs.readFileSync('./id.txt')).trim();

oauth2Client.setCredentials({
  refresh_token: String(fs.readFileSync('./refresh-token.txt')).trim(),
});

const login = async () => {
  return (await oauth2Client.refreshAccessToken()).credentials.access_token;
};

const main = async () => {
  const accessToken = await login();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: `application/json`,
//    'Content-Type': `application/json`,
  };

  let resp = await axios.get(
    `https://youtube.googleapis.com/youtube/v3/liveStreams?mine=true`,
    { headers });

  const active = resp.data.items.filter(item => item.status.streamStatus === 'active');

  if (!active.length) {
    console.error('no active streams');
    return;
  }

  const stream = active[0];
  resp = await axios.post(
    `https://youtube.googleapis.com/youtube/v3/liveBroadcasts/bind?` +
    `id=${id}&streamId=${stream.id}`, '',
    { headers });

  console.log(resp.data);
};

main();
