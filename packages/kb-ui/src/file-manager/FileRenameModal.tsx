import type { FormEvent, ReactElement } from 'react';

import { AppModal } from '../app-modal.js';
import { Button, Field } from '../primitives.js';

const renameNodeFormId = 'rename-node-form';

export type FileRenameModalProps = {
  error: string | null;
  name: string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  pending: boolean;
};

export function FileRenameModal({
  open,
  onClose,
  onSubmit,
  name,
  onNameChange,
  error,
  pending,
}: FileRenameModalProps): ReactElement {
  return (
    <AppModal
      footer={
        <>
          <Button disabled={pending} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} form={renameNodeFormId} type="submit" variant="primary">
            {pending ? 'Renaming…' : 'Rename'}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Rename"
    >
      {error ? <p className="evukb-error">{error}</p> : null}
      <form className="evukb-form" id={renameNodeFormId} onSubmit={(event) => void onSubmit(event)}>
        <Field>
          <label htmlFor="rename-node-name">Name</label>
          <input
            id="rename-node-name"
            required
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </Field>
      </form>
    </AppModal>
  );
}
