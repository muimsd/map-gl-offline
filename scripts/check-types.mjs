#!/usr/bin/env node
/**
 * Compile a consumer file against the built `dist/index.d.ts` under each
 * moduleResolution a user might pick, and fail unless the types are real in all
 * of them. Issue #88: with extensionless relative specifiers, node16/nodenext
 * dropped `export *` re-exports and typed `OfflineMapManager` as `any`, while
 * `bundler` looked fine.
 *
 *   npm run check:types      (after `rollup -c`; `npm run build` runs it)
 *
 * The consumer resolves the package by name through a symlink, the way an
 * installed copy would. Library checking is on, so errors inside our
 * declarations count too; other packages' declaration files are ignored.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const declarations = path.join(root, 'dist', 'index.d.ts');

if (!fs.existsSync(declarations)) {
  console.error('dist/index.d.ts is missing. Run `rollup -c` first.');
  process.exit(2);
}

// The bundle must import nothing but packages: a relative or `@/` specifier
// is what breaks node16/nodenext.
const source = fs.readFileSync(declarations, 'utf8');
const badSpecifiers = [...source.matchAll(/(?:from|import\()\s*['"]((?:\.|@\/)[^'"]*)['"]/g)].map(
  match => match[1]
);
if (badSpecifiers.length > 0) {
  console.error(`dist/index.d.ts has relative or alias imports: ${badSpecifiers.join(', ')}`);
  process.exit(1);
}

// Every package the types import must be a dependency, or consumers who don't
// install it (an optional peer like maplibre-gl, or a dev-only @types package)
// get "Cannot find module" as soon as they check library types.
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dependencies = new Set(Object.keys(pkg.dependencies ?? {}));
const packageName = specifier =>
  specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
const typesPackage = name =>
  `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;
const missing = [
  ...new Set(
    // Statements only: JSDoc examples in the file also contain `from '...'`.
    [...source.matchAll(/^(?:import|export)\b[^'"]*?\bfrom\s+['"]([^'"]+)['"]/gm)].map(match =>
      packageName(match[1])
    )
  ),
].filter(name => !dependencies.has(name) && !dependencies.has(typesPackage(name)));
if (missing.length > 0) {
  console.error(`dist/index.d.ts imports packages that aren't dependencies: ${missing.join(', ')}`);
  process.exit(1);
}
for (const name of ['sql.js']) {
  if (source.includes(`from '${name}'`) && !dependencies.has(typesPackage(name))) {
    console.error(
      `dist/index.d.ts imports ${name}, which ships no types: add ${typesPackage(name)} to dependencies`
    );
    process.exit(1);
  }
}

const consumer = `
import { OfflineMapManager, TileService, type OfflineRegionOptions } from 'map-gl-offline';

const manager = new OfflineMapManager();
void manager.downloadRegion(
  {
    id: 'downtown',
    name: 'Downtown',
    bounds: [[-74.02, 40.7], [-73.97, 40.75]],
    minZoom: 10,
    maxZoom: 16,
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  },
  { onProgress: ({ overallPercentage }) => console.log(overallPercentage.toFixed(0)) }
);
// Must fail: proves OfflineMapManager is typed, not \`any\`.
const notANumber: number = manager.downloadRegion;
export type { OfflineRegionOptions };
export { TileService, notANumber };
`;
const EXPECTED_LINE = consumer.split('\n').findIndex(line => line.includes('notANumber: number'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'map-gl-offline-types-'));
try {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  fs.writeFileSync(path.join(dir, 'consumer.ts'), consumer);
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.symlinkSync(root, path.join(dir, 'node_modules', 'map-gl-offline'), 'dir');

  const modes = [
    {
      name: 'nodenext',
      module: ts.ModuleKind.NodeNext,
      resolution: ts.ModuleResolutionKind.NodeNext,
    },
    { name: 'node16', module: ts.ModuleKind.Node16, resolution: ts.ModuleResolutionKind.Node16 },
    { name: 'bundler', module: ts.ModuleKind.ESNext, resolution: ts.ModuleResolutionKind.Bundler },
  ];

  const failures = [];
  for (const mode of modes) {
    const program = ts.createProgram([path.join(dir, 'consumer.ts')], {
      module: mode.module,
      moduleResolution: mode.resolution,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      types: [],
    });
    // Library checking is on, but only our declarations and the consumer count:
    // other packages' .d.ts files have their own issues under strict settings.
    const ours = [fs.realpathSync(path.join(dir, 'consumer.ts')), fs.realpathSync(declarations)];
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter(d => !d.file || ours.includes(fs.realpathSync(d.file.fileName)));
    const describe = d =>
      `${d.file ? path.relative(root, fs.realpathSync(d.file.fileName)) : ''} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
    // Exactly one error, the deliberate one in consumer.ts.
    const expected = diagnostics.filter(
      d =>
        d.code === 2322 &&
        d.file?.fileName.endsWith('consumer.ts') &&
        d.file.getLineAndCharacterOfPosition(d.start ?? 0).line === EXPECTED_LINE
    );
    const unexpected = diagnostics.filter(d => !expected.includes(d));
    if (expected.length !== 1 || unexpected.length > 0) {
      failures.push(
        `${mode.name}: ${expected.length === 1 ? '' : 'types resolved to any. '}${unexpected
          .slice(0, 5)
          .map(describe)
          .join(' | ')}`
      );
    } else {
      console.log(`ok   ${mode.name}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\nThe published types are broken for some consumers:\n  ${failures.join('\n  ')}`
    );
    process.exit(1);
  }
  console.log('The types resolve under nodenext, node16 and bundler.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
