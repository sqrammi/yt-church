#!/usr/bin/env node

const { oauth2Client } = require('./api');
const fs = require('fs');

oauth2Client.setCredentials({
  refresh_token: String(fs.readFileSync('./refresh-token.txt')).trim(),
});

oauth2Client.refreshAccessToken()
.then(res => {
  console.log('res', res.credentials.access_token);
});
