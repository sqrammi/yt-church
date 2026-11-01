# Stream dashboard

## Build and run

```bash
npm install
npm start
# Production build:
npm run build
```

## Runtime configuration

The browser fetches `config.json` beside the deployed `index.html` before starting
API requests. The request bypasses the browser cache. Edit this file on the asset
hosting server and reload the page to change settings without rebuilding JavaScript.
For local development, create the git-ignored `public/config.json`:

```json
{
  "apiBaseUrl": "https://alta.jeffhansen.com/api",
  "pollIntervalMs": 200
}
```

`apiBaseUrl` controls all dashboard API requests, including camera controls.
Absolute HTTP(S) URLs or same-origin relative paths are supported. A different API
origin must permit the dashboard origin through CORS. This file is public; do not
put passwords, API keys, or server-side configuration in it.

`pollIntervalMs` defaults to 200 ms (five attempts per second for both preview and
state, up to ten requests per second per dashboard). Requests for each endpoint do
not overlap, so slow responses reduce the actual rate. Set it to 1000 to restore
one-second polling. The minimum accepted value is 100 ms.

Configuration is read on page load, not continuously while a page is open. Missing
or invalid configuration produces a visible startup error instead of sending
requests to a fallback API. Configure the asset host/CDN to avoid caching this file,
for example with `Cache-Control: no-store`.

## Deploy

Build once, then deploy the same assets to different S3 locations with separate
runtime configs:

```bash
npm run build
./deploy.sh --base-url s3://first-bucket/stream/ --config /path/to/first.json
./deploy.sh --base-url s3://second-bucket/dashboard/ --config /path/to/second.json
```

`--config FILE` reads the selected JSON at deploy time, validates it before any
remote changes, and uploads it as `config.json` with `Cache-Control: no-store`.
Relative config paths are resolved from the directory where you run the command.
Keep environment-specific configs outside Git.

```bash
# Upload the current git-ignored public/config.json, even if edited after building:
./deploy.sh --base-url s3://first-bucket/stream/ --with-config
# Update assets while preserving that destination's existing config.json:
./deploy.sh --base-url s3://first-bucket/stream/
```

Without `--base-url`, deployment falls back to `baseUrl` in the repository root's
private `config.json`. When `--base-url` is supplied, that root config is not needed.
This destination URL is an S3 URL; the public HTTPS asset URL comes from your
bucket/CDN setup. It is separate from the runtime `apiBaseUrl`.

For a new destination, use `--config` or `--with-config` so the required runtime
file exists. No config is uploaded by default. No environment-specific config is
bundled into the JavaScript. Reload the page after changing the hosted JSON.

To change only the hosted runtime configuration, upload the edited public JSON
with `Content-Type: application/json` and `Cache-Control: no-store`; no rebuild is
required. Each new browser page load reads the new configuration.
