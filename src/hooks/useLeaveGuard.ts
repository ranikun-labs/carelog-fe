import { useEffect, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router';

/**
 * 입력이 남아 있을 때 앱 안의 모든 이동(하단 내비·링크·브라우저 뒤로 가기·navigate)을 막는다.
 * React Router 공식 `useBlocker`를 쓰므로 Data Router(`createBrowserRouter` 등) 안에서만 동작한다.
 * 반환된 blocker가 'blocked'이면 호출부(LeaveGuard)가 확인을 띄우고 `proceed`/`reset`을 부른다.
 *
 * `shouldBlock`은 이동 시점에 호출된다(렌더 때가 아니다). 저장 중처럼 "지금은 놓아줘야 할" 순간을
 * ref로 읽을 수 있게 하려는 설계다. 같은 경로·쿼리로의 이동(state만 바뀜)은 막지 않는다.
 */
export function useLeaveGuard(shouldBlock: () => boolean): Blocker {
  const shouldBlockRef = useRef(shouldBlock);
  useEffect(() => {
    shouldBlockRef.current = shouldBlock;
  });

  return useBlocker(({ currentLocation, nextLocation }) => {
    if (
      currentLocation.pathname === nextLocation.pathname &&
      currentLocation.search === nextLocation.search
    ) {
      return false;
    }
    return shouldBlockRef.current();
  });
}
