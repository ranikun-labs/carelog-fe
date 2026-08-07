import type { Messages } from '@/i18n/dictionary';

export const ko: Messages = {
  common: {
    appName: 'Carelog',
    openApp: '앱 열기',
    learnMore: '기능 보기',
    changeLanguage: '언어 변경',
  },
  navigation: {
    home: '홈',
    features: '기능',
    today: '오늘',
    customers: '고객',
    followUps: '후속 업무',
    ariaLabel: '주요 탐색',
  },
  public: {
    home: {
      eyebrow: 'Customer Relationship Foundation',
      title: '고객 맥락과 후속 업무를 한 곳에서',
      description: '지역화된 공개 화면과 모바일 우선 앱 셸로 시작하는 Carelog입니다.',
    },
    features: {
      title: '검증 가능한 고객 관리 기반',
      description: '실제 고객 관리 흐름에 맞춰 확장할 수 있는 공통 경계를 제공합니다.',
      items: ['지역화된 라우트', '앱 셸', '재사용 컴포넌트', '검증 기반'],
    },
  },
  app: {
    home: {
      eyebrow: '오늘',
      title: 'Carelog에 오신 것을 환영합니다',
      description: '아직 고객 데이터가 연결되어 있지 않습니다.',
      customersAction: '고객 목록 보기',
    },
  },
  customers: {
    title: '고객',
    description: '내가 관리하는 고객 목록입니다.',
    back: '고객 목록으로 돌아가기',
    recentContact: '최근 연락',
    detail: {
      title: '고객 상세',
      contextTitle: '고객 맥락',
      contextUpdatedAt: '마지막 업데이트',
    },
    import: { title: '고객 가져오기' },
    handoff: { title: '인계' },
  },
  reviews: {
    detail: { title: '검토' },
  },
  followUps: {
    title: '후속 업무',
    description: '예정된 후속 업무를 확인하기 위한 자리표시자입니다.',
  },
  timeline: {
    title: '타임라인',
    empty: '아직 기록이 없습니다.',
  },
  placeholder: {
    comingSoon: '이 화면은 다음 단계에서 채워집니다.',
  },
  settings: {
    title: '설정',
    description: '앱 언어는 이 기기에 저장됩니다.',
    currentLanguage: '현재 언어',
    korean: '한국어',
    english: 'English',
  },
  notFound: {
    title: '페이지를 찾을 수 없습니다',
    description: '요청한 경로가 이 앱에 없습니다.',
    action: '홈으로 이동',
  },
};
