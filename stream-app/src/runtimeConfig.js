export async function loadRuntimeConfig() {
  const response = await fetch(new URL('config.json', document.baseURI), {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not load config.json (HTTP ${response.status})`);
  const config = await response.json();
  if (typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim())
    throw new Error('config.json must contain apiBaseUrl');
  const apiUrl = new URL(config.apiBaseUrl.trim(), document.baseURI);
  if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.search || apiUrl.hash)
    throw new Error('apiBaseUrl must be an HTTP(S) URL without a query or fragment');
  const pollIntervalMs = config.pollIntervalMs ?? 200;
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 100)
    throw new Error('pollIntervalMs must be an integer of at least 100 milliseconds');
  return { apiBaseUrl: apiUrl.href.replace(/\/+$/, ''), pollIntervalMs };
}
