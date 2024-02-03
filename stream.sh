#!/bin/sh -xe

echo "$1" >orgs/current

./obs.mjs SetCurrentProgramScene sceneName=Blank
sleep 2
./obs.mjs SetCurrentProgramScene sceneName=Chapel

./zoom.mjs PresetID=2 PresetName=Center

./obs.mjs StartStream
sleep 20

./bind.js "$1"
sleep 20

./testing.js "$1"
sleep 20

./live.js "$1"
