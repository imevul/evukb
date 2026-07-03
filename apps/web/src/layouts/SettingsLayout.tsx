import { DetailTabs, PageHeader } from '@evu/kb-ui';
import { Outlet } from 'react-router-dom';

import { appRoutes } from '../config.js';

const settingsTabs = [
  { to: appRoutes.settingsPreferences, label: 'Preferences' },
  { to: appRoutes.settingsWorkspace, label: 'Workspace' },
  { to: appRoutes.settingsAi, label: 'AI providers' },
  { to: appRoutes.settingsRanking, label: 'Ranking' },
  { to: appRoutes.settingsSecrets, label: 'Secrets' },
  { to: appRoutes.apiKeys, label: 'API keys' },
  { to: appRoutes.mcpTokens, label: 'MCP tokens' },
  { to: appRoutes.audit, label: 'Audit trail' },
  { to: appRoutes.mutationApprovals, label: 'Approvals' },
] as const;

export function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" />
      <DetailTabs
        aria-label="Settings sections"
        items={settingsTabs.map((tab) => ({ ...tab, end: true }))}
      />
      <Outlet />
    </>
  );
}
