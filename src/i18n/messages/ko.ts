import type { Messages } from '@/i18n/dictionary';

export const ko: Messages = {
  common: {
    appName: 'React Product Foundation',
    openApp: '앱 열기',
    learnMore: '기능 보기',
    changeLanguage: '언어 변경',
  },
  navigation: {
    home: '홈',
    features: '기능',
    items: '항목',
    settings: '설정',
    ariaLabel: '주요 탐색',
  },
  public: {
    home: {
      eyebrow: 'Minimal Foundation',
      title: '제품을 시작하는 단단한 React 기반',
      description: '지역화된 공개 화면과 모바일 우선 앱 셸을 작은 출발점으로 제공합니다.',
    },
    features: {
      title: '검증 가능한 제품 기반',
      description: '실제 제품 요구에 맞춰 교체할 수 있는 공통 경계를 제공합니다.',
      items: ['지역화된 라우트', '앱 셸', '재사용 컴포넌트', '검증 기반'],
    },
  },
  app: {
    home: {
      eyebrow: 'Starter App',
      title: '새 제품에 오신 것을 환영합니다',
      description: '여기에는 개인화나 외부 API가 연결되어 있지 않습니다.',
      itemsAction: '예시 항목 보기',
    },
  },
  items: {
    title: '항목',
    description: '목록과 상세 라우트를 확인하기 위한 중립적인 예시입니다.',
    sampleNames: ['샘플 작업 공간', '확인 체크리스트', '시작 작업'],
    detail: {
      title: '항목 상세',
      identifier: '식별자',
      created: '생성일',
      checklist: '시작 체크리스트',
      steps: ['제품 문구 교체', '라우트 확인', '검증 명령 실행'],
      back: '항목으로 돌아가기',
    },
  },
  settings: {
    title: '설정',
    description: '앱 언어는 이 기기에 저장됩니다.',
    currentLanguage: '현재 언어',
    korean: '한국어',
    english: 'English',
  },
  compliance: {
    message: '이 화면의 내용은 예시이며 실제 제품 정책으로 교체해야 합니다.',
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다',
    description: '요청한 경로가 이 starter에 없습니다.',
    action: '홈으로 이동',
  },
};
