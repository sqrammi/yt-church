#!/usr/bin/env node

const process = require('process');
const fs = require('fs');
const axios = require('axios');

const { argv } = process;
const org = argv[2];
const orgDir = `./orgs/${org}`;
const { oauth2Client } = require('./api');
const { next, nextEnd } = require('./next');

const apiKey = String(fs.readFileSync('./api-key.txt')).trim();
const id = String(fs.readFileSync(`${orgDir}/id.txt`)).trim();

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
    `broadcastStatus=testing&id=${id}`, '',
    { headers });

  if (resp.data?.status?.lifeCycleStatus === 'testStarting')
    process.exit(0);
  else {
    console.log(resp.data);
    process.exit(-1);
  }
};

main();
