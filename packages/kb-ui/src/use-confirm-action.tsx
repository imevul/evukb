import { type ReactElement, type ReactNode, useCallback, useState } from 'react';

import { ConfirmModal } from './confirm-modal.js';

export type ConfirmActionRequest = {
  title: string;
  description?: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  confirmingLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  action: () => void | Promise<void>;
};

export type UseConfirmActionResult = {
  confirm: (request: ConfirmActionRequest) => void;
  closeConfirm: () => void;
  confirmModal: ReactElement | null;
  confirming: boolean;
};

export function useConfirmAction(): UseConfirmActionResult {
  const [request, setRequest] = useState<ConfirmActionRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeConfirm = useCallback(() => {
    if (confirming) {
      return;
    }
    setRequest(null);
    setError(null);
  }, [confirming]);

  const confirm = useCallback((next: ConfirmActionRequest) => {
    setError(null);
    setRequest(next);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!request) {
      return;
    }
    setConfirming(true);
    setError(null);
    try {
      await request.action();
      setRequest(null);
    } catch (confirmError: unknown) {
      setError(confirmError instanceof Error ? confirmError.message : 'Action failed.');
    } finally {
      setConfirming(false);
    }
  }, [request]);

  const confirmModal = request ? (
    <ConfirmModal
      {...(request.confirmLabel ? { confirmLabel: request.confirmLabel } : {})}
      confirming={confirming}
      {...(request.confirmingLabel ? { confirmingLabel: request.confirmingLabel } : {})}
      {...(request.confirmVariant ? { confirmVariant: request.confirmVariant } : {})}
      {...(request.description !== undefined ? { description: request.description } : {})}
      error={error}
      onClose={closeConfirm}
      onConfirm={() => void handleConfirm()}
      open
      title={request.title}
    >
      {request.body}
    </ConfirmModal>
  ) : null;

  return { confirm, closeConfirm, confirmModal, confirming };
}
