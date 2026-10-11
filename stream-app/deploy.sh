#!/bin/sh
set -eu

cd -- "$(dirname -- "$0")"
deploy_url=$(node -p "require('../config.json').baseUrl")

if [ ! -f build/index.html ]; then
  echo 'Build stream-app before deploying: npm run build' >&2
  exit 1
fi

aws s3 rm --recursive "$deploy_url"
aws s3 cp build/ "$deploy_url" --recursive --exclude "*.map"
