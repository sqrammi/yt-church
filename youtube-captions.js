#!/usr/bin/env node
const { settings, requireLogin, lockProfile, withBrowser, configurePage } = require('./youtube-browser');

async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Usage: node youtube-captions.js VIDEO_ID [--channel CHANNEL_ID] [--headed] [--check]\nConfigures Automatic English captions and Normal latency, then reloads to verify. --check only verifies.');
    return;
  }
  const [videoId, ...flags] = args;
  if (!/^[\w-]{11}$/.test(videoId || '')) throw new Error('Provide the 11-character YouTube broadcast ID. See --help.');
  let channelId;
  let headed = false;
  let checkOnly = false;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--channel') {
      channelId = flags[++i];
      if (!/^UC[\w-]{22}$/.test(channelId || '')) throw new Error('Invalid --channel ID.');
    } else if (flags[i] === '--headed') headed = true;
    else if (flags[i] === '--check') checkOnly = true;
    else throw new Error(`Unknown option: ${flags[i]}`);
  }
  process.umask(0o077);
  const config = settings();
  const login = requireLogin(config);
  if (channelId && channelId !== login.channelId) {
    throw new Error(`Browser login is for ${login.channelId}, but broadcast belongs to ${channelId}. Run node youtube-login.js and choose the correct channel.`);
  }
  const unlock = lockProfile(config);
  try {
    await withBrowser(config, async driver => {
      await driver.get(`https://studio.youtube.com/video/${videoId}/livestreaming?hl=en`);
      await configurePage(driver, { channelId: channelId || login.channelId, checkOnly });
    }, { headed });
    console.log(`Verified ${videoId}: Automatic captions (English only), Normal latency; saved settings survived reload.`);
  } finally { unlock(); }
}

if (require.main === module) main().catch(error => {
  console.error(`YouTube caption setup failed: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { main };
