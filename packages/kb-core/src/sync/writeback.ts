export const importWritebackConflictPolicyV1 = {
  save: 'kb_wins_overwrite_mount',
  delete: 'kb_wins_unlink_mount',
  mountSyncImport: 'mount_wins_for_shared_mount',
  externalMountEdit: 'not_reconciled_v1',
} as const;

export type ImportWritebackConflictPolicyV1 = typeof importWritebackConflictPolicyV1;

export function shouldWritebackManagedNode(node: {
  sourceType: string;
  nodeType: string;
}): boolean {
  return node.sourceType === 'managed' && node.nodeType === 'file';
}

export function mountContentMatchesKb(
  contentHash: string | null | undefined,
  mountSha256: string,
): boolean {
  if (!contentHash) {
    return true;
  }
  return contentHash.toLowerCase() === mountSha256.toLowerCase();
}

export function formatWritebackDriftWarning(relativePath: string): string {
  return `Managed file "${relativePath}" differs from mount mirror (external edit; KB wins on next save).`;
}

export function formatWritebackDriftSummary(count: number, paths: string[]): string {
  if (count === 0) {
    return '';
  }
  const listed = paths.slice(0, 5).join(', ');
  const suffix = paths.length > 5 ? ` (+${paths.length - 5} more)` : '';
  return `${count} managed file(s) differ from mount mirror (external edit; KB wins on next save): ${listed}${suffix}`;
}
