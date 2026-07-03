export type { AlertProps, AlertVariant } from './alert.js';
export { Alert } from './alert.js';
export type { AppModalProps, AppModalSize } from './app-modal.js';
export { AppModal } from './app-modal.js';
export type { AppContentProps, AppNavItem, AppShellProps } from './app-shell.js';
export { AppContent, AppShell } from './app-shell.js';
export type { AskPanelProps } from './ask/AskPanel.js';
export { AskPanel } from './ask/AskPanel.js';
export type { AskResponseViewProps } from './ask/AskResponseView.js';
export { AskResponseView } from './ask/AskResponseView.js';
export {
  firstRerankUsage,
  mapOperationUsage,
  mapUsedChunks,
  mergeAskStreamDone,
} from './ask/ask-trace.js';
export type { BadgeProps, StatusBadgeProps, StatusTone } from './badge.js';
export { Badge, STATUS_TONE_CLASS, StatusBadge, statusTone } from './badge.js';
export type { CitationItem, CitationListProps } from './citation-list.js';
export { CitationList } from './citation-list.js';
export { cn } from './cn.js';
export type { ConfirmModalProps } from './confirm-modal.js';
export { ConfirmModal } from './confirm-modal.js';
export { TAB_CLASS, tabClassName } from './detail-tab-class.js';
export type { DetailTabItem, DetailTabsProps } from './detail-tabs.js';
export { DetailTabs } from './detail-tabs.js';
export {
  DisplayPreferencesProvider,
  useDisplayPreferences,
  useFormatDateTime,
} from './display/DisplayPreferencesProvider.js';
export { DisplayPreferencesSettings } from './display/DisplayPreferencesSettings.js';
export type {
  DateFormat,
  DateFormatPreference,
  DisplayPreferences,
  EffectiveDisplayPreferences,
  LocalePreference,
  ResolvedTimeFormat,
  TimeFormatPreference,
  TimeZonePreference,
} from './display/display-preferences.js';
export {
  COMMON_LOCALES,
  COMMON_TIME_ZONES,
  DATE_FORMAT_OPTIONS,
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_PREFERENCES_STORAGE_KEY,
  detectSystemTimeFormat,
  EXAMPLE_CUSTOM_DISPLAY_PREFERENCES,
  getSystemLocale,
  getSystemTimeZone,
  isValidTimeZone,
  readStoredDisplayPreferences,
  resolveDisplayPreferences,
  SYSTEM_SETTING,
  writeStoredDisplayPreferences,
} from './display/display-preferences.js';
export { formatDateTime } from './display/format-date-time.js';
export type { EmptyStateProps } from './empty-state.js';
export { EmptyState } from './empty-state.js';
// Note: CodeMirrorFileEditor is intentionally not re-exported here. It is
// loaded via dynamic import inside FileEditorModal so bundlers can split the
// heavy CodeMirror dependency out of the main chunk.
export type { CodeMirrorFileEditorProps } from './file-manager/CodeMirrorFileEditor.js';
export type { CorpusFileManagerPanelProps } from './file-manager/CorpusFileManagerPanel.js';
export { CorpusFileManagerPanel } from './file-manager/CorpusFileManagerPanel.js';
export type {
  FileCreateFolderModalProps,
  FileCreateModalProps,
} from './file-manager/FileCreateModal.js';
export { FileCreateFolderModal, FileCreateModal } from './file-manager/FileCreateModal.js';
export type { FileEditorModalProps } from './file-manager/FileEditorModal.js';
export { FileEditorModal } from './file-manager/FileEditorModal.js';
export type { FileRenameModalProps } from './file-manager/FileRenameModal.js';
export { FileRenameModal } from './file-manager/FileRenameModal.js';
export type { FrontmatterPanelProps } from './file-manager/FrontmatterPanel.js';
export { FrontmatterPanel } from './file-manager/FrontmatterPanel.js';
export type { FrontmatterFields } from './file-manager/frontmatter-sync.js';
export {
  applyFrontmatterFields,
  mergeMarkdownFrontmatter,
  removeFrontmatterField,
  splitMarkdownFrontmatter,
  updateFrontmatterField,
} from './file-manager/frontmatter-sync.js';
export {
  collectEditorValidationMessages,
  fixOkfFrontmatterBoilerplate,
  nodeHasValidationIssues,
  readValidationIssues,
  resolveFormatProfile,
} from './file-manager/okf-helpers.js';
export type { FileManagerListProps } from './file-manager-list.js';
export { FileManagerList } from './file-manager-list.js';
export type {
  FileTreeBreadcrumb,
  FileTreeListEntry,
  FileTreeNode,
  FileTreeNodeType,
} from './file-manager-types.js';
export { FILE_TREE_NODE_DRAG_MIME } from './file-manager-types.js';
export {
  buildFileTreeBreadcrumbs,
  buildFileTreeListEntries,
  formatFileTreeBytes,
  isDescendantOf,
  isInvalidMoveTarget,
  nodeFolderPath,
} from './file-manager-utils.js';
export type {
  ContextMenuItem,
  ContextMenuProps,
  FileBreadcrumbsProps,
  FileTreePaneProps,
  FileTreeRowProps,
} from './file-tree.js';
export { ContextMenu, FileBreadcrumbs, FileTreePane, FileTreeRow } from './file-tree.js';
export {
  FORM_CONTROL_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
  Input,
  Label,
  Textarea,
} from './form.js';
export type {
  GraphNeighborhoodPanelProps,
  GraphNeighborhoodViewProps,
} from './graph/GraphNeighborhoodView.js';
export {
  GraphNeighborhoodPanel,
  GraphNeighborhoodView,
  layoutNeighborhood,
} from './graph/GraphNeighborhoodView.js';
export type { CorpusIndexEventProviderProps } from './hooks/CorpusIndexEventProvider.js';
export {
  CorpusIndexEventProvider,
  useCorpusIndexEventListener,
} from './hooks/CorpusIndexEventProvider.js';
export {
  patchIndexStatusCounts,
  patchNodeIndexStatus,
} from './hooks/corpus-index-event-patch.js';
export type { AskStreamFns, UseAskStreamResult } from './hooks/useAskStream.js';
export { useAskStream } from './hooks/useAskStream.js';
export type {
  CorpusFileManagerContextMenuState,
  UseCorpusFileManagerOptions,
  UseCorpusFileManagerReturn,
} from './hooks/useCorpusFileManager.js';
export { useCorpusFileManager } from './hooks/useCorpusFileManager.js';
export type { UseCorpusIndexEventSubscriptionOptions } from './hooks/useCorpusIndexEventSubscription.js';
export { useCorpusIndexEventSubscription } from './hooks/useCorpusIndexEventSubscription.js';
export { useLinkGraph } from './hooks/useLinkGraph.js';
export type { RankingStrategyOptions } from './hooks/useRankingStrategyOptions.js';
export { useRankingStrategyOptions } from './hooks/useRankingStrategyOptions.js';
export type {
  UseWorkspaceCorporaResult,
  WorkspaceCorpusOption,
} from './hooks/useWorkspaceCorpora.js';
export { useWorkspaceCorpora } from './hooks/useWorkspaceCorpora.js';
export type { LinkGraphOverviewProps } from './links/LinkGraphOverview.js';
export { LinkGraphOverview } from './links/LinkGraphOverview.js';
export {
  renderObsidianMarkdown,
  sanitizeMarkdownPreviewHtml,
  shouldRenderMarkdownAsPlainText,
} from './markdown-safety.js';
export type { OperationUsageSummaryProps } from './operation-usage-summary.js';
export { OperationUsageSummary } from './operation-usage-summary.js';
export type { PageHeaderProps, PageTab } from './page-header.js';
export { PageHeader } from './page-header.js';
export type {
  ButtonProps,
  CardProps,
  FieldProps,
  PageTitleProps,
  PageToolbarProps,
} from './primitives.js';
export {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  PageTitle,
  PageToolbar,
} from './primitives.js';
export type { RetrievalTracePanelProps } from './retrieval-trace-panel.js';
export { RetrievalTracePanel } from './retrieval-trace-panel.js';
export type { CorpusMultiSelectProps } from './search/CorpusMultiSelect.js';
export { CorpusMultiSelect } from './search/CorpusMultiSelect.js';
export type { RankingStrategySelectProps } from './search/RankingStrategySelect.js';
export {
  RankingStrategySelect,
  resolvedSearchStrategyId,
} from './search/RankingStrategySelect.js';
export type { SearchFiltersFieldsetProps } from './search/SearchFiltersFieldset.js';
export { SearchFiltersFieldset } from './search/SearchFiltersFieldset.js';
export type { SearchPanelProps } from './search/SearchPanel.js';
export { SearchPanel } from './search/SearchPanel.js';
export type { SearchResultsSectionProps } from './search/SearchResultsSection.js';
export { SearchResultsSection } from './search/SearchResultsSection.js';
export type { SearchFilterDraft } from './search/search-filters.js';
export {
  buildKnowledgeFilters,
  emptySearchFilterDraft,
} from './search/search-filters.js';
export {
  readStoredWorkspaceCorpusIds,
  removeStoredWorkspaceCorpusId,
  resolveWorkspaceCorpusSelection,
  writeStoredWorkspaceCorpusIds,
} from './search/workspace-corpus-selection.js';
export type { SearchResultItem, SearchResultListProps } from './search-result-list.js';
export { SearchResultList } from './search-result-list.js';
export type { EvuKbShellProps, StatusPillProps } from './shell.js';
export { EvuKbShell, StatusPill } from './shell.js';
export type { SwitchProps } from './switch.js';
export { Switch } from './switch.js';
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table.js';
export {
  ColorSchemeProvider,
  useColorScheme,
} from './theme/ColorSchemeProvider.js';
export type {
  ColorSchemePreference,
  EffectiveColorScheme,
} from './theme/color-scheme.js';
export {
  applyDocumentColorScheme,
  readStoredColorSchemePreference,
  readSystemPrefersDark,
  resolveEffectiveColorScheme,
  writeStoredColorSchemePreference,
} from './theme/color-scheme.js';
export type { ThemeMenuProps, ThemePreference } from './theme-menu.js';
export { ThemeMenu } from './theme-menu.js';
export type {
  TraceOperationUsage,
  TraceRetrievalTrace,
  TraceSearchRanking,
  TraceUsedChunk,
} from './trace-types.js';
export type { ConfirmActionRequest, UseConfirmActionResult } from './use-confirm-action.js';
export { useConfirmAction } from './use-confirm-action.js';

export const evuKbUiPackageName = '@evu/kb-ui';
