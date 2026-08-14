import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const artifactPath = join(root, '.artifacts', 'verify-full', 'latest');
const artifactDirectory = '.artifacts/verify-full/latest';
const phases = [
  { name: 'verify', command: 'pnpm verify', args: ['verify'] },
  { name: 'test-e2e', command: 'pnpm test:e2e', args: ['test:e2e'] },
];
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

rmSync(artifactPath, { recursive: true, force: true });
mkdirSync(artifactPath, { recursive: true });

const manifest = {
  runner: 'scripts/verify-full.mjs',
  command: 'pnpm verify:full',
  artifactDirectory,
  status: 'running',
  startedAt: new Date().toISOString(),
  phases: [],
};

function writeManifest() {
  mkdirSync(artifactPath, { recursive: true });
  writeFileSync(join(artifactPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function runPhase(phase, index) {
  return new Promise((resolve) => {
    const phaseDirectory = join(
      artifactPath,
      `${String(index + 1).padStart(2, '0')}-${phase.name}`,
    );
    mkdirSync(phaseDirectory, { recursive: true });
    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    const startedAt = new Date().toISOString();
    const child = spawn(pnpmCommand, phase.args, {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
      process.stderr.write(chunk);
    });

    const finish = (exitCode, signal, error) => {
      if (settled) return;
      settled = true;
      if (error) {
        const errorOutput = Buffer.from(`${error.stack ?? error}\n`);
        stderrChunks.push(errorOutput);
        process.stderr.write(errorOutput);
      }

      mkdirSync(phaseDirectory, { recursive: true });
      writeFileSync(join(phaseDirectory, 'stdout.log'), Buffer.concat(stdoutChunks));
      writeFileSync(join(phaseDirectory, 'stderr.log'), Buffer.concat(stderrChunks));
      const result = {
        name: phase.name,
        command: phase.command,
        args: phase.args,
        status: exitCode === 0 ? 'passed' : 'failed',
        exitCode,
        signal,
        startedAt,
        finishedAt: new Date().toISOString(),
        stdout: relative(root, join(phaseDirectory, 'stdout.log')),
        stderr: relative(root, join(phaseDirectory, 'stderr.log')),
      };
      writeFileSync(join(phaseDirectory, 'phase.json'), `${JSON.stringify(result, null, 2)}\n`);
      resolve(result);
    };

    child.once('error', (error) => finish(1, null, error));
    child.once('close', (exitCode, signal) => finish(exitCode ?? 1, signal, null));
  });
}

writeManifest();

for (const [index, phase] of phases.entries()) {
  const result = await runPhase(phase, index);
  manifest.phases.push(result);
  if (result.status === 'failed') {
    manifest.status = 'failed';
    manifest.failedPhase = result;
    manifest.finishedAt = new Date().toISOString();
    writeManifest();
    console.error(
      `[verify:full] failed phase: ${result.name}; exit code: ${result.exitCode}; evidence: ${artifactDirectory}`,
    );
    process.exitCode = result.exitCode || 1;
    break;
  }
  writeManifest();
}

if (manifest.status === 'running') {
  manifest.status = 'passed';
  manifest.finishedAt = new Date().toISOString();
  writeManifest();
  console.log(`[verify:full] passed; evidence: ${artifactDirectory}`);
}
