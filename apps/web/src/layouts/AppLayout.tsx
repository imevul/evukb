import { Alert, StatusPill, AppContent, AppShell, ThemeMenu, useColorScheme } from '@evu/kb-ui';
import { Link, Outlet } from 'react-router-dom';

import { appRoutes } from '../config.js';
import { useWorkspace } from '../workspace/WorkspaceProvider.js';

const primaryNav = [
  { to: appRoutes.knowledgeList, label: 'Knowledge', end: false },
  { to: appRoutes.workspaceSearch, label: 'Search' },
  { to: appRoutes.workspaceAsk, label: 'Ask' },
  { to: appRoutes.settingsRoot, label: 'Settings' },
  { to: appRoutes.diagnostics, label: 'Diagnostics' },
] as const;

export function AppLayout() {
  const { preference, setPreference } = useColorScheme();
  const { selectedSlug, status, errorMessage } = useWorkspace();
  const workspaceReady = status === 'ready';
  const workspaceInvalid = status === 'not_found' || status === 'forbidden' || status === 'error';

  const navItems = workspaceReady
    ? [{ to: appRoutes.workspaces, label: 'Workspaces' }, ...primaryNav]
    : [{ to: appRoutes.workspaces, label: 'Workspaces' }];

  const workspaceLabel =
    status === 'loading' ? 'Checking…' : workspaceReady ? selectedSlug : 'No workspace';

  const workspaceTone = workspaceInvalid ? 'warning' : workspaceReady ? 'success' : 'neutral';

  return (
    <AppShell
      brand="EvuKB"
      footer={<ThemeMenu value={preference} onChange={setPreference} />}
      headerMeta={
        <Link
          className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted"
          to={appRoutes.workspaces}
        >
          <span>workspace: {workspaceLabel}</span>
          <StatusPill tone={workspaceTone}>{workspaceReady ? 'active' : status}</StatusPill>
        </Link>
      }
      navItems={[...navItems]}
      tagline="Knowledge base and RAG operator console"
    >
      <AppContent>
        {workspaceInvalid ? (
          <Alert variant="warning">
            Workspace <code>{selectedSlug}</code> is unavailable
            {errorMessage ? `: ${errorMessage}` : ''}.{' '}
            <Link to={appRoutes.workspaces}>Choose or create a workspace</Link>.
          </Alert>
        ) : null}
        <Outlet />
      </AppContent>
    </AppShell>
  );
}
