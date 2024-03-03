#!/bin/sh -xe

echo "$1" >orgs/current

./obs.mjs SetCurrentProgramScene sceneName=Blank
sleep 2
./obs.mjs SetCurrentProgramScene sceneName=Chapel

./zoom.mjs PresetID=2 PresetName=Center

./obs.mjs StartStream
sleep 20

retry() {
  local TO=5
  while ! "$@" && [ "$TO" -gt 0 ]; do TO=$((TO-1)); sleep 5; done
  if [ "$TO" = 0 ]; then exit 1; fi
}

retry ./bind.js "$1"
sleep 20

retry ./testing.js "$1"
sleep 25

retry ./live.js "$1"
