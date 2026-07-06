import { Outlet } from 'react-router-dom';

import { useWorkspace } from './WorkspaceProvider.js';
import { WorkspaceUnavailableOverview } from './WorkspaceUnavailableOverview.js';

export function WorkspaceGate() {
  const { status } = useWorkspace();

  if (status === 'loading') {
    return <p className="evukb-muted">Checking workspace…</p>;
  }

  if (status === 'ready') {
    return <Outlet />;
  }

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceUnavailableOverview />
    </div>
  );
}
