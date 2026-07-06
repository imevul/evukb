import type {
  CorpusArchiveImportResult,
  IndexEnqueueResponse,
  KnowledgeCorpus,
  KnowledgeCorpusStats,
  OkfConvertResult,
  RankingSettings,
  RankingStrategySummary,
} from '@evu/kb-sdk';
import {
  patchIndexStatusCounts,
  resolveFormatProfile,
  useConfirmAction,
  useCorpusIndexEventSubscription,
} from '@evu/kb-ui';
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { kbClient } from '../../api/client.js';
import { useWorkspace } from '../../workspace/WorkspaceProvider.js';
import { normalizeArchiveUploadFile } from '../../lib/archive-import-normalize.js';
import {
  type AgentNotesRetrievalMode,
  APPROVAL_KEYS,
  type ApprovalInheritMode,
  type ApprovalKey,
  corpusOverridesEnabled,
  defaultAgentNotesRetrievalOverride,
  defaultApprovalOverrides,
  formatAgentWritePathPrefixesInput,
  type MountModeChoice,
  type OverridesTab,
  parseAgentWritePathPrefixesInput,
  readCorpusAgentNotesRetrieval,
  readCorpusAgentWritePathPrefixes,
  readCorpusApprovalPolicy,
  readCorpusRanking,
  summarizeConvertResult,
  summarizeReindexEnqueue,
} from './corpus-settings.js';

export interface CorpusOverviewState {
  stats: KnowledgeCorpusStats | null;
  corpus: KnowledgeCorpus | null;
  loading: boolean;
  error: string | null;
  reindexing: boolean;
  validatingCitations: boolean;
  okfBusy: boolean;
  portableBusy: boolean;
  actionError: string | null;
  actionMessage: string | null;
  convertResult: OkfConvertResult | null;
  settingsSaving: boolean;
  syncing: boolean;
  syncIntervalInput: string;
  setSyncIntervalInput: (value: string) => void;
  mountModeInput: MountModeChoice;
  setMountModeInput: (value: MountModeChoice) => void;
  mountAuthoritativeEnabled: boolean;
  importWritebackEnabled: boolean;
  rankingStrategyId: string;
  setRankingStrategyId: (value: string) => void;
  workspaceRankingStrategyId: string;
  overridesEnabled: boolean;
  setOverridesEnabled: (value: boolean) => void;
  overridesTab: OverridesTab;
  setOverridesTab: (value: OverridesTab) => void;
  availableStrategies: RankingStrategySummary[];
  rankingOverrides: RankingSettings;
  updateRankingOverride: (key: keyof RankingSettings, raw: string) => void;
  approvalOverrides: Record<ApprovalKey, ApprovalInheritMode>;
  setApprovalOverrides: Dispatch<SetStateAction<Record<ApprovalKey, ApprovalInheritMode>>>;
  agentNotesRetrieval: AgentNotesRetrievalMode;
  setAgentNotesRetrieval: (value: AgentNotesRetrievalMode) => void;
  agentWritePathPrefixesInput: string;
  setAgentWritePathPrefixesInput: (value: string) => void;
  confirmModal: ReactNode;
  runReindexAll: () => Promise<void>;
  runReindexNeedingAttention: () => Promise<void>;
  runValidateCitations: () => Promise<void>;
  runConvertToOkf: () => void;
  runExportOkf: () => Promise<void>;
  runExportPortable: () => Promise<void>;
  runImportPortable: (file: File) => Promise<void>;
  runSync: (action: 'mount' | 'git') => Promise<void>;
  saveSyncInterval: () => Promise<void>;
  saveMountMode: () => Promise<void>;
  saveCorpusAdvancedSettings: () => Promise<void>;
  toggleOkfStrict: (enabled: boolean) => Promise<void>;
}

export function useCorpusOverview(corpusId: string | undefined): CorpusOverviewState {
  const { selectedSlug } = useWorkspace();
  const [stats, setStats] = useState<KnowledgeCorpusStats | null>(null);
  const [corpus, setCorpus] = useState<KnowledgeCorpus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [validatingCitations, setValidatingCitations] = useState(false);
  const [okfBusy, setOkfBusy] = useState(false);
  const [portableBusy, setPortableBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [convertResult, setConvertResult] = useState<OkfConvertResult | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [syncIntervalInput, setSyncIntervalInput] = useState('');
  const [mountModeInput, setMountModeInput] = useState<MountModeChoice>('import');
  const [mountAuthoritativeEnabled, setMountAuthoritativeEnabled] = useState(false);
  const [importWritebackEnabled, setImportWritebackEnabled] = useState(false);
  const [rankingStrategyId, setRankingStrategyId] = useState('hybrid_default_v1');
  const [workspaceRankingStrategyId, setWorkspaceRankingStrategyId] = useState('hybrid_default_v1');
  const [overridesEnabled, setOverridesEnabled] = useState(false);
  const [overridesTab, setOverridesTab] = useState<OverridesTab>('ranking');
  const [availableStrategies, setAvailableStrategies] = useState<RankingStrategySummary[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [rankingOverrides, setRankingOverrides] = useState<RankingSettings>({});
  const [approvalOverrides, setApprovalOverrides] = useState<
    Record<ApprovalKey, ApprovalInheritMode>
  >(defaultApprovalOverrides());
  const [agentNotesRetrieval, setAgentNotesRetrieval] = useState<AgentNotesRetrievalMode>(
    defaultAgentNotesRetrievalOverride(),
  );
  const [agentWritePathPrefixesInput, setAgentWritePathPrefixesInput] = useState('');

  const { confirm, confirmModal } = useConfirmAction();

  const loadStats = useCallback(async () => {
    if (!corpusId) {
      setStats(null);
      setCorpus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [loadedStats, loadedCorpus, loadedSettings] = await Promise.all([
        kbClient.getCorpusStats(selectedSlug, corpusId),
        kbClient.getCorpus(selectedSlug, corpusId),
        kbClient.getSettings(selectedSlug),
      ]);
      setStats(loadedStats);
      setCorpus(loadedCorpus);
      setRankingOverrides(readCorpusRanking(loadedCorpus.settings ?? {}));
      setApprovalOverrides(readCorpusApprovalPolicy(loadedCorpus.settings ?? {}));
      setAgentNotesRetrieval(readCorpusAgentNotesRetrieval(loadedCorpus.settings ?? {}));
      setAgentWritePathPrefixesInput(
        formatAgentWritePathPrefixesInput(
          readCorpusAgentWritePathPrefixes(loadedCorpus.settings ?? {}),
        ),
      );
      setRankingStrategyId(loadedCorpus.rankingStrategyId);
      setWorkspaceRankingStrategyId(loadedSettings.ranking.strategyId);
      setOverridesEnabled(corpusOverridesEnabled(loadedCorpus, loadedSettings.ranking.strategyId));
      setOverridesTab('ranking');
      setAvailableStrategies(loadedSettings.ranking.availableStrategies);
      setMountAuthoritativeEnabled(loadedSettings.bootHints.mountAuthoritativeEnabled);
      setImportWritebackEnabled(loadedSettings.bootHints.importWritebackEnabled);
      const interval = loadedCorpus.settings?.syncIntervalMinutes;
      setSyncIntervalInput(typeof interval === 'number' && interval > 0 ? String(interval) : '');
      const mountMode = loadedCorpus.settings?.mountMode;
      setMountModeInput(
        mountMode === 'mount_authoritative'
          ? 'mount_authoritative'
          : mountMode === 'import_writeback'
            ? 'import_writeback'
            : 'import',
      );
      setError(null);
    } catch (loadError: unknown) {
      setStats(null);
      setCorpus(null);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load corpus overview.');
    } finally {
      setLoading(false);
    }
  }, [corpusId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useCorpusIndexEventSubscription({
    enabled: Boolean(corpusId) && stats != null,
    onEvent: useCallback((event) => {
      setStats((current) => {
        if (!current) {
          return current;
        }
        const nextCounts = patchIndexStatusCounts(current.indexStatusCounts, event);
        if (nextCounts === current.indexStatusCounts) {
          return current;
        }
        return { ...current, indexStatusCounts: nextCounts };
      });
    }, []),
  });

  async function runReindex(
    action: 'all' | 'needing',
    runner: () => Promise<IndexEnqueueResponse>,
  ): Promise<void> {
    if (!corpusId) {
      return;
    }

    setReindexing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await runner();
      setActionMessage(summarizeReindexEnqueue(response));
      await loadStats();
    } catch (reindexError: unknown) {
      setActionError(
        reindexError instanceof Error ? reindexError.message : `Failed to reindex ${action} files.`,
      );
    } finally {
      setReindexing(false);
    }
  }

  async function runReindexAll(): Promise<void> {
    if (!corpusId) {
      return;
    }
    await runReindex('all', () => kbClient.reindexCorpus(selectedSlug, corpusId));
  }

  async function runReindexNeedingAttention(): Promise<void> {
    if (!corpusId) {
      return;
    }
    await runReindex('needing', () =>
      kbClient.reindexNeedingAttention(selectedSlug, corpusId),
    );
  }

  async function runValidateCitations(): Promise<void> {
    if (!corpusId) {
      return;
    }

    setValidatingCitations(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await kbClient.validateCitations(selectedSlug, corpusId);
      setActionMessage(
        response.enqueued === 0
          ? 'No citation validation jobs were enqueued.'
          : `Enqueued ${response.enqueued} citation validation job${response.enqueued === 1 ? '' : 's'}.`,
      );
      await loadStats();
    } catch (validateError: unknown) {
      setActionError(
        validateError instanceof Error ? validateError.message : 'Failed to validate citations.',
      );
    } finally {
      setValidatingCitations(false);
    }
  }

  async function executeConvertToOkf(): Promise<void> {
    if (!corpusId) {
      return;
    }

    setOkfBusy(true);
    setActionError(null);
    setActionMessage(null);
    setConvertResult(null);
    try {
      const result = await kbClient.convertToOkf(selectedSlug, corpusId, {
        synthesizeIndex: true,
      });
      setConvertResult(result);
      setActionMessage(summarizeConvertResult(result));
      await loadStats();
    } catch (convertError: unknown) {
      setActionError(
        convertError instanceof Error ? convertError.message : 'Failed to convert corpus to OKF.',
      );
      throw convertError;
    } finally {
      setOkfBusy(false);
    }
  }

  function runConvertToOkf(): void {
    if (!corpusId) {
      return;
    }

    const isOkf = resolveFormatProfile(corpus?.settings ?? {}) === 'okf';
    if (isOkf) {
      void executeConvertToOkf();
      return;
    }

    confirm({
      title: 'Convert corpus to OKF?',
      body: (
        <p>
          This injects concept types and sets the OKF format profile for all markdown files in this
          corpus.
        </p>
      ),
      confirmLabel: 'Convert to OKF',
      confirmingLabel: 'Converting…',
      action: executeConvertToOkf,
    });
  }

  async function runExportOkf(): Promise<void> {
    if (!corpusId) {
      return;
    }

    setOkfBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const zip = await kbClient.exportOkfZip(selectedSlug, corpusId);
      const blob = new Blob([zip], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${corpus?.name?.trim() || corpusId}-okf.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setActionMessage('OKF zip download started.');
    } catch (exportError: unknown) {
      setActionError(
        exportError instanceof Error ? exportError.message : 'Failed to export OKF zip.',
      );
    } finally {
      setOkfBusy(false);
    }
  }

  async function runExportPortable(): Promise<void> {
    if (!corpusId) {
      return;
    }

    setPortableBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const zip = await kbClient.exportPortableZip(selectedSlug, corpusId);
      const blob = new Blob([zip], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${corpus?.name?.trim() || corpusId}.evukb.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setActionMessage('Portable export download started.');
    } catch (exportError: unknown) {
      setActionError(
        exportError instanceof Error ? exportError.message : 'Failed to export portable archive.',
      );
    } finally {
      setPortableBusy(false);
    }
  }

  async function runImportPortable(file: File): Promise<void> {
    if (!corpusId) {
      return;
    }

    setPortableBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const zipFile = await normalizeArchiveUploadFile(file);
      const result: CorpusArchiveImportResult = await kbClient.importPortableZip(
        selectedSlug,
        corpusId,
        zipFile,
      );
      const parts = [
        `imported ${result.imported}`,
        `updated ${result.updated}`,
        `skipped ${result.skipped}`,
      ];
      if (result.mode === 'portable') {
        parts.push(`links ${result.linksRestored}`);
      }
      parts.push(`indexed ${result.indexed}`);
      if (result.warnings.length > 0) {
        parts.push(`${result.warnings.length} warning(s)`);
      }
      if (result.errors.length > 0) {
        parts.push(`${result.errors.length} error(s)`);
      }
      setActionMessage(`${result.mode} import complete: ${parts.join(', ')}.`);
      await loadStats();
    } catch (importError: unknown) {
      setActionError(
        importError instanceof Error ? importError.message : 'Failed to import archive.',
      );
    } finally {
      setPortableBusy(false);
    }
  }

  async function runSync(action: 'mount' | 'git'): Promise<void> {
    if (!corpusId) {
      return;
    }

    setSyncing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response =
        action === 'mount'
          ? await kbClient.syncMount(selectedSlug, corpusId)
          : await kbClient.syncGit(selectedSlug, corpusId);
      setActionMessage(
        response.enqueued
          ? `${action === 'mount' ? 'Mount' : 'Git'} sync job enqueued.`
          : 'Sync was not enqueued.',
      );
      await loadStats();
    } catch (syncError: unknown) {
      setActionError(syncError instanceof Error ? syncError.message : 'Failed to enqueue sync.');
    } finally {
      setSyncing(false);
    }
  }

  async function saveSyncInterval(): Promise<void> {
    if (!corpusId || !corpus) {
      return;
    }

    setSettingsSaving(true);
    setActionError(null);
    try {
      const parsed = syncIntervalInput.trim() === '' ? 0 : Number.parseInt(syncIntervalInput, 10);
      const nextSettings = { ...corpus.settings };
      if (!Number.isFinite(parsed) || parsed <= 0) {
        delete nextSettings.syncIntervalMinutes;
      } else {
        nextSettings.syncIntervalMinutes = parsed;
      }
      const updated = await kbClient.updateCorpus(selectedSlug, corpusId, {
        settings: nextSettings,
      });
      setCorpus(updated);
      setActionMessage('Sync interval updated.');
    } catch (settingsError: unknown) {
      setActionError(
        settingsError instanceof Error ? settingsError.message : 'Failed to update sync interval.',
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveMountMode(): Promise<void> {
    if (!corpusId || !corpus) {
      return;
    }

    setSettingsSaving(true);
    setActionError(null);
    try {
      const updated = await kbClient.updateCorpus(selectedSlug, corpusId, {
        settings: {
          ...corpus.settings,
          mountMode: mountModeInput,
        },
      });
      setCorpus(updated);
      setActionMessage('Mount sync mode updated.');
    } catch (settingsError: unknown) {
      setActionError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Failed to update mount sync mode.',
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveCorpusAdvancedSettings(): Promise<void> {
    if (!corpusId || !corpus) {
      return;
    }

    setSettingsSaving(true);
    setActionError(null);
    try {
      const nextSettings = { ...corpus.settings };

      if (!overridesEnabled) {
        delete nextSettings.rankingSettings;
        delete nextSettings.agentMutationApprovalPolicy;
        delete nextSettings.includeAgentNotesInRetrieval;
        delete nextSettings.agentWritePathPrefixes;
        const updated = await kbClient.updateCorpus(selectedSlug, corpusId, {
          settings: nextSettings,
          rankingStrategyId: workspaceRankingStrategyId,
        });
        setCorpus(updated);
        setRankingStrategyId(updated.rankingStrategyId);
        setRankingOverrides({});
        setApprovalOverrides(defaultApprovalOverrides());
        setAgentNotesRetrieval(defaultAgentNotesRetrievalOverride());
        setAgentWritePathPrefixesInput('');
        setActionMessage('Corpus overrides cleared.');
        return;
      }

      const hasRanking = Object.values(rankingOverrides).some(
        (value) => value !== undefined && value !== null,
      );
      if (hasRanking) {
        nextSettings.rankingSettings = rankingOverrides;
      } else {
        delete nextSettings.rankingSettings;
      }

      const hasApprovalOverride = APPROVAL_KEYS.some((key) => approvalOverrides[key] !== 'inherit');
      if (hasApprovalOverride) {
        nextSettings.agentMutationApprovalPolicy = approvalOverrides;
      } else {
        delete nextSettings.agentMutationApprovalPolicy;
      }

      if (agentNotesRetrieval === 'include') {
        nextSettings.includeAgentNotesInRetrieval = true;
      } else if (agentNotesRetrieval === 'exclude') {
        nextSettings.includeAgentNotesInRetrieval = false;
      } else {
        delete nextSettings.includeAgentNotesInRetrieval;
      }

      const parsedWritePrefixes = parseAgentWritePathPrefixesInput(agentWritePathPrefixesInput);
      if (parsedWritePrefixes.length > 0) {
        nextSettings.agentWritePathPrefixes = parsedWritePrefixes;
      } else {
        delete nextSettings.agentWritePathPrefixes;
      }

      const updated = await kbClient.updateCorpus(selectedSlug, corpusId, {
        settings: nextSettings,
        rankingStrategyId,
      });
      setCorpus(updated);
      setRankingStrategyId(updated.rankingStrategyId);
      setRankingOverrides(readCorpusRanking(updated.settings ?? {}));
      setApprovalOverrides(readCorpusApprovalPolicy(updated.settings ?? {}));
      setAgentNotesRetrieval(readCorpusAgentNotesRetrieval(updated.settings ?? {}));
      setAgentWritePathPrefixesInput(
        formatAgentWritePathPrefixesInput(readCorpusAgentWritePathPrefixes(updated.settings ?? {})),
      );
      setActionMessage('Corpus settings updated.');
    } catch (settingsError: unknown) {
      setActionError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Failed to update corpus settings.',
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  function updateRankingOverride(key: keyof RankingSettings, raw: string): void {
    const value = raw.trim() === '' ? undefined : Number.parseFloat(raw);
    setRankingOverrides((current) => ({
      ...current,
      [key]: value !== undefined && Number.isFinite(value) ? value : undefined,
    }));
  }

  async function toggleOkfStrict(enabled: boolean): Promise<void> {
    if (!corpusId || !corpus) {
      return;
    }

    setSettingsSaving(true);
    setActionError(null);
    try {
      const updated = await kbClient.updateCorpus(selectedSlug, corpusId, {
        settings: {
          ...corpus.settings,
          okfStrict: enabled,
        },
      });
      setCorpus(updated);
      setActionMessage(enabled ? 'Strict OKF enabled for saves.' : 'Strict OKF disabled.');
    } catch (settingsError: unknown) {
      setActionError(
        settingsError instanceof Error ? settingsError.message : 'Failed to update OKF settings.',
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  return {
    stats,
    corpus,
    loading,
    error,
    reindexing,
    validatingCitations,
    okfBusy,
    portableBusy,
    actionError,
    actionMessage,
    convertResult,
    settingsSaving,
    syncing,
    syncIntervalInput,
    setSyncIntervalInput,
    mountModeInput,
    setMountModeInput,
    mountAuthoritativeEnabled,
    importWritebackEnabled,
    rankingStrategyId,
    setRankingStrategyId,
    workspaceRankingStrategyId,
    overridesEnabled,
    setOverridesEnabled,
    overridesTab,
    setOverridesTab,
    availableStrategies,
    rankingOverrides,
    updateRankingOverride,
    approvalOverrides,
    setApprovalOverrides,
    agentNotesRetrieval,
    setAgentNotesRetrieval,
    agentWritePathPrefixesInput,
    setAgentWritePathPrefixesInput,
    confirmModal,
    runReindexAll,
    runReindexNeedingAttention,
    runValidateCitations,
    runConvertToOkf,
    runExportOkf,
    runExportPortable,
    runImportPortable,
    runSync,
    saveSyncInterval,
    saveMountMode,
    saveCorpusAdvancedSettings,
    toggleOkfStrict,
  };
}
