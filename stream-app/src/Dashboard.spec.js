import { act, render } from '@testing-library/react';
import Dashboard from './Dashboard';

const config = { apiBaseUrl: 'https://runtime.example.com/api', pollIntervalMs: 200 };

beforeEach(() => {
  jest.useFakeTimers();
  let image = 0;
  URL.createObjectURL = jest.fn(() => `blob:${++image}`);
  URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn(async url => url.endsWith('/snap') ? {
    headers: { get: () => 'image/jpeg' }, blob: async () => new Blob(),
  } : { json: async () => ({ streaming: false, scene: 'Chapel' }) });
});

afterEach(() => {
  jest.useRealTimers();
  delete global.fetch;
});

async function mount() {
  let view;
  await act(async () => {
    view = render(<Dashboard config={config} password="test" setPassword={jest.fn()} />);
  });
  return view;
}

test('uses the runtime API and polls each endpoint five times per second', async () => {
  const view = await mount();
  for (let i = 0; i < 5; i++) {
    await act(async () => { jest.advanceTimersByTime(200); });
  }
  expect(fetch.mock.calls.filter(([url]) => url === `${config.apiBaseUrl}/snap`)).toHaveLength(6);
  expect(fetch.mock.calls.filter(([url]) => url === `${config.apiBaseUrl}/state`)).toHaveLength(6);
  view.unmount();
});

test('does not stack slow requests and aborts them when the dashboard closes', async () => {
  fetch.mockImplementation(() => new Promise(() => {}));
  const view = await mount();
  act(() => { jest.advanceTimersByTime(2000); });
  expect(fetch).toHaveBeenCalledTimes(2);
  const signals = fetch.mock.calls.map(([, options]) => options.signal);
  view.unmount();
  expect(signals.every(signal => signal.aborted)).toBe(true);
});

test('releases previous preview images and the last image on close', async () => {
  const view = await mount();
  await act(async () => { jest.advanceTimersByTime(200); });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2');
});
