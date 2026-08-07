import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const manifestPath = join(root, '.prerender-manifest.json');
const expectedPaths = ['/en', '/en/features', '/ko', '/ko/features'];

if (!existsSync(manifestPath)) throw new Error('Pre-render manifest snapshot is missing.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (JSON.stringify(manifest.map(({ path }) => path).sort()) !== JSON.stringify(expectedPaths)) {
  throw new Error('Pre-render paths do not match the fixed four-path contract.');
}
for (const { outFile, locale } of manifest) {
  const output = join(dist, outFile);
  if (!existsSync(output)) throw new Error(`Missing output: ${outFile}`);
  const html = readFileSync(output, 'utf8');
  if (!html.includes(`lang="${locale}"`)) throw new Error(`Wrong lang in ${outFile}`);
  if (!html.includes('data-render-mode="prerender"')) {
    throw new Error(`Missing pre-render marker in ${outFile}`);
  }
  if (!html.includes('<title>Carelog</title>')) {
    throw new Error(`Wrong title in ${outFile}`);
  }
}
if (existsSync(join(root, 'dist-ssr'))) throw new Error('Temporary SSR output was not removed.');
console.log('[verify-prerender-output] four public paths verified.');
