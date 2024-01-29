#!/usr/bin/env node

import axios from 'axios';
import esMain from 'es-main';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const config = require('./config.json');
const { camIP, camUsername, camPassword } = config;

const zoom = async ({ PresetID, PresetName }) => {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded', 
    'Cookie': `userName=${btoa(camUsername)}; password: ${btoa(camPassword)}`,
  };
  const data = {
    ReqUserName: btoa(camUsername),
    ReqUserPwd: btoa(camPassword),
    CmdData: JSON.stringify({
      Cmd: "ReqPresetCtrl",
      Content: {
        PresetCmd: "Call",
        PresetID,
        PresetName,
      }
    }),
  };

  const resp = await axios.post(`http://${camIP}/cmdparse`, data, { headers });
};

export { zoom };

// PresetID=2 PresetName=Center
if (esMain(import.meta)) {
  const { argv } = process;
  const params = argv.slice(2).reduce((a, v) => {
    const key = v.replace(/^([^=]+)=.*/, '$1');
    const value = v.replace(/^([^=]+)=(.*)/, '$2');
    if (value.match(/^[0-9]+$/))
      a[key] = parseInt(value);
    else a[key] = value;
    return a;
  }, {});
  await zoom(params);
}
