import {
  formatOkfStrictSaveError,
  type IndexStatus,
  mergeOkfNodeMetadata,
  type OkfLogMaintenanceActor,
  okfStrictSaveBlocked,
  parseMarkdownDocument,
  validateOkfMarkdownSource,
} from '@evu/kb-core';
import type { NodeRepository } from '@evu/kb-db';

import { ApiError } from '../../errors.js';
import type { CorpusIndexEventHub } from '../corpus-index-event-hub.js';
import type { OkfMaintenanceEvent } from '../okf-maintenance-types.js';
import type { FileManagerDeps } from './types.js';

export function assertOkfStrictAllowsSave(
  settings: Record<string, unknown>,
  fileName: string,
  content: Buffer,
): void {
  if (!fileName.toLowerCase().endsWith('.md')) {
    return;
  }
  const okfMetadata = validateOkfMarkdownSource(settings, fileName, content.toString('utf8'));
  if (okfStrictSaveBlocked(settings, okfMetadata)) {
    throw ApiError.validation(formatOkfStrictSaveError(okfMetadata?.validationIssues ?? []));
  }
}

export async function applyMarkdownMetadata(
  deps: { nodes: NodeRepository; indexEventHub: CorpusIndexEventHub | undefined },
  workspaceId: string,
  corpusId: string,
  nodeId: string,
  settings: Record<string, unknown>,
  content: Buffer,
): Promise<void> {
  const node = await deps.nodes.getById(workspaceId, corpusId, nodeId);
  if (!node) {
    return;
  }
  const isMarkdown =
    node.name.toLowerCase().endsWith('.md') ||
    node.mimeType === 'text/markdown' ||
    node.mimeType === 'text/x-markdown';
  if (!isMarkdown) {
    return;
  }
  const okfMetadata = validateOkfMarkdownSource(settings, node.name, content.toString('utf8'));
  const parsed = parseMarkdownDocument(content.toString('utf8'));
  const metadata = mergeOkfNodeMetadata(
    node.metadata,
    okfMetadata,
    parsed.frontmatter.errors.map((error) => error.message),
  );
  const previousIndexStatus = node.indexStatus as IndexStatus;
  await deps.nodes.updateIndexStatus(workspaceId, corpusId, nodeId, {
    indexStatus: 'pending',
    metadata: {
      ...metadata,
      frontmatter: parsed.frontmatter.parsed,
    },
  });
  deps.indexEventHub?.publish(workspaceId, corpusId, {
    nodeId,
    indexStatus: 'pending',
    ...(previousIndexStatus !== 'pending' ? { previousIndexStatus } : {}),
  });
}

export async function notifyOkfMutation(
  onOkfMutation: FileManagerDeps['onOkfMutation'],
  workspaceId: string,
  corpusId: string,
  event: OkfMaintenanceEvent,
  actor?: OkfLogMaintenanceActor,
): Promise<void> {
  if (!onOkfMutation) {
    return;
  }
  await onOkfMutation({
    workspaceId,
    corpusId,
    event,
    actor: actor ?? { kind: 'admin' },
  });
}
