#!/bin/sh -xe

NOCAM=

while [ "$1" ]; do
  case $1 in
  -C) NOCAM=1; shift;;
  *) break;;
  esac
done

echo "$1" >orgs/current

if [ "$NOCAM" ]; then
  echo Please ensure that you are already streaming to Youtube with the Stake key
  sleep 5
else
  ./obs.mjs SetCurrentProgramScene sceneName=Blank
  sleep 2
  ./obs.mjs SetCurrentProgramScene sceneName=Chapel

  ./zoom.mjs PresetID=2 PresetName=Center

  ./obs.mjs StartStream
  sleep 20
fi

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
