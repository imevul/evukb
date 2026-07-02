import type { OkfMaintenanceEventKind } from '@evu/kb-core';

export type OkfMaintenanceEvent = {
  kind: OkfMaintenanceEventKind;
  filePath: string;
  previousFilePath?: string;
  nodeType?: 'file' | 'folder';
  title?: string;
  content?: string;
};
