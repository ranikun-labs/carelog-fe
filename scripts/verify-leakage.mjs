import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ssr',
  'coverage',
  'playwright-report',
  'test-results',
]);
const excludedFiles = new Set([
  'README.md',
  'docs/provenance.md',
  'pnpm-lock.yaml',
  'scripts/verify-leakage.mjs',
]);
const textExtensions = new Set(['.html', '.js', '.mjs', '.json', '.md', '.ts', '.tsx', '.yaml']);
const forbiddenTerms = [
  ['finance', 'harness'].join(' '),
  ['finance', 'harness'].join('-'),
  ['jour', 'nal'].join(''),
  ['invest', 'ment'].join(''),
  ['ask', 'result'].join(' '),
  ['policy', 'guard'].join(' '),
  ['tick', 'er'].join(''),
  ['fo', 'mo'].join(''),
  ['투', '자'].join(''),
  ['매', '수'].join(''),
  ['매', '도'].join(''),
  ['종', '목'].join(''),
  ['수익', '률'].join(''),
  ['금', '융'].join(''),
  ['일', '지'].join(''),
  ['복', '기'].join(''),
  ['공부', '노트'].join(' '),
  ['목표', '가'].join(''),
  ['손절', '가'].join(''),
];
const forbidden = new RegExp(forbiddenTerms.join('|'), 'iu');
const productionBundleForbiddenTerms = [
  'customer-tenant-1',
  'customer-patient-1',
  'event-tenant-transitioned',
  'event-tenant-cancelled',
  'event-patient-immediate',
  'workspace-1',
  'workspace-2',
  'workspace-local',
  'fixture-account',
  '해담빌라',
  '단단정형',
  'FixtureStateProviders',
  'createFixtureProductPorts',
  'fixturePorts',
  'fixtures/scenarios',
  'fixtures/schedule',
];
const failures = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (excludedDirectories.has(name)) continue;
    const path = join(directory, name);
    const projectPath = relative(root, path);
    if (excludedFiles.has(projectPath)) continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (textExtensions.has(extname(name))) {
      const match = readFileSync(path, 'utf8').match(forbidden);
      if (match) failures.push(`${projectPath}: ${match[0]}`);
    }
  }
}

walk(root);

function scanProductionBundle(directoryName, required) {
  const directory = join(root, directoryName);
  if (!existsSync(directory)) {
    if (required) failures.push(`${directoryName}: production build output is missing`);
    else console.log(`[verify-leakage] ${directoryName} was removed by prerender after SSR use.`);
    return;
  }

  walkBundle(directory);
}

function walkBundle(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      walkBundle(path);
      continue;
    }

    const content = readFileSync(path, 'utf8');
    for (const term of productionBundleForbiddenTerms) {
      if (content.includes(term)) {
        failures.push(`${relative(root, path)}: fixture-only production bundle term ${term}`);
      }
    }
  }
}

scanProductionBundle('dist', true);
scanProductionBundle('dist-ssr', false);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('[verify-leakage] source and production bundles contain no fixture-only artifacts.');
}
