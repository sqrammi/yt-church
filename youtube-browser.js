// Shared Firefox profile and YouTube Studio UI support. No cookies are exported.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { By, error: webdriverError } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');

const AUTO_CAPTIONS = 'Automatic captions (English only)';
const SETUP_HINT = 'Run node youtube-login.js from the Ubuntu desktop as the same user that runs post.js.';

function settings(env = process.env) {
  // A non-hidden home directory is accessible to Ubuntu's Snap Firefox too.
  const profile = path.resolve(env.YT_FIREFOX_PROFILE || path.join(os.homedir(), 'yt-church-browser'));
  const snap = process.platform === 'linux' && !env.YT_FIREFOX_BINARY && fs.existsSync('/snap/bin/firefox');
  return {
    profile,
    marker: path.join(profile, 'yt-church-login.json'),
    binary: env.YT_FIREFOX_BINARY || (snap ? '/snap/firefox/current/usr/lib/firefox/firefox' :
      process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox'),
    launcher: env.YT_FIREFOX_BINARY || (snap ? '/snap/bin/firefox' :
      process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox'),
    driver: env.YT_GECKODRIVER || (snap ?
      (fs.existsSync('/snap/bin/geckodriver') ? '/snap/bin/geckodriver' : '/snap/bin/firefox.geckodriver') : undefined),
    snap,
  };
}

function requireLogin(config = settings()) {
  try {
    const saved = JSON.parse(fs.readFileSync(config.marker, 'utf8'));
    if (!/^UC[\w-]{22}$/.test(saved.channelId)) throw new Error('Invalid channel ID');
    return saved;
  } catch {
    throw new Error(`YouTube browser login is not set up at ${config.profile}. ${SETUP_HINT}`);
  }
}

function lockProfile(config) {
  fs.mkdirSync(config.profile, { recursive: true, mode: 0o700 });
  fs.chmodSync(config.profile, 0o700);
  const lock = path.join(config.profile, 'yt-church-automation.lock');
  let fd;
  try {
    fd = fs.openSync(lock, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Firefox profile is in use (lock: ${lock}). Close the login/setup process first. ` +
      'After a crashed run, remove this lock only after confirming its PID and the dedicated Firefox are no longer running.');
  }
  fs.writeFileSync(fd, `${process.pid}\n`);
  fs.closeSync(fd);
  return () => fs.rmSync(lock, { force: true });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function withBrowser(config, task, { headed = false, timeout = 180000 } = {}) {
  if (config.snap && !fs.existsSync(config.driver)) {
    throw new Error('Snap Firefox requires /snap/bin/geckodriver or /snap/bin/firefox.geckodriver. Check snap aliases firefox, or set YT_GECKODRIVER to the matching Snap driver.');
  }
  const options = new firefox.Options()
    .addArguments('--no-remote', '--profile', config.profile)
    .setPreference('intl.accept_languages', 'en-US,en');
  if (config.binary !== 'firefox') options.setBinary(config.binary);
  if (!headed) options.addArguments('-headless');
  // In-place profiles retain refreshed login cookies. setProfile() copies them.
  // Explicit Marionette port avoids geckodriver's in-place-profile port bug.
  const service = new firefox.ServiceBuilder(config.driver)
    .addArguments('--marionette-port', String(await freePort())).build();
  let driver;
  let timer;
  let rejectInterrupted;
  const interrupted = new Promise((_, reject) => { rejectInterrupted = reject; });
  const stop = () => rejectInterrupted(new Error('Firefox caption setup was interrupted.'));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    const work = async () => {
      driver = firefox.Driver.createSession(options, service);
      await driver.getSession();
      await driver.manage().setTimeouts({ implicit: 0, pageLoad: 45000, script: 10000 });
      await driver.manage().window().setRect({ width: 1440, height: 1100 });
      return task(driver);
    };
    return await Promise.race([work(), interrupted, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firefox caption setup timed out. Check the login and network, then retry.')), timeout);
    })]);
  } finally {
    clearTimeout(timer);
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    let quitTimer;
    try {
      await Promise.race([driver?.quit().catch(() => {}), new Promise(resolve => { quitTimer = setTimeout(resolve, 8000); })]);
    } finally {
      clearTimeout(quitTimer);
      await service.kill().catch(() => {});
    }
  }
}

async function namedElement(driver, selector, name) {
  for (const element of await driver.findElements(By.css(selector))) {
    if (await element.isDisplayed() && await element.getAccessibleName() === name) return element;
  }
  return null;
}

async function assertSignedIn(driver) {
  if (new URL(await driver.getCurrentUrl()).hostname === 'accounts.google.com') {
    throw new Error(`YouTube login expired or needs verification. ${SETUP_HINT}`);
  }
  for (const dialog of await driver.findElements(By.css('[role="dialog"]'))) {
    if (await dialog.isDisplayed() && /verify it.s you|sign in again/i.test(await dialog.getText())) {
      throw new Error(`YouTube requires Google verification. ${SETUP_HINT}`);
    }
  }
}

async function waitFor(driver, description, predicate, timeout = 30000) {
  try {
    return await driver.wait(async () => {
      await assertSignedIn(driver);
      try { return await predicate(); } catch (error) {
        if (error instanceof webdriverError.StaleElementReferenceError || error instanceof webdriverError.NoSuchElementError) return false;
        throw error;
      }
    }, timeout, description, 400);
  } catch (error) {
    if (error instanceof webdriverError.TimeoutError) {
      throw new Error(`${description}. Check the selected YouTube channel, login, and English Studio language; the Studio UI may also have changed. ${SETUP_HINT}`);
    }
    throw error;
  }
}

async function readChannel(driver) {
  return waitFor(driver, 'Could not identify the signed-in Studio channel', async () => {
    const link = await namedElement(driver, 'a[href*="/channel/"]', 'YouTube Studio dashboard');
    return link && (await link.getAttribute('href')).match(/\/channel\/(UC[\w-]{22})(?:[/?]|$)/)?.[1];
  });
}

async function getVisible(driver, selector) {
  for (const element of await driver.findElements(By.css(selector))) {
    if (await element.isDisplayed()) return element;
  }
  return null;
}

async function captionState(driver) {
  const toggle = await getVisible(driver, '#captions-enabled-toggle');
  const normal = await getVisible(driver, '#latency-normal');
  const source = await namedElement(driver, 'ytls-closed-captions-settings-renderer input[role="button"]', 'Captions source');
  const language = await namedElement(driver, 'ytls-closed-captions-settings-renderer input[role="button"]', 'Source language');
  return {
    enabled: toggle && await toggle.getAttribute('aria-pressed') === 'true',
    normal: normal && await normal.getAttribute('aria-checked') === 'true',
    source: source ? await source.getAttribute('value') : null,
    language: language ? await language.getAttribute('value') : null,
  };
}

function isConfigured(state) {
  return state.enabled && state.normal && state.source === AUTO_CAPTIONS && state.language === 'English';
}

async function clickEnabled(element, description) {
  if (!await element.isEnabled() || await element.getAttribute('aria-disabled') === 'true') {
    throw new Error(`${description} is disabled in Studio. Configure captions before starting the broadcast.`);
  }
  await element.click();
}

async function configurePage(driver, { channelId, checkOnly = false, timeout = 30000 } = {}) {
  const actualChannel = await readChannel(driver);
  if (actualChannel !== channelId) throw new Error(`Wrong YouTube channel: expected ${channelId}, found ${actualChannel}. ${SETUP_HINT}`);
  await waitFor(driver, 'Closed captions settings did not appear', () => getVisible(driver, '#captions-enabled-toggle'), timeout);
  if (!checkOnly) {
    let state = await captionState(driver);
    if (!state.normal) {
      await clickEnabled(await getVisible(driver, '#latency-normal'), 'Normal latency');
      await waitFor(driver, 'Normal latency was not selected', async () => (await captionState(driver)).normal, timeout);
    }
    if (!state.enabled) {
      await clickEnabled(await getVisible(driver, '#captions-enabled-toggle'), 'Closed captions');
      await waitFor(driver, 'Closed captions did not turn on', async () => (await captionState(driver)).enabled, timeout);
    }
    const source = await waitFor(driver, 'Caption source selector did not appear', () =>
      namedElement(driver, 'ytls-closed-captions-settings-renderer input[role="button"]', 'Captions source'), timeout);
    if (await source.getAttribute('value') !== AUTO_CAPTIONS) {
      await clickEnabled(source, 'Caption source');
      const option = await waitFor(driver, 'Automatic captions is not available for this broadcast', () =>
        namedElement(driver, '[role="option"]', AUTO_CAPTIONS), timeout);
      await clickEnabled(option, 'Automatic captions');
    }
  }
  await waitFor(driver, 'Automatic English captions and normal latency were not confirmed', async () => isConfigured(await captionState(driver)), timeout);
  // Leave time for Studio's debounced autosave request before navigating away.
  await new Promise(resolve => setTimeout(resolve, 2000));
  // Studio autosaves. Verify on a fresh load; never trust the optimistic toggle.
  // Retry read-only reloads to allow a slow autosave without toggling it again.
  for (let attempt = 0; attempt < 3; attempt++) {
    await driver.navigate().refresh();
    const refreshedChannel = await readChannel(driver);
    if (refreshedChannel !== channelId) throw new Error('YouTube channel changed while verifying captions.');
    await waitFor(driver, 'Caption settings did not reload', () => getVisible(driver, '#captions-enabled-toggle'), timeout);
    try {
      await waitFor(driver, 'Caption settings were not saved', async () => isConfigured(await captionState(driver)), Math.min(timeout, 5000));
      return;
    } catch (error) { if (attempt === 2) throw error; }
  }
}

module.exports = { settings, requireLogin, lockProfile, withBrowser, readChannel, configurePage, captionState, isConfigured, SETUP_HINT };
