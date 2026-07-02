import type { ReactElement, ReactNode } from 'react';

import { AppModal, type AppModalSize } from './app-modal.js';
import { Button } from './primitives.js';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  error?: string | null;
  size?: AppModalSize;
  confirmVariant?: 'danger' | 'primary';
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  confirmingLabel,
  cancelLabel = 'Cancel',
  confirming = false,
  error,
  size = 'sm',
  confirmVariant = 'danger',
  onClose,
  onConfirm,
}: ConfirmModalProps): ReactElement {
  return (
    <AppModal
      description={description}
      footer={
        <>
          <Button disabled={confirming} onClick={onClose} type="button" variant="outline">
            {cancelLabel}
          </Button>
          <Button disabled={confirming} onClick={onConfirm} type="button" variant={confirmVariant}>
            {confirming ? (confirmingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size={size}
      title={title}
    >
      {error ? <p className="evukb-error">{error}</p> : null}
      {children}
    </AppModal>
  );
}
