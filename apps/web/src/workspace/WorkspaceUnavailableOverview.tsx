import { Button, Card } from '@evu/kb-ui';
import { useNavigate } from 'react-router-dom';

import { appRoutes } from '../config.js';
import { useWorkspace } from './WorkspaceProvider.js';

export function WorkspaceUnavailableOverview() {
  const navigate = useNavigate();
  const { selectedSlug, status, errorMessage } = useWorkspace();

  const title =
    status === 'not_found'
      ? 'Workspace not found'
      : status === 'forbidden'
        ? 'Workspace access denied'
        : 'Workspace unavailable';

  return (
    <Card className="mx-auto max-w-xl p-6">
      <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="evukb-muted mt-3">
        The configured workspace <code>{selectedSlug}</code> could not be loaded.
        {errorMessage ? <> {errorMessage}</> : null}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => navigate(appRoutes.workspaces)} type="button">
          Choose workspace
        </Button>
        <Button
          onClick={() => navigate(`${appRoutes.workspaces}?create=1`)}
          type="button"
          variant="outline"
        >
          Create workspace
        </Button>
      </div>
    </Card>
  );
}
