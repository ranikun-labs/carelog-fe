import '@testing-library/jest-dom/vitest';

/**
 * jsdom의 기본 `navigator.language`는 `en-US`다(`ko-KR`이 아님). 앱 locale
 * 우선순위(`src/i18n/appLocale.ts`)가 저장값이 없을 때 브라우저 locale로 폴백하므로,
 * 이 기본값을 그대로 두면 스토리지가 비어있는 기존 테스트 환경에서 앱 쪽 텍스트가
 * 전부 영어로 뒤집혀 기존 한국어 assertion이 대량으로 깨진다. 이 프로젝트의 실제
 * 기본 시장 언어(`DEFAULT_LOCALE`)와 맞춰 전역으로 고정한다. 개별 테스트가
 * `vi.stubGlobal('navigator', ...)`로 재정의하면 이 기본값은 그 테스트 범위 안에서
 * 덮어써진다.
 */
Object.defineProperty(window.navigator, 'language', {
  value: 'ko-KR',
  configurable: true,
});
Object.defineProperty(window.navigator, 'languages', {
  value: ['ko-KR'],
  configurable: true,
});
