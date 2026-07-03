import type { AuditLogEntry } from '@evu/kb-sdk';
import {
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormatDateTime,
} from '@evu/kb-ui';
import { useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

const WRITE_ACTIONS = [
  'create_document',
  'append_document',
  'update_document',
  'delete_document',
] as const;

type ActionFilter = (typeof WRITE_ACTIONS)[number] | '';

function formatActor(actor: AuditLogEntry['actor']): string {
  const tokenSuffix = actor.tokenId ? ` · ${actor.tokenId.slice(0, 8)}…` : '';
  return `${actor.kind}${tokenSuffix}`;
}

function formatTarget(target: AuditLogEntry['target']): string {
  if (!target) {
    return '—';
  }
  if (target.path) {
    return target.path;
  }
  const parts = [target.corpusId, target.nodeId].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '—';
}

export function AuditPage() {
  const formatDateTime = useFormatDateTime();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void kbClient
      .listAuditLog(appConfig.workspaceId, {
        limit: 50,
        ...(actionFilter ? { action: actionFilter } : {}),
      })
      .then((items) => {
        if (!cancelled) {
          setEntries(items);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load audit log.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actionFilter]);

  return (
    <section className="evukb-panel">
      <h2>Audit trail</h2>
      <p>Read-only log of agent write mutations in this workspace.</p>
      {error ? <p className="evukb-error">{error}</p> : null}
      <label className="evukb-audit-filter">
        Action
        <select
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value as ActionFilter)}
        >
          <option value="">All write actions</option>
          {WRITE_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </label>
      {loading ? <p className="evukb-muted">Loading audit entries…</p> : null}
      {!loading && entries.length === 0 ? (
        <EmptyState title="No audit entries yet" hint="Agent write mutations will appear here." />
      ) : null}
      {!loading && entries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(entry.createdAt)}
                </TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell className="max-w-[26rem] [overflow-wrap:anywhere]">
                  {formatActor(entry.actor)}
                </TableCell>
                <TableCell>{formatTarget(entry.target)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </section>
  );
}
