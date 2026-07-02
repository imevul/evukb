import { lazy, type ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout.js';
import { KnowledgeLayout } from './layouts/KnowledgeLayout.js';
import { SettingsLayout } from './layouts/SettingsLayout.js';
import { AiProvidersPage } from './pages/AiProvidersPage.js';
import { ApiKeysPage } from './pages/ApiKeysPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { CorpusAskPage } from './pages/CorpusAskPage.js';
import { CorpusLinksPage } from './pages/CorpusLinksPage.js';
import { CorpusOverviewPage } from './pages/CorpusOverviewPage.js';
import { CorpusSearchPage } from './pages/CorpusSearchPage.js';
import { DiagnosticsPage } from './pages/DiagnosticsPage.js';
import { KnowledgeListPage } from './pages/KnowledgeListPage.js';
import { McpTokensPage } from './pages/McpTokensPage.js';
import { MutationApprovalsPage } from './pages/MutationApprovalsPage.js';
import { RankingSettingsPage } from './pages/RankingSettingsPage.js';
import { SecretsPage } from './pages/SecretsPage.js';
import { WorkspaceAskPage } from './pages/WorkspaceAskPage.js';
import { WorkspaceSearchPage } from './pages/WorkspaceSearchPage.js';
import { WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage.js';

// Heavy work surfaces load on demand: the file manager pulls in CodeMirror and
// the graph page pulls in the SVG neighborhood view. Keeping them out of the
// main chunk keeps the initial bundle below the size warning.
const CorpusFilesPage = lazy(() =>
  import('./pages/CorpusFilesPage.js').then((module) => ({ default: module.CorpusFilesPage })),
);
const CorpusGraphPage = lazy(() =>
  import('./pages/CorpusGraphPage.js').then((module) => ({ default: module.CorpusGraphPage })),
);

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="evukb-muted">Loading…</p>}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<KnowledgeLayout />} path="/">
          <Route element={<Navigate replace to="/knowledge" />} index />
          <Route element={<KnowledgeListPage />} path="knowledge" />
          <Route element={<WorkspaceAskPage />} path="ask" />
          <Route element={<WorkspaceSearchPage />} path="search" />
          <Route element={<DiagnosticsPage />} path="diagnostics" />
          <Route element={<CorpusOverviewPage />} path="knowledge/:corpusId/overview" />
          <Route
            element={
              <LazyRoute>
                <CorpusFilesPage />
              </LazyRoute>
            }
            path="knowledge/:corpusId/files"
          />
          <Route element={<CorpusSearchPage />} path="knowledge/:corpusId/search" />
          <Route element={<CorpusLinksPage />} path="knowledge/:corpusId/links" />
          <Route
            element={
              <LazyRoute>
                <CorpusGraphPage />
              </LazyRoute>
            }
            path="knowledge/:corpusId/graph"
          />
          <Route element={<CorpusAskPage />} path="knowledge/:corpusId/ask" />
          <Route element={<SettingsLayout />} path="settings">
            <Route element={<Navigate replace to="workspace" />} index />
            <Route element={<WorkspaceSettingsPage />} path="workspace" />
            <Route element={<AiProvidersPage />} path="ai" />
            <Route element={<RankingSettingsPage />} path="ranking" />
            <Route element={<Navigate replace to="/diagnostics" />} path="diagnostics" />
            <Route element={<SecretsPage />} path="secrets" />
            <Route element={<McpTokensPage />} path="mcp-tokens" />
            <Route element={<ApiKeysPage />} path="api-keys" />
            <Route element={<AuditPage />} path="audit" />
            <Route element={<MutationApprovalsPage />} path="approvals" />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
