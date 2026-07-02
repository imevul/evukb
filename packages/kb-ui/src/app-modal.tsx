import { X } from 'lucide-react';
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from './cn.js';
import { Button } from './primitives.js';

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  fullscreen: 'max-w-[calc(100vw-2rem)]',
} as const;

export type AppModalSize = keyof typeof modalSizes;

export type AppModalProps = {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: AppModalSize;
  title: string;
};

export function AppModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  headerActions,
  size = 'lg',
}: AppModalProps): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const contentId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      return;
    }
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const handleCancel = useCallback(
    (event: { preventDefault: () => void }): void => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (!open) {
    return null;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 m-0 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
        'border-0 bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-[1px]',
        modalSizes[size],
      )}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : contentId}
      onCancel={handleCancel}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold leading-tight">
              {title}
            </h2>
            {description ? (
              <div id={descId} className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <Button
              aria-label="Close"
              className="h-8 w-8 shrink-0 p-0"
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              <X aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div id={contentId} className="min-h-0 flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>,
    document.body,
  );
}
