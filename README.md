
Creating lambda execution role for SNS->Lambda:
https://docs.aws.amazon.com/lambda/latest/dg/with-sns-example.html

Build and run google auth app:
1. cd auth-app
2. npm i
3. cp src/creds.json.in src/creds.json
4. Edit src/creds.json and put in Google client ID and secret
5. npm run start
6. Authenticate (if it doesn't work, make sure referer URLs match in
   console.cloud.google.com API OAuth 2.0 Client ID), then grab auth code from
   app's console window.
7. cd ..
8. cp api.js.in api.js
9. Edit api.js and put in Google client ID and secret, and make sure referer matches
10. ./auth-code.js <AUTH_CODE (from step 6)>
11. Store refresh token in refresh-token.txt

Get video ready:
./post.js
Start stream
./bind.js
./testing.js
./live.js

Viewer code:
code.txt

Camera controls in stream-app:
- Copy the `ptz` object from `config.json.in` into the server's existing
  `config.json`. Use the camera address reachable from server.mjs; the RL500
  currently uses `192.168.109.97`, raw VISCA TCP port `5678`.
- No camera password or OBS PTZ plugin is needed. `/ptz` uses the existing
  dashboard password. The browser cannot choose the target address or speed.
- Restart server.mjs and rebuild/redeploy stream-app with its normal process.
  A web-only forward such as localhost:3333 does not forward the VISCA port.
- Hold the controls beside Start/Stop to pan, tilt, or zoom continuously;
  release to stop. Mouse, touch, and holding Enter/Space on a focused button
  are supported. Pan/tilt default to speed 2; zoom uses its slowest speed, 0.
  Pan speed can be 1–24, tilt 1–20, and zoom 0–7; smaller values are slower.
- Release, lost pointer capture, leaving the tab/window, and unmounting the
  controls send stop commands. While held, the browser renews a server lease;
  the server stops after 1.5 seconds without renewal. Delayed requests cannot
  revive a stopped hold or stop a newer one. Concurrent movements are rejected,
  and failed stops are retried on a fresh connection. Older clients can still
  use the short-nudge API (configured by nudgeMs).
  A network/power loss can still prevent delivery; errors are shown in the UI.
- Zoom In recalls camera preset 1 and Zoom Out recalls camera preset 2 over
  VISCA. Save these slots in the RL500 web UI; recalling does not overwrite
  them. These restore the saved framing (pan, tilt, and zoom), using the
  camera's preset recall speed, independently of the slow manual controls.
  The server waits up to 30 seconds for completion and rejects simultaneous
  moves. The +/− buttons provide manual hold-to-zoom control. NDI video and OBS
  scenes are unaffected.
- Test the TCP controller without a camera: `node --test ptz.test.mjs`.

Broadcast startup recalls camera preset 1 using `./zoom.mjs preset=1` before
starting the OBS stream. `zoom.mjs` uses the same VISCA TCP controller and
`config.json`'s `ptz.host`/`ptz.port` as the UI; camera HTTP credentials and
named presets are no longer used. Supported slots are 1 and 2, matching the UI.
Legacy `PresetID=1` is accepted; `PresetName` is ignored when a numeric slot is
provided. Recall waits for camera completion (up to 30 seconds), and failure
exits nonzero so `stream.sh` stops before starting the broadcast.
The legacy `/zoom` endpoint shares the UI's controller and movement lock.
The standalone CLI talks directly to the camera and does not share the server's
in-process lock; avoid UI camera movements while startup is recalling a preset.
Test both paths without moving a real camera: `node --test ptz.test.mjs zoom.test.mjs`.
