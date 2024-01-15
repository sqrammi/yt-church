#!/usr/bin/env node

const { oauth2Client } = require('./api');

const main = async () => {
  const code = process.argv[2];
  const { tokens } = await oauth2Client.getToken(code);
  console.log('tokens', tokens);
};

main();
