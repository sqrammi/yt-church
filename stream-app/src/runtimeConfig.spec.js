import { loadRuntimeConfig } from './runtimeConfig';

beforeEach(() => {
  const base = document.createElement('base');
  base.href = 'https://assets.example.com/church/stream/';
  document.head.appendChild(base);
  global.fetch = jest.fn();
});

afterEach(() => {
  document.querySelector('base').remove();
  delete global.fetch;
});

function respond(config) {
  fetch.mockResolvedValue({ ok: true, json: async () => config });
}

test('loads uncached configuration beside a nested deployment and normalizes the API URL', async () => {
  respond({ apiBaseUrl: 'https://api.example.com/api/', pollIntervalMs: 200 });
  await expect(loadRuntimeConfig()).resolves.toEqual({
    apiBaseUrl: 'https://api.example.com/api', pollIntervalMs: 200,
  });
  expect(fetch.mock.calls[0][0].href).toBe('https://assets.example.com/church/stream/config.json');
  expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-store' });
});

test('supports same-origin API paths and defaults to five polls per second', async () => {
  respond({ apiBaseUrl: '/api' });
  await expect(loadRuntimeConfig()).resolves.toEqual({
    apiBaseUrl: 'https://assets.example.com/api', pollIntervalMs: 200,
  });
});

test.each([
  [{}, 'apiBaseUrl'],
  [{ apiBaseUrl: 'javascript:alert(1)' }, 'HTTP(S)'],
  [{ apiBaseUrl: '/api', pollIntervalMs: 0 }, 'pollIntervalMs'],
  [{ apiBaseUrl: '/api', pollIntervalMs: '200' }, 'pollIntervalMs'],
])('rejects invalid runtime settings: %j', async (config, error) => {
  respond(config);
  await expect(loadRuntimeConfig()).rejects.toThrow(error);
});

test('reports a missing configuration file', async () => {
  fetch.mockResolvedValue({ ok: false, status: 404 });
  await expect(loadRuntimeConfig()).rejects.toThrow('HTTP 404');
});
