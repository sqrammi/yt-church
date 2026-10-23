#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const process = require('process');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { requireLogin } = require('./youtube-browser');

const execFileAsync = promisify(execFile);

const main = async (args = process.argv.slice(2)) => {
  // Fail before creating a broadcast if browser login has never been set up.
  requireLogin();

  const { oauth2Client } = require('./api');
  const { nextMeeting } = require('./next');
  let weeks = 0;
  let argOffset = 0;

  if (args[0] === '-w') {
    weeks = Number.parseInt(args[1], 10) || 0;
    argOffset = 2;
  }

  const org = args[argOffset];
  if (!/^[a-zA-Z0-9_-]+$/.test(org || '')) throw new Error('Usage: node post.js [-w WEEKS] ORG TITLE DAY HOUR MINUTE');
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
  fs.mkdirSync(orgDir, { recursive: true });

  oauth2Client.setCredentials({
    refresh_token: String(fs.readFileSync('./refresh-token.txt')).trim(),
  });

  const login = async () => {
    return (await oauth2Client.refreshAccessToken()).credentials.access_token;
  };

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
      // The public API has no Automatic Captions option. The browser step below
      // enables it in Studio; disabled here alone does NOT enable auto captions.
      closedCaptionsType: 'closedCaptionsDisabled',
      latencyPreference: 'normal',
    },
  };

  const resp = await axios.post(
    `https://youtube.googleapis.com/youtube/v3/liveBroadcasts?` +
    `part=snippet%2CcontentDetails%2Cstatus`,
    body, { headers });

  fs.writeFileSync(`${orgDir}/id.txt`, `${resp.data.id}\n`);
  try {
    // Capture helper output; successful scheduled runs must be completely quiet
    // because cron emails any stdout/stderr. Surface diagnostics only on failure.
    await execFileAsync(process.execPath, [
      path.join(__dirname, 'youtube-captions.js'), resp.data.id,
      '--channel', resp.data.snippet.channelId,
    ], { timeout: 240000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    // Preserve the ID: retry captions on this broadcast, not post.js (which
    // would create another one). Never print Axios request/auth objects.
    const detail = error.stderr?.trim() || error.message;
    throw new Error(`Broadcast ${resp.data.id} WAS CREATED, but Automatic Captions could not be verified.\n` +
      `${detail}\n` +
      `The broadcast ID remains in ${orgDir}/id.txt. Do not rerun post.js for this event.\n` +
      `Retry: node youtube-captions.js ${resp.data.id}\n` +
      `Studio: https://studio.youtube.com/video/${resp.data.id}/livestreaming`);
  }
};

if (require.main === module) main().catch(error => {
  console.error(`post.js failed: ${error.response?.data?.error?.message || error.message}`);
  process.exitCode = 1;
});

module.exports = { main };
