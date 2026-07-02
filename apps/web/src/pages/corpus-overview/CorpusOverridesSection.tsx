import type { RankingSettings, RankingStrategySummary } from '@evu/kb-sdk';
import { Button, Switch, tabClassName } from '@evu/kb-ui';
import type { Dispatch, SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { appRoutes } from '../../config.js';
import {
  APPROVAL_KEYS,
  type ApprovalInheritMode,
  type ApprovalKey,
  corpusRankingFields,
  type OverridesTab,
} from './corpus-settings.js';

interface CorpusOverridesSectionProps {
  overridesEnabled: boolean;
  setOverridesEnabled: (value: boolean) => void;
  hasPersistedOverrides: boolean;
  settingsSaving: boolean;
  syncing: boolean;
  overridesTab: OverridesTab;
  setOverridesTab: (value: OverridesTab) => void;
  rankingStrategyId: string;
  setRankingStrategyId: (value: string) => void;
  availableStrategies: RankingStrategySummary[];
  rankingOverrides: RankingSettings;
  updateRankingOverride: (key: keyof RankingSettings, raw: string) => void;
  approvalOverrides: Record<ApprovalKey, ApprovalInheritMode>;
  setApprovalOverrides: Dispatch<SetStateAction<Record<ApprovalKey, ApprovalInheritMode>>>;
  saveCorpusAdvancedSettings: () => Promise<void>;
}

export function CorpusOverridesSection({
  overridesEnabled,
  setOverridesEnabled,
  hasPersistedOverrides,
  settingsSaving,
  syncing,
  overridesTab,
  setOverridesTab,
  rankingStrategyId,
  setRankingStrategyId,
  availableStrategies,
  rankingOverrides,
  updateRankingOverride,
  approvalOverrides,
  setApprovalOverrides,
  saveCorpusAdvancedSettings,
}: CorpusOverridesSectionProps) {
  return (
    <div className="evukb-form">
      <fieldset>
        <legend>
          <span className="evukb-checkbox">
            <Switch
              aria-label="Corpus overrides"
              checked={overridesEnabled}
              disabled={settingsSaving || syncing}
              onCheckedChange={setOverridesEnabled}
            />
            <span>Corpus overrides</span>
          </span>
        </legend>
        {overridesEnabled ? (
          <>
            <p className="evukb-form-hint">
              Optional ranking and agent approval overrides for this corpus. Unset fields inherit{' '}
              <Link to={appRoutes.settingsRanking}>workspace ranking defaults</Link> and workspace
              approval policy.
            </p>
            <div
              aria-label="Corpus override sections"
              className="flex flex-wrap gap-6 border-b border-border"
              role="tablist"
            >
              <button
                aria-selected={overridesTab === 'ranking'}
                className={tabClassName(overridesTab === 'ranking')}
                id="corpus-overrides-tab-ranking"
                onClick={() => setOverridesTab('ranking')}
                type="button"
                role="tab"
              >
                Ranking
              </button>
              <button
                aria-selected={overridesTab === 'approval'}
                className={tabClassName(overridesTab === 'approval')}
                id="corpus-overrides-tab-approval"
                onClick={() => setOverridesTab('approval')}
                type="button"
                role="tab"
              >
                Mutation approval
              </button>
            </div>
            {overridesTab === 'ranking' ? (
              <div
                aria-labelledby="corpus-overrides-tab-ranking"
                className="flex flex-col gap-4"
                id="corpus-overrides-panel-ranking"
                role="tabpanel"
              >
                <label>
                  Ranking strategy
                  <select
                    disabled={settingsSaving}
                    onChange={(event) => setRankingStrategyId(event.target.value)}
                    value={rankingStrategyId}
                  >
                    {availableStrategies.map((strategy) => (
                      <option key={strategy.id} value={strategy.id}>
                        {strategy.id} (v{strategy.version})
                      </option>
                    ))}
                  </select>
                </label>
                <p className="evukb-form-hint">
                  Optional numeric multipliers for <code>hybrid_default_v1</code>. Leave a field
                  blank to inherit the workspace default.
                </p>
                <div className="evukb-form-grid">
                  {corpusRankingFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <input
                        disabled={settingsSaving}
                        inputMode="decimal"
                        type="text"
                        value={
                          typeof rankingOverrides[field.key] === 'number'
                            ? String(rankingOverrides[field.key])
                            : ''
                        }
                        onChange={(event) => updateRankingOverride(field.key, event.target.value)}
                      />
                      <span className="evukb-form-hint">{field.hint}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {overridesTab === 'approval' ? (
              <div
                aria-labelledby="corpus-overrides-tab-approval"
                className="flex flex-col gap-4"
                id="corpus-overrides-panel-approval"
                role="tabpanel"
              >
                <p className="evukb-form-hint">
                  Per-action override for agent writes in this corpus. Inherit uses the workspace
                  default.
                </p>
                <div className="evukb-form-grid md:grid-cols-2">
                  {APPROVAL_KEYS.map((key) => (
                    <label key={key}>
                      {key}
                      <select
                        disabled={settingsSaving}
                        onChange={(event) =>
                          setApprovalOverrides((current) => ({
                            ...current,
                            [key]: event.target.value as ApprovalInheritMode,
                          }))
                        }
                        value={approvalOverrides[key]}
                      >
                        <option value="inherit">inherit workspace default</option>
                        <option value="never">never (apply immediately)</option>
                        <option value="always">always (require approval)</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <Button
              disabled={settingsSaving || syncing}
              onClick={() => void saveCorpusAdvancedSettings()}
              type="button"
              variant="primary"
            >
              {settingsSaving ? 'Saving…' : 'Save corpus overrides'}
            </Button>
          </>
        ) : hasPersistedOverrides ? (
          <>
            <p className="evukb-form-hint">
              Corpus-specific overrides are saved. Turn overrides off and clear them to inherit
              workspace defaults.
            </p>
            <Button
              disabled={settingsSaving || syncing}
              onClick={() => void saveCorpusAdvancedSettings()}
              type="button"
              variant="outline"
            >
              {settingsSaving ? 'Saving…' : 'Clear corpus overrides'}
            </Button>
          </>
        ) : null}
      </fieldset>
    </div>
  );
}
