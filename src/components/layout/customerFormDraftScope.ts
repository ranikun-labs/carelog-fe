import { APP_BASE } from '@/constants/routes';

/**
 * CustomerFormDraftProvider의 리셋 키. 고객 경로는 경로마다 리셋한다(기존 동작 유지: 다른 고객 폼 초안이 새지 않게).
 * 고객과 무관한 경로(일정·일정 생성·상세 등)끼리 이동할 때는 키를 바꾸지 않는다.
 * 키를 바꾸면 Provider 아래 트리 전체(AdaptiveHost 포함)가 재마운트되어, 저장 뒤 일정 화면 알림이 사라진다.
 */
export function customerFormDraftScopeKey(pathname: string): string {
  return pathname.startsWith(`${APP_BASE}/customers`) ? pathname : `${APP_BASE}:non-customer`;
}
