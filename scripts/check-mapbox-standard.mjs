#!/usr/bin/env node
/**
 * Report when the live Mapbox Standard style, or the installed Mapbox GL, has
 * moved past what the offline pipeline was last checked against.
 *
 * A difference doesn't mean something broke. It means something new needs a
 * look: can it be downloaded, patched and served offline? Once it's handled,
 * update BASELINE below.
 *
 *   MAPBOX_ACCESS_TOKEN=pk... npm run check:mapbox-standard
 *
 * The token can also come from VITE_MAPBOX_ACCESS_TOKEN, in the environment or
 * in `.env`. Exits 1 on drift and 2 if the check itself can't run.
 */
import { existsSync, readFileSync } from 'node:fs';

const BASELINE = {
  /** `metadata["mapbox:compatibility"].js`: the Mapbox GL the style requires. */
  minimumRenderer: '3.30.0',
  topLevelKeys: [
    'bearing',
    'camera',
    'center',
    'color-theme',
    'created',
    'draft',
    'featuresets',
    'fog',
    'glyphs',
    'iconsets',
    'id',
    'indoor',
    'layers',
    'lights',
    'metadata',
    'models',
    'modified',
    'name',
    'owner',
    'pitch',
    'projection',
    'protected',
    'schema',
    'sources',
    'sprite',
    'terrain',
    'version',
    'visibility',
    'zoom',
  ],
  layerTypes: [
    'background',
    'building',
    'circle',
    'clip',
    'fill',
    'fill-extrusion',
    'line',
    'model',
    'slot',
    'symbol',
  ],
  sources: {
    '3dbuildings': 'batched-model mapbox://mapbox.mapbox-3dbuildings-v1',
    composite:
      'vector mapbox://mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8-lite,mapbox.mapbox-terrain-v3,mapbox.mapbox-models-v1',
    indoor: 'vector mapbox://mapbox.indoor-v3',
    'mapbox-3d-bridges': 'batched-model mapbox://mapbox.mapbox-3dbridges-v1',
    'mapbox-3d-events': 'batched-model mapbox://mapbox.mapbox-3d-events',
    'mapbox-dem': 'raster-dem mapbox://mapbox.mapbox-terrain-dem-v1',
    'mapbox-hd-roads': 'vector mapbox://mapbox.hd-road-v1-bounded',
    'mapbox-landmark-pois': 'vector mapbox://mapbox.mapbox-landmark-pois-v1',
    'mapbox-landmarks': 'raster-array mapbox://mapbox.mapbox-landmark-icons-v1',
    'procedural-buildings': 'vector mapbox://mapbox.procedural-buildings-v1',
  },
};

function readToken() {
  const fromEnv = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (fromEnv) return fromEnv;
  if (!existsSync('.env')) return undefined;
  const match = readFileSync('.env', 'utf8').match(/^VITE_MAPBOX_ACCESS_TOKEN=["']?([^"'\s]+)/m);
  return match?.[1];
}

/** Report what was added to or removed from a list, so one change gives one line. */
function diffLists(label, baseline, live, issues) {
  for (const item of live) {
    if (!baseline.includes(item)) issues.push(`New ${label}: ${item}`);
  }
  for (const item of baseline) {
    if (!live.includes(item)) issues.push(`Removed ${label}: ${item}`);
  }
}

function compareStyle(style, issues) {
  const required = style.metadata?.['mapbox:compatibility']?.js;
  if (required !== BASELINE.minimumRenderer) {
    issues.push(`Required Mapbox GL changed: ${BASELINE.minimumRenderer} -> ${required}`);
  }

  // `imports` returning would send the style back through resolveImports.
  diffLists('top-level key', BASELINE.topLevelKeys, Object.keys(style), issues);
  diffLists(
    'layer type',
    BASELINE.layerTypes,
    Array.from(new Set(style.layers.map(layer => layer.type))),
    issues
  );

  for (const [id, source] of Object.entries(style.sources)) {
    const live = `${source.type} ${source.url}`;
    const known = BASELINE.sources[id];
    if (known === undefined) issues.push(`New source: ${id} (${live})`);
    else if (known !== live) issues.push(`Changed source: ${id}: ${known} -> ${live}`);
  }
  for (const id of Object.keys(BASELINE.sources)) {
    if (!style.sources[id]) issues.push(`Removed source: ${id}`);
  }
}

/** The versioned files the installed renderer fetches must match what gets cached. */
function compareRenderer(issues) {
  const rendererPath = 'node_modules/mapbox-gl/dist/mapbox-gl-dev.js';
  const sharedPath = 'src/sw/shared.ts';
  if (!existsSync(rendererPath)) {
    throw new Error(`${rendererPath} not found; run npm install`);
  }
  const renderer = readFileSync(rendererPath, 'utf8');
  const shared = readFileSync(sharedPath, 'utf8');
  const assetList = shared.match(/MAPBOX_RUNTIME_ASSETS = \[([\s\S]*?)\]/)?.[1] ?? '';

  for (const name of ['DRACO_URL', 'MESHOPT_URL', 'MESHOPT_SIMD_URL', 'RTL_TEXT_URL', 'BUILDING_GEN_URL']) {
    const path = renderer.match(new RegExp(`\\b${name}: "([^"]+)"`))?.[1];
    if (!path) issues.push(`Mapbox GL no longer declares ${name}`);
    else if (!assetList.includes(`'${new URL(path, 'https://api.mapbox.com').pathname}'`)) {
      issues.push(`${name} isn't in MAPBOX_RUNTIME_ASSETS: ${path}`);
    }
  }
}

const token = readToken();
if (!token) {
  console.error('Set MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_ACCESS_TOKEN in .env).');
  process.exit(2);
}

const issues = [];
let style;
try {
  const response = await fetch(
    `https://api.mapbox.com/styles/v1/mapbox/standard?access_token=${token}`
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  style = await response.json();
  compareStyle(style, issues);
  compareRenderer(issues);
} catch (error) {
  console.error(`The check could not run: ${error.message.replaceAll(token, '<token>')}`);
  process.exit(2);
}

console.log(`Mapbox Standard, modified ${style.modified}`);
if (issues.length > 0) {
  console.log(`${issues.length} difference(s) to review:`);
  for (const issue of issues) console.log(`  - ${issue}`);
  process.exit(1);
}
console.log('No drift: the style and the renderer match the baseline.');
