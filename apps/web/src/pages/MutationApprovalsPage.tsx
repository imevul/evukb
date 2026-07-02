import type { MutationApprovalRecord } from '@evu/kb-sdk';
import {
  Alert,
  Button,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmAction,
} from '@evu/kb-ui';
import { useCallback, useEffect, useState } from 'react';

import { kbClient } from '../api/client.js';
import { appConfig } from '../config.js';

function formatAction(action: string): string {
  return action.replace(/_/g, ' ');
}

export function MutationApprovalsPage() {
  const [items, setItems] = useState<MutationApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { confirm, confirmModal } = useConfirmAction();

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await kbClient.listMutationApprovals(appConfig.workspaceId);
      setItems(pending);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  function openApproveConfirm(item: MutationApprovalRecord): void {
    confirm({
      title: 'Approve mutation?',
      body: (
        <p>
          Approve the pending <strong>{formatAction(item.action)}</strong> request for{' '}
          <code>{item.preview.path ?? item.preview.nodeId ?? 'this target'}</code>. The change is
          applied to the corpus immediately.
        </p>
      ),
      confirmLabel: 'Approve',
      confirmingLabel: 'Approving…',
      confirmVariant: 'primary',
      action: async () => {
        setBusyId(item.id);
        setMessage(null);
        try {
          await kbClient.approveMutation(appConfig.workspaceId, item.id);
          setMessage('Mutation approved and applied.');
          await loadApprovals();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function openRejectConfirm(item: MutationApprovalRecord): void {
    confirm({
      title: 'Reject mutation?',
      body: (
        <p>
          Reject the pending <strong>{formatAction(item.action)}</strong> request for{' '}
          <code>{item.preview.path ?? item.preview.nodeId ?? 'this target'}</code>.
        </p>
      ),
      confirmLabel: 'Reject',
      confirmingLabel: 'Rejecting…',
      action: async () => {
        setBusyId(item.id);
        setMessage(null);
        try {
          await kbClient.rejectMutation(appConfig.workspaceId, item.id);
          setMessage('Mutation rejected.');
          await loadApprovals();
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <section className="evukb-panel">
      <h2>Mutation approvals</h2>
      <p>Review and approve agent write requests before they are applied to corpora.</p>
      {error ? <p className="evukb-error">{error}</p> : null}
      {message ? (
        <Alert onDismiss={() => setMessage(null)} title={message} variant="success" />
      ) : null}
      {loading ? <p className="evukb-muted">Loading pending approvals…</p> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="No pending approvals" hint="Agent write requests will appear here." />
      ) : null}
      {!loading && items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Corpus</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{formatAction(item.action)}</TableCell>
                <TableCell>
                  <code>{item.corpusId.slice(0, 8)}…</code>
                </TableCell>
                <TableCell>{item.preview.path ?? item.preview.nodeId ?? '—'}</TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={busyId === item.id}
                      onClick={() => openApproveConfirm(item)}
                      type="button"
                      variant="primary"
                    >
                      Approve
                    </Button>
                    <Button
                      disabled={busyId === item.id}
                      onClick={() => openRejectConfirm(item)}
                      type="button"
                      variant="dangerOutline"
                    >
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {confirmModal}
    </section>
  );
}
