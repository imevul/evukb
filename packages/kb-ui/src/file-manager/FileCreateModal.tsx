import type { FormEvent, ReactElement } from 'react';

import { AppModal } from '../app-modal.js';
import { Button, Field } from '../primitives.js';

const createFileFormId = 'create-file-form';
const createFolderFormId = 'create-folder-form';

export type FileCreateModalProps = {
  currentFolderPath: string;
  error: string | null;
  fileName: string;
  filePath: string;
  onClose: () => void;
  onFileNameChange: (value: string) => void;
  onFilePathChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  pending: boolean;
};

export function FileCreateModal({
  open,
  onClose,
  onSubmit,
  filePath,
  onFilePathChange,
  fileName,
  onFileNameChange,
  currentFolderPath,
  error,
  pending,
}: FileCreateModalProps): ReactElement {
  return (
    <AppModal
      footer={
        <>
          <Button disabled={pending} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} form={createFileFormId} type="submit" variant="primary">
            {pending ? 'Creating…' : 'Create file'}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Create file"
    >
      {error ? <p className="evukb-error">{error}</p> : null}
      <form className="evukb-form" id={createFileFormId} onSubmit={(event) => void onSubmit(event)}>
        <Field>
          <label htmlFor="create-file-path">Path</label>
          <input
            id="create-file-path"
            value={filePath}
            placeholder={currentFolderPath || 'Root'}
            onChange={(event) => onFilePathChange(event.target.value)}
          />
        </Field>
        <Field>
          <label htmlFor="create-file-name">Name</label>
          <input
            id="create-file-name"
            required
            value={fileName}
            onChange={(event) => onFileNameChange(event.target.value)}
          />
        </Field>
      </form>
    </AppModal>
  );
}

export type FileCreateFolderModalProps = {
  currentFolderPath: string;
  error: string | null;
  folderName: string;
  folderPath: string;
  onClose: () => void;
  onFolderNameChange: (value: string) => void;
  onFolderPathChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  pending: boolean;
};

export function FileCreateFolderModal({
  open,
  onClose,
  onSubmit,
  folderPath,
  onFolderPathChange,
  folderName,
  onFolderNameChange,
  currentFolderPath,
  error,
  pending,
}: FileCreateFolderModalProps): ReactElement {
  return (
    <AppModal
      footer={
        <>
          <Button disabled={pending} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={pending} form={createFolderFormId} type="submit" variant="primary">
            {pending ? 'Creating…' : 'Create folder'}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title="Create folder"
    >
      {error ? <p className="evukb-error">{error}</p> : null}
      <form
        className="evukb-form"
        id={createFolderFormId}
        onSubmit={(event) => void onSubmit(event)}
      >
        <Field>
          <label htmlFor="create-folder-path">Path</label>
          <input
            id="create-folder-path"
            value={folderPath}
            placeholder={currentFolderPath || 'Root'}
            onChange={(event) => onFolderPathChange(event.target.value)}
          />
        </Field>
        <Field>
          <label htmlFor="create-folder-name">Name</label>
          <input
            id="create-folder-name"
            required
            value={folderName}
            onChange={(event) => onFolderNameChange(event.target.value)}
          />
        </Field>
      </form>
    </AppModal>
  );
}
