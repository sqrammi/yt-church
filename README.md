
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
