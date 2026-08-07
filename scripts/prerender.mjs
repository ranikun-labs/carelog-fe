import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrEntry = join(root, 'dist-ssr', 'entry-server.js');
const snapshot = join(root, '.prerender-manifest.json');
const rootPlaceholder = '<div id="root"></div>';
const langPlaceholder = '<html lang="ko">';

async function main() {
  const template = readFileSync(join(dist, 'index.html'), 'utf8');
  if (!template.includes(rootPlaceholder) || !template.includes(langPlaceholder)) {
    throw new Error('Client template placeholders do not match the pre-render contract.');
  }
  const { render, PRERENDER_MANIFEST } = await import(ssrEntry);
  for (const { path, outFile, locale } of PRERENDER_MANIFEST) {
    const markedRoot = `<div id="root" data-render-mode="prerender">${render(path)}</div>`;
    const html = template
      .replace(rootPlaceholder, markedRoot)
      .replace(langPlaceholder, `<html lang="${locale}">`);
    const output = join(dist, outFile);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, html, 'utf8');
    console.log(`[prerender] ${path} -> dist/${outFile}`);
  }
  writeFileSync(snapshot, JSON.stringify(PRERENDER_MANIFEST, null, 2), 'utf8');
  rmSync(join(root, 'dist-ssr'), { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
