/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/*
 * Finance FE(finance-fe) Foundation 복사본의 드리프트 가드. 공유 패키지가 없는 동안의 임시 방식이다.
 * - verbatim: 출처 헤더 1줄을 뺀 본문이 상류 7dd9590 본문과 sha256까지 같아야 한다.
 * - derived: 로컬 패치가 있는 파일. 파일이 바뀌면 lock의 localSha256과 patches를 같이 갱신해야 통과한다
 *   (= 리뷰어가 패치 목록을 확인하는 지점).
 * 의도적 갱신 절차는 docs/design/carelog/README.md 의 "복사본 갱신" 절을 따른다.
 */
const root = path.resolve(__dirname, '../../..');
type LockEntry = {
  path: string;
  upstreamPath: string;
  mode: 'verbatim' | 'derived';
  upstreamSha256: string;
  /** 기본 출처(lock.source.sha)와 다른 커밋에서 가져온 파일(예: 이후 추가된 Field/Notice)의 전체 SHA. */
  sourceSha?: string;
  localSha256?: string;
  patches?: string[];
};
const lock = JSON.parse(readFileSync(path.join(root, 'design-foundation.lock.json'), 'utf8')) as {
  source: { sha: string; foundationVersion: string };
  files: LockEntry[];
};
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const SOURCE_SHA = lock.source.sha;

describe('design-foundation.lock.json', () => {
  it('records the upstream commit and foundation version', () => {
    expect(SOURCE_SHA).toMatch(/^7dd9590[0-9a-f]{33}$/);
    expect(lock.source.foundationVersion).toBe('1.0.0');
  });

  it('pins any per-file sourceSha to a full 40-hex commit', () => {
    for (const entry of lock.files) {
      if (entry.sourceSha !== undefined) expect(entry.sourceSha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('locks every non-test ui component (no unlocked copies)', () => {
    const uiDir = path.join(root, 'src/components/ui');
    const actual = readdirSync(uiDir)
      .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
      .map((name) => `src/components/ui/${name}`)
      .sort();
    expect(lock.files.map((entry) => entry.path).sort()).toEqual(actual);
  });

  describe.each(lock.files)('$path', (entry) => {
    const content = readFileSync(path.join(root, entry.path), 'utf8');
    const [firstLine, ...rest] = content.split('\n');
    const entrySourceSha = entry.sourceSha ?? SOURCE_SHA;

    it('starts with a provenance header naming the upstream path and short sha', () => {
      expect(firstLine).toContain(`finance-fe@${entrySourceSha.slice(0, 7)}:${entry.upstreamPath}`);
      expect(firstLine).toContain(entry.mode === 'verbatim' ? '(verbatim)' : '(derived');
    });

    if (entry.mode === 'verbatim') {
      it('is byte-identical to the upstream body (no local edits)', () => {
        expect(sha256(rest.join('\n'))).toBe(entry.upstreamSha256);
      });
    } else {
      it('matches the locked derived hash and declares its patches', () => {
        // 실패하면: 로컬 수정이 lock에 반영되지 않았다. patches 목록과 localSha256을 함께 갱신한다.
        expect(sha256(content)).toBe(entry.localSha256);
        const patches = entry.patches ?? [];
        expect(patches.length).toBeGreaterThan(0);
        expect(firstLine).toContain('derived');
        expect(content).toContain(`로컬 패치 ${patches.length}건`);
      });
    }
  });
});
