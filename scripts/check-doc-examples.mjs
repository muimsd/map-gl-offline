#!/usr/bin/env node
/**
 * Compile every TypeScript example in the docs and README against the library's
 * real types, so an example can't quietly go stale.
 *
 *   npm run check:docs
 *
 * Examples are fragments, so names they commonly assume, such as `region` and
 * `map`, are declared below. Exits 1 if an example doesn't compile.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const DOCS_DIR = path.join(root, 'docs/docs');
// Written for an older version, and kept as history.
const SKIP = new Set(['migration-0.6.md']);

/** Names examples can use without declaring them. */
const AMBIENT = `
import type {
  OfflineManagerControl as Control,
  OfflineManagerControlOptions,
  OfflineMapManager,
  OfflineRegionOptions,
} from 'map-gl-offline';
declare global {
  const offlineManager: OfflineMapManager;
  const control: Control;
  const OfflineManagerControl: typeof import('map-gl-offline').OfflineManagerControl;
  const options: OfflineManagerControlOptions;
  const region: OfflineRegionOptions;
  const styleUrl: string;
  const newStyleUrl: string;
  const map: import('mapbox-gl').Map;
  const mapboxgl: typeof import('mapbox-gl').default;
  const maplibregl: typeof import('maplibre-gl');
  const progressBar: HTMLProgressElement;
  const statusText: HTMLElement;
}
export {};
`;

const SOURCE_MODULES = `
declare module '*?worker&url' {
  const url: string;
  export default url;
}
`;

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') && !SKIP.has(entry.name) ? [full] : [];
  });
}

const files = [...markdownFiles(DOCS_DIR), path.join(root, 'README.md')];
// Inside the project, so that packages resolve from node_modules.
const outDir = path.join(root, '.docs-examples');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);
const origins = new Map();
let count = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/^( *)```(?:ts|typescript)\n([\s\S]*?)^\1```/gm)) {
    const line = text.slice(0, match.index).split('\n').length;
    const name = `example-${count++}.ts`;
    origins.set(name, `${path.relative(root, file)}:${line}`);
    // `export {}` makes each example its own module, so their names can't clash.
    fs.writeFileSync(path.join(outDir, name), `${match[2]}\nexport {};\n`);
  }
}

fs.writeFileSync(path.join(outDir, 'ambient.d.ts'), AMBIENT);
fs.writeFileSync(path.join(outDir, 'modules.d.ts'), SOURCE_MODULES);

const project = path.join(outDir, 'tsconfig.json');
fs.writeFileSync(
  project,
  JSON.stringify({
    extends: '../tsconfig.json',
    // Resolved from this folder, one level inside the project.
    compilerOptions: {
      noEmit: true,
      rootDir: '..',
      declaration: false,
      noUnusedLocals: false,
      paths: {
        'map-gl-offline': ['../src/index.ts'],
        'map-gl-offline/vite-plugin': ['../bin/vite-plugin.js'],
        '@/*': ['../src/*'],
      },
      allowJs: true,
      types: ['node', 'vite/client'],
    },
    include: [],
    files: [
      ...fs.readdirSync(outDir).map(name => path.join(outDir, name)),
    ],
  })
);

let exitCode = 0;
try {
  execFileSync('npx', ['tsc', '-p', project, '--pretty', 'false'], { stdio: 'pipe', cwd: root });
  console.log(`${count} examples compile.`);
} catch (error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  const lines = output.split('\n').filter(Boolean);
  const inExamples = lines.filter(line => line.includes('example-'));
  if (inExamples.length === 0) {
    console.error(output);
    exitCode = 2;
  } else {
    for (const line of inExamples) {
      console.error(
        line.replace(/^.*?(example-\d+\.ts)/, (_, name) => origins.get(name) ?? name)
      );
    }
    console.error(`\n${inExamples.length} problem(s) in the docs' examples.`);
    exitCode = 1;
  }
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
process.exit(exitCode);
