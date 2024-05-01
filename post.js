#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const process = require('process');

const { oauth2Client } = require('./api');
const { nextMeeting } = require('./next');
const { argv } = process;

const org = argv[2];
const title = argv[3] || 'Sacrament Meeting';
const next = nextMeeting({
  day: parseInt(argv[4]),
  hour: parseInt(argv[5]),
  minute: parseInt(argv[6]),
});

const orgDir = `./orgs/${org}`;
try { fs.mkdirSync(`${orgDir}`); } catch (e) {}

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
      scheduledStartTime: next.next.toISOString(),
      scheduledEndTime: next.nextEnd.toISOString(),
      title,
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
      closedCaptionsType: 'closedCaptionsEmbedded',
      enableLowLatency: true,
//      latencyPreference: 'ultraLow', // doesn't allow closed captions
    },
  };

  const resp = await axios.post(
    `https://youtube.googleapis.com/youtube/v3/liveBroadcasts?` +
    `part=snippet%2CcontentDetails%2Cstatus`,
    body, { headers });

  fs.writeFileSync(`${orgDir}/id.txt`, `${resp.data.id}\n`);
};

main();
