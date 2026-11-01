#!/bin/sh
set -eu

invocation_dir=$(pwd)
cd -- "$(dirname -- "$0")"

deploy_url=
upload_config=false
config_file="$PWD/public/config.json"

usage() {
  cat <<'HELP'
Usage: ./deploy.sh [--base-url s3://BUCKET/PREFIX/] [--with-config | --config FILE]

  --base-url URL  Override baseUrl from the repository root's config.json.
  --with-config   Upload the current public/config.json (no rebuild required).
  --config FILE   Upload another runtime config, relative to your working directory.
  --help          Show this help.

Without a config option, the destination's existing config.json is preserved.
HELP
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-url)
      [ "$#" -ge 2 ] && [ -n "$2" ] || { echo '--base-url requires an S3 URL' >&2; exit 1; }
      deploy_url=$2
      shift 2
      ;;
    --with-config)
      upload_config=true
      shift
      ;;
    --config)
      [ "$#" -ge 2 ] && [ -n "$2" ] || { echo '--config requires a JSON file' >&2; exit 1; }
      case "$2" in
        /*) config_file=$2 ;;
        *) config_file="$invocation_dir/$2" ;;
      esac
      upload_config=true
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

if [ -z "$deploy_url" ]; then
  deploy_url=$(node -p "require('../config.json').baseUrl")
fi

node - "$deploy_url" <<'CHECK_URL'
const value = process.argv[2];
try {
  const url = new URL(value);
  if (url.protocol !== 's3:' || !url.hostname || url.search || url.hash || url.username || url.password)
    throw new Error();
} catch {
  console.error('Deployment destination must be an S3 URL, e.g. s3://bucket/stream/');
  process.exit(1);
}
CHECK_URL

if [ ! -f build/index.html ]; then
  echo 'Build stream-app before deploying: npm run build' >&2
  exit 1
fi

# Validate before changing anything on the destination.
if [ "$upload_config" = true ]; then
  node - "$config_file" <<'CHECK_CONFIG'
const fs = require('fs');
try {
  const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim())
    throw new Error('apiBaseUrl is required');
  const url = new URL(config.apiBaseUrl.trim(), 'https://dashboard.example/');
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash)
    throw new Error('apiBaseUrl must be an HTTP(S) URL without a query or fragment');
  const interval = config.pollIntervalMs ?? 200;
  if (!Number.isInteger(interval) || interval < 100)
    throw new Error('pollIntervalMs must be an integer of at least 100 milliseconds');
} catch (error) {
  console.error(`Invalid runtime config: ${error.message}`);
  process.exit(1);
}
CHECK_CONFIG
fi

aws s3 rm --recursive "$deploy_url" --exclude "config.json"
aws s3 cp build/ "$deploy_url" --recursive --exclude "*.map" --exclude "config.json"

if [ "$upload_config" = true ]; then
  aws s3 cp "$config_file" "${deploy_url%/}/config.json" \
    --content-type application/json --cache-control no-store
fi
