#!/usr/bin/env node
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { settings, lockProfile, withBrowser, readChannel } = require('./youtube-browser');

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node youtube-login.js\nRun on the desktop as the user who schedules broadcasts. Sign in, select the correct Studio channel, then close this dedicated Firefox window.');
    return;
  }
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error('Login needs a graphical desktop. Open a terminal in your Ubuntu RDP/desktop session and run this command there, without sudo.');
  }
  process.umask(0o077);
  const config = settings();
  const unlock = lockProfile(config);
  try {
    // Re-login must be verified again, even if a previous marker exists.
    fs.rmSync(config.marker, { force: true });
    console.log(`Opening a separate Firefox profile: ${config.profile}`);
    console.log('Sign in to YouTube Studio, complete Google verification, and select the broadcast channel.');
    console.log('Use English for the Studio interface. Then close ALL windows of this dedicated Firefox to save the login.');
    console.log('Your normal Firefox profile is not used. No password is stored in the scripts.');
    await new Promise((resolve, reject) => {
      const child = spawn(config.launcher, ['--no-remote', '--profile', config.profile, 'https://studio.youtube.com/?hl=en'], { stdio: 'ignore' });
      const stop = () => child.kill('SIGTERM');
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      const clean = () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); };
      child.once('error', error => { clean(); reject(new Error(`Could not launch Firefox: ${error.message}`)); });
      child.once('exit', (code, signal) => {
        clean();
        if (code !== 0 || signal) reject(new Error('Firefox login was interrupted. Run the login script again and close Firefox normally.'));
        else resolve();
      });
    });
    console.log('Checking that the saved login works in headless Firefox…');
    const channelId = await withBrowser(config, async driver => {
      await driver.get('https://studio.youtube.com/?hl=en');
      return readChannel(driver);
    });
    fs.writeFileSync(config.marker, JSON.stringify({ channelId, verifiedAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 });
    console.log(`Saved and verified YouTube browser login for channel ${channelId}.`);
    console.log('post.js can now configure Automatic Captions without an open desktop.');
  } finally { unlock(); }
}

if (require.main === module) main().catch(error => {
  console.error(`YouTube login setup failed: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { main };
