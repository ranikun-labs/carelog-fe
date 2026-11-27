import { APP_BASE, APP_ROUTE_PATHS } from '@/constants/routes';

/**
 * CustomerFormDraftProvider의 리셋 키. 고객 경로는 경로마다 리셋한다(기존 동작 유지: 다른 고객 폼 초안이 새지 않게).
 * AI 도우미 질문 초안도 이 Provider에 있으므로 도우미 경로는 자기 키를 가져 들어가고 나올 때 리셋된다.
 * 그 밖의 경로(일정·일정 생성 등)끼리 이동할 때는 키를 바꾸지 않는다.
 * 키를 바꾸면 Provider 아래 트리 전체(AdaptiveHost 포함)가 재마운트되어, 저장 뒤 일정 화면 알림이 사라진다.
 */
export function customerFormDraftScopeKey(pathname: string): string {
  if (pathname.startsWith(`${APP_BASE}/customers`)) return pathname;
  if (pathname.startsWith(APP_ROUTE_PATHS.assistant)) return pathname;
  return `${APP_BASE}:shared`;
}
