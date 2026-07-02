import { EmptyState, resolveFormatProfile } from '@evu/kb-ui';
import { useParams } from 'react-router-dom';
import { CorpusOverridesSection } from './corpus-overview/CorpusOverridesSection.js';
import { CorpusStatsCard } from './corpus-overview/CorpusStatsCard.js';
import { CorpusSummaryCard } from './corpus-overview/CorpusSummaryCard.js';
import { corpusOverridesEnabled } from './corpus-overview/corpus-settings.js';
import { DiagnosticsCard } from './corpus-overview/DiagnosticsCard.js';
import { PortabilityCard } from './corpus-overview/PortabilityCard.js';
import { useCorpusOverview } from './corpus-overview/use-corpus-overview.js';
import { WarningsCard } from './corpus-overview/WarningsCard.js';

export function CorpusOverviewPage() {
  const { corpusId } = useParams<{ corpusId: string }>();
  const overview = useCorpusOverview(corpusId);
  const { stats, corpus, loading, error } = overview;

  if (!corpusId) {
    return null;
  }

  if (loading) {
    return <p className="evukb-muted">Loading overview…</p>;
  }

  if (error) {
    return <p className="evukb-error">{error}</p>;
  }

  if (!stats) {
    return <EmptyState title="No stats available" hint="Try reloading the corpus overview." />;
  }

  const needingAttentionCount =
    stats.indexStatusCounts.pending +
    stats.indexStatusCounts.stale +
    stats.indexStatusCounts.failed;

  const formatProfile = resolveFormatProfile(corpus?.settings ?? {});
  const isOkfCorpus = formatProfile === 'okf';
  const okfStrictEnabled = corpus?.settings?.okfStrict === true;
  const importKind = stats.importKind ?? 'managed';
  const syncIntervalMinutes =
    typeof corpus?.settings?.syncIntervalMinutes === 'number'
      ? corpus.settings.syncIntervalMinutes
      : null;
  const nextDueAt =
    syncIntervalMinutes && stats.syncStatus?.lastSyncAt
      ? new Date(
          Date.parse(stats.syncStatus.lastSyncAt) + syncIntervalMinutes * 60_000,
        ).toLocaleString()
      : null;
  const hasPersistedOverrides = corpus
    ? corpusOverridesEnabled(corpus, overview.workspaceRankingStrategyId)
    : false;

  return (
    <div className="flex flex-col gap-4">
      <CorpusSummaryCard
        corpus={corpus}
        stats={stats}
        importKind={importKind}
        formatProfile={formatProfile}
        isOkfCorpus={isOkfCorpus}
        okfStrictEnabled={okfStrictEnabled}
        syncIntervalMinutes={syncIntervalMinutes}
        nextDueAt={nextDueAt}
        syncing={overview.syncing}
        reindexing={overview.reindexing}
        okfBusy={overview.okfBusy}
        settingsSaving={overview.settingsSaving}
        syncIntervalInput={overview.syncIntervalInput}
        setSyncIntervalInput={overview.setSyncIntervalInput}
        mountModeInput={overview.mountModeInput}
        setMountModeInput={overview.setMountModeInput}
        mountAuthoritativeEnabled={overview.mountAuthoritativeEnabled}
        importWritebackEnabled={overview.importWritebackEnabled}
        runSync={overview.runSync}
        saveSyncInterval={overview.saveSyncInterval}
        saveMountMode={overview.saveMountMode}
        toggleOkfStrict={overview.toggleOkfStrict}
      />

      {corpus ? (
        <CorpusOverridesSection
          overridesEnabled={overview.overridesEnabled}
          setOverridesEnabled={overview.setOverridesEnabled}
          hasPersistedOverrides={hasPersistedOverrides}
          settingsSaving={overview.settingsSaving}
          syncing={overview.syncing}
          overridesTab={overview.overridesTab}
          setOverridesTab={overview.setOverridesTab}
          rankingStrategyId={overview.rankingStrategyId}
          setRankingStrategyId={overview.setRankingStrategyId}
          availableStrategies={overview.availableStrategies}
          rankingOverrides={overview.rankingOverrides}
          updateRankingOverride={overview.updateRankingOverride}
          approvalOverrides={overview.approvalOverrides}
          setApprovalOverrides={overview.setApprovalOverrides}
          saveCorpusAdvancedSettings={overview.saveCorpusAdvancedSettings}
        />
      ) : null}

      <CorpusStatsCard stats={stats} />

      <WarningsCard warnings={stats.warnings} />

      <PortabilityCard
        portableBusy={overview.portableBusy}
        reindexing={overview.reindexing}
        runExportPortable={overview.runExportPortable}
        runImportPortable={overview.runImportPortable}
      />

      <DiagnosticsCard
        isOkfCorpus={isOkfCorpus}
        okfBusy={overview.okfBusy}
        reindexing={overview.reindexing}
        validatingCitations={overview.validatingCitations}
        needingAttentionCount={needingAttentionCount}
        actionError={overview.actionError}
        actionMessage={overview.actionMessage}
        convertResult={overview.convertResult}
        runConvertToOkf={overview.runConvertToOkf}
        runExportOkf={overview.runExportOkf}
        runValidateCitations={overview.runValidateCitations}
        runReindexAll={overview.runReindexAll}
        runReindexNeedingAttention={overview.runReindexNeedingAttention}
      />
      {overview.confirmModal}
    </div>
  );
}
