#!/bin/sh -xe

./obs.mjs SetCurrentProgramScene sceneName=Blank
sleep 2
./obs.mjs SetCurrentProgramScene sceneName=Chapel

./zoom.mjs PresetID=2 PresetName=Center

./obs.mjs StartStream
sleep 20

./bind.js
sleep 20

./testing.js
sleep 20

./live.js
