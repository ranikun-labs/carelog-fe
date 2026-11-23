# Carelog

Mobile-first React frontend for Carelog — a generic customer relationship tool that keeps
customer context, timeline entries, and follow-up work in one place. Built on a localized public
site, a mobile app shell, typed ko/en messages, pre-rendering, accessible navigation, and reusable
UI primitives.

## 서비스 핵심

Carelog는 고객별 맥락과 지난 접점을 한곳에서 보고 다음 행동을 남기는 고객 관리 서비스입니다. 이 저장소는 고객 목록·상세, 방문 타임라인, 후속 일정 작성과 확인 화면을 담당합니다.

## 대표 사용자 흐름

| 사용자 행동 | 화면과 유지보수 시작점 |
| --- | --- |
| 고객을 찾고 상세를 연다 | [고객 상세](src/pages/CustomerDetailPage.tsx)에서 고객 메모, 다음 일정과 방문 타임라인을 확인합니다. |
| 후속 일정을 작성한다 | 고객 상세에서 [일정 작성 폼](src/components/schedule/EventForm.tsx)을 엽니다. 저장·조회 연결은 [일정 API 어댑터](src/integrations/carelog/customerEventPort.ts)에서 확인합니다. |
| 지난 방문을 다시 본다 | [고객 타임라인](src/components/customers/CustomerTimeline.tsx)에서 완료 방문을 고르고 [방문 상세](src/pages/EventDetailPage.tsx)를 엽니다. |

예정 일정의 예약 시각과 완료 방문의 실제 방문 시각을 구분합니다. 고객·일정 저장과 접근 범위는 Carelog API를 따릅니다. 치료 경과 이어보기는 설계 단계입니다. UI 규격과 방문 상태의 의미를 변경하기 전에 Carelog 제품 계약을 확인하세요. [Carelog UI 계약](docs/design/carelog/README.md) · [Carelog BE](https://github.com/ranikun-labs/carelog-be)
