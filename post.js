#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');

const { oauth2Client } = require('./api');
const { next, nextEnd } = require('./next');

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

  const body = {
    snippet: {
      scheduledStartTime: next.toISOString(),
      scheduledEndTime: nextEnd.toISOString(),
      title: 'Draper 7th Ward Sacrament Meeting',
      description: 'Sacrament Meeting',
    },
    status: {
      privacyStatus: 'unlisted',
      selfDeclaredMadeForKids: true,
    },
    contentDetails: {
      monitorStream: {
        enableMonitorStream: true,
      },
      enableDvr: true,
      enableLowLatency: true,
      latencyPreference: 'ultraLow',
    },
  };

  const resp = await axios.post(
    `https://youtube.googleapis.com/youtube/v3/liveBroadcasts?` +
    `part=snippet%2CcontentDetails%2Cstatus`,
    body, { headers });

  fs.writeFileSync('./id.txt', `${resp.data.id}\n`);
};

main();
