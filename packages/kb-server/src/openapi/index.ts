import { auditApprovalPaths } from './audit-approval-paths.js';
import { corpusPaths } from './corpus-paths.js';
import { diagnosticsPaths } from './diagnostics-paths.js';
import { filePaths } from './file-paths.js';
import { graphPaths } from './graph-paths.js';
import { healthPaths } from './health-paths.js';
import { indexPaths } from './index-paths.js';
import { kbToolPaths } from './kb-tool-paths.js';
import { searchAskPaths } from './search-ask-paths.js';
import { secretTokenPaths } from './secret-token-paths.js';
import { settingsPaths } from './settings-paths.js';
import { syncPortablePaths } from './sync-portable-paths.js';
import { usagePaths } from './usage-paths.js';

export { workspaceBootHintsSchema } from './schemas.js';

export function buildOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'EvuKB API',
      version: '0.1.0',
      description: 'Workspace-scoped corpus, file manager, indexing, search, and ask endpoints.',
    },
    servers: [{ url: 'http://localhost:4201' }],
    paths: {
      ...healthPaths,
      ...corpusPaths,
      ...filePaths,
      ...searchAskPaths,
      ...graphPaths,
      ...indexPaths,
      ...syncPortablePaths,
      ...settingsPaths,
      ...diagnosticsPaths,
      ...usagePaths,
      ...secretTokenPaths,
      ...auditApprovalPaths,
      ...kbToolPaths,
    },
  };
}
