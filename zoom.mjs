import axios from 'axios';

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
