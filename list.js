#!/usr/bin/env node

const { oauth2Client } = require('./api');
const fs = require('fs');
const axios = require('axios');

const apiKey = String(fs.readFileSync('./api-key.txt')).trim();

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

  const resp = await axios.get(
    `https://youtube.googleapis.com/youtube/v3/liveBroadcasts?mine=true`,
    { headers });

  console.log(JSON.stringify(resp.data));
};

main();
