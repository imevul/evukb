import { AppContent, AppShell, StatusPill, ThemeMenu, useColorScheme } from '@evu/kb-ui';
import { Outlet } from 'react-router-dom';

import { appConfig, appRoutes } from '../config.js';

const primaryNav = [
  { to: appRoutes.knowledgeList, label: 'Knowledge', end: false },
  { to: appRoutes.workspaceSearch, label: 'Search' },
  { to: appRoutes.workspaceAsk, label: 'Ask' },
  { to: appRoutes.settingsRoot, label: 'Settings' },
  { to: appRoutes.diagnostics, label: 'Diagnostics' },
] as const;

export function AppLayout() {
  const { preference, setPreference } = useColorScheme();

  return (
    <AppShell
      brand="EvuKB"
      footer={<ThemeMenu value={preference} onChange={setPreference} />}
      headerMeta={<StatusPill tone="neutral">workspace: {appConfig.workspaceId}</StatusPill>}
      navItems={[...primaryNav]}
      tagline="Knowledge base and RAG operator console"
    >
      <AppContent>
        <Outlet />
      </AppContent>
    </AppShell>
  );
}
