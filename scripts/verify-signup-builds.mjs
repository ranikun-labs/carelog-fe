import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = await mkdtemp(path.join(tmpdir(), 'carelog-signup-builds-'));
const cases = [
  { mode: 'production', flag: undefined, enabled: false },
  { mode: 'carelog-dev', flag: undefined, enabled: false },
  { mode: 'production', flag: 'true', enabled: false },
  { mode: 'carelog-dev', flag: 'false', enabled: false },
  { mode: 'carelog-dev', flag: 'true', enabled: true },
];
let browser;
try {
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ['--no-sandbox'],
  });
  for (const scenario of cases) {
    const outDir = path.join(root, `${scenario.mode}-${scenario.flag}`);
    const buildEnv = { ...process.env, VITE_CARELOG_API_BASE_URL: 'https://gateway.example.test' };
    if (scenario.flag === undefined) delete buildEnv.VITE_CARELOG_SIGNUP_ENABLED;
    else buildEnv.VITE_CARELOG_SIGNUP_ENABLED = scenario.flag;
    const result = spawnSync(
      './node_modules/.bin/vite',
      ['build', '--mode', scenario.mode, '--outDir', outDir],
      {
        encoding: 'utf8',
        env: buildEnv,
      },
    );
    if (result.status !== 0) throw new Error(`Build failed: ${result.stderr || result.stdout}`);
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url ?? '/', 'http://localhost');
        let file = path.join(outDir, decodeURIComponent(url.pathname));
        if (!file.startsWith(`${outDir}/`) || !(await stat(file).catch(() => null))?.isFile())
          file = path.join(outDir, 'index.html');
        const extension = path.extname(file);
        response.setHeader(
          'Content-Type',
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.woff2': 'font/woff2',
          }[extension] ?? 'application/octet-stream',
        );
        response.end(await readFile(file));
      } catch {
        response.writeHead(500).end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const page = await browser.newPage({ locale: 'ko-KR' });
      await page.goto(`http://127.0.0.1:${server.address().port}/auth/signup`);
      const field = page.locator('#signup-email');
      const unavailable = page.getByText('현재 회원가입을 사용할 수 없습니다.');
      if (scenario.enabled) await field.waitFor({ state: 'visible' });
      else await unavailable.waitFor({ state: 'visible' });
      if ((await field.count()) !== (scenario.enabled ? 1 : 0))
        throw new Error(`Unexpected signup capability: ${scenario.mode}/${scenario.flag}`);
      await page.close();
      process.stdout.write(
        `${scenario.mode} flag=${scenario.flag}: ${scenario.enabled ? 'enabled' : 'disabled'}\n`,
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }
} finally {
  await browser?.close();
  await rm(root, { recursive: true, force: true });
}
