#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const process = require('process');

const { oauth2Client } = require('./api');
const { nextMeeting } = require('./next');
const { argv } = process;

const args = argv.slice(2);
let weeks = 0;
let argOffset = 0;

if (args[0] === '-w') {
  weeks = Number.parseInt(args[1], 10) || 0;
  argOffset = 2;
}

const org = args[argOffset];
const title = args[argOffset + 1] || 'Sacrament Meeting';
const next = nextMeeting({
  day: Number.parseInt(args[argOffset + 2], 10),
  hour: Number.parseInt(args[argOffset + 3], 10),
  minute: Number.parseInt(args[argOffset + 4], 10),
});
const weekOffsetMs = weeks * 7 * 86400 * 1000;

if (weekOffsetMs) {
  next.next = new Date(next.next.getTime() + weekOffsetMs);
  next.nextEnd = new Date(next.nextEnd.getTime() + weekOffsetMs);
}

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
//      enableLowLatency: true,
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
