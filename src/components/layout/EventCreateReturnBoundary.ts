import { useCallback, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { matchPath, useLocation } from 'react-router';

import { APP_BASE, APP_ROUTE_PATHS } from '@/constants/routes';
import {
  useOptionalEventCreateActivation,
  type EventCreateReturnProvenance,
  type EventCreateReturnTarget,
} from '@/state/EventCreateActivationContext';

function isWithin(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function isEventFormSubmitTarget(target: EventTarget | null): boolean {
  return isWithin(target, '[data-event-form-submit]');
}

function isEventCreateFormTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[data-event-form][data-event-form-mode="create"]') !== null
  );
}

function isActivationKey(key: string): key is 'Enter' | ' ' {
  return key === 'Enter' || key === ' ';
}

function decodePathSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isReturnRoute(pathname: string, target: EventCreateReturnTarget): boolean {
  if (matchPath({ path: APP_ROUTE_PATHS.eventCreate, end: true }, pathname)) return true;
  if (target.kind === 'schedule') {
    return pathname === APP_BASE || pathname === APP_ROUTE_PATHS.schedule;
  }

  const customerMatch = matchPath({ path: APP_ROUTE_PATHS.customerDetail, end: true }, pathname);
  return decodePathSegment(customerMatch?.params.customerId) === target.customerId;
}

function isProvenanceRoute(pathname: string, provenance: EventCreateReturnProvenance): boolean {
  return isReturnRoute(pathname, provenance.target);
}

export function useEventCreateReturnBoundary() {
  const location = useLocation();
  const activation = useOptionalEventCreateActivation();

  const suppressContinuation = useCallback(
    (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      activation?.clearCreateReturnProvenance();
    },
    [activation],
  );

  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        activation &&
        isEventCreateFormTarget(event.target) &&
        isEventFormSubmitTarget(event.target) &&
        event.detail > 0
      ) {
        activation.recordCreateActivation({
          kind: 'pointer',
          clickDetail: event.detail,
        });
      }

      if (!activation) return;
      const pending = activation.getPendingCreateReturn();
      if (!pending) return;
      if (!isProvenanceRoute(location.pathname, pending)) {
        activation.clearCreateReturnProvenance();
        return;
      }

      if (pending.activation.kind === 'pointer' && event.detail > pending.activation.clickDetail) {
        suppressContinuation(event);
        return;
      }

      // A click with detail=1 (including a keyboard-generated detail=0 click)
      // is not proof of the originating pointer sequence. Let it execute.
      activation.clearCreateReturnProvenance();
    },
    [activation, location.pathname, suppressContinuation],
  );

  const handleKeyDownCapture = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (activation && isEventCreateFormTarget(event.target) && isActivationKey(event.key)) {
        activation.recordCreateActivation({
          kind: 'keyboard',
          key: event.key,
          repeat: event.repeat,
        });
      }

      if (!activation) return;
      const pending = activation.getPendingCreateReturn();
      if (!pending) return;
      if (!isProvenanceRoute(location.pathname, pending)) {
        activation.clearCreateReturnProvenance();
        return;
      }

      if (
        pending.activation.kind === 'keyboard' &&
        event.key === pending.activation.key &&
        event.repeat
      ) {
        suppressContinuation(event);
        return;
      }

      // A separate keydown has repeat=false and is a fresh user sequence.
      activation.clearCreateReturnProvenance();
    },
    [activation, location.pathname, suppressContinuation],
  );

  useEffect(() => {
    if (!activation) return;
    const pending = activation.getPendingCreateReturn();
    if (!pending || isProvenanceRoute(location.pathname, pending)) return;
    activation.clearCreateReturnProvenance();
  }, [activation, location.pathname]);

  return { handleClickCapture, handleKeyDownCapture };
}
