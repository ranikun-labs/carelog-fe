import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** 안전한 쪽(되돌아가기). 열릴 때 기본 포커스, Esc도 이쪽이다. */
  cancelLabel: string;
  /** 위험한 쪽(진행). 확정 버튼만 위험색이다. */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** 취소로 닫힐 때 포커스를 돌려줄 요소. 없으면 브라우저가 연 쪽으로 복원한다. */
  restoreFocusTo?: () => HTMLElement | null | undefined;
}

/**
 * 공통 확인 Dialog(모달). 네이티브 `<dialog>` + showModal()이라 배경 비활성·포커스 가둠·Esc를 브라우저가 맡는다.
 * 의존성 없이 접근 가능한 모달을 얻기 위한 선택이다. 이름·설명은 aria로 연결한다.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  restoreFocusTo,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(restoreFocusTo);
  const restoreOnCloseRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    restoreFocusRef.current = restoreFocusTo;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    cancelRef.current?.focus();
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      // close()는 모달을 연 요소(예: 눌렀던 내비 링크)로 포커스를 되돌린다. 취소였다면 그 뒤에 입력으로 다시 옮긴다.
      if (restoreOnCloseRef.current) {
        restoreOnCloseRef.current = false;
        restoreFocusRef.current?.()?.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  function cancel() {
    restoreOnCloseRef.current = true;
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      data-confirm-dialog
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      className="bg-card text-foreground rounded-sheet shadow-overlay backdrop:bg-scrim m-auto w-[calc(100%-32px)] max-w-sm p-6"
    >
      <h2 id={titleId} className="type-section-title text-foreground break-keep">
        {title}
      </h2>
      {description ? (
        <p id={descriptionId} className="type-body text-text-secondary mt-2 break-keep">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          ref={cancelRef}
          type="button"
          variant="neutral"
          data-confirm-dialog-cancel
          onClick={cancel}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="danger-strong"
          data-confirm-dialog-confirm
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
