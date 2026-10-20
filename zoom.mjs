#!/usr/bin/env node

import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPtzController } from './ptz.mjs';

let defaultController;
function configuredController() {
  if (!defaultController) {
    const { ptz } = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
    defaultController = createPtzController(ptz);
  }
  return defaultController;
}

const invalidPreset = () => Object.assign(
  new Error('Specify preset=1 or preset=2 (legacy PresetID is also accepted)'),
  { status: 400 },
);

function presetNumber(value) {
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) value = Number(value);
  if (value !== 1 && value !== 2) throw invalidPreset();
  return value;
}

export async function zoom(params = {}, controller) {
  if (!params || typeof params !== 'object') throw invalidPreset();
  const preset = presetNumber(params.preset !== undefined ? params.preset : params.PresetID);
  if (params.preset !== undefined && params.PresetID !== undefined &&
      presetNumber(params.PresetID) !== preset) throw invalidPreset();
  // Numeric slots match the UI. Legacy PresetName is deliberately ignored.
  await (controller ?? configuredController()).recallPreset(preset);
}

export function parseZoomArgs(args) {
  const params = {};
  for (const arg of args) {
    const match = /^(preset|PresetID|PresetName)=(.*)$/.exec(arg);
    if (!match || Object.hasOwn(params, match[1])) throw invalidPreset();
    params[match[1]] = match[2];
  }
  return params;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await zoom(parseZoomArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`Preset recall failed: ${error.message}`);
    process.exitCode = 1;
  }
}
