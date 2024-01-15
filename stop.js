#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

const { oauth2Client } = require('./api');
const { next, nextEnd } = require('./next');

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
    'Content-Type': `application/json`,
  };

  const resp = await axios.post(
    `https://youtube.googleapis.com/youtube/v3/liveBroadcasts/transition?` +
    `broadcastStatus=complete&id=${id}`, '',
    { headers });

  console.log('resp', resp.data);
};

main();
