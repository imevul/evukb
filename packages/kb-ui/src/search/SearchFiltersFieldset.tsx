import { Switch } from '../switch.js';

import type { SearchFilterDraft } from './search-filters.js';

const sourceTypeOptions = ['managed', 'shared_mount', 'git', 'reference', 'import'] as const;
const indexStatusOptions = ['pending', 'indexing', 'indexed', 'stale', 'failed'] as const;

export type SearchFiltersFieldsetProps = {
  draft: SearchFilterDraft;
  onChange: (next: SearchFilterDraft) => void;
};

export function SearchFiltersFieldset({ draft, onChange }: SearchFiltersFieldsetProps) {
  function toggleValue(values: string[], value: string): string[] {
    return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  }

  return (
    <fieldset>
      <legend>
        <span className="evukb-checkbox">
          <Switch
            aria-label="Advanced filters"
            checked={draft.showAdvanced}
            onCheckedChange={(checked) => onChange({ ...draft, showAdvanced: checked })}
          />
          <span>Advanced filters</span>
        </span>
      </legend>
      {draft.showAdvanced ? (
        <>
          <p className="evukb-form-hint">
            Filter by tags, file type, OKF type, path prefixes, frontmatter fields, source type, or
            index status. Frontmatter values support <code>*</code> and <code>?</code> wildcards.
          </p>
          <div className="evukb-form-grid md:grid-cols-2">
            <label>
              Tags (comma-separated)
              <input
                placeholder="ops, core"
                value={draft.tags}
                onChange={(event) => onChange({ ...draft, tags: event.target.value })}
              />
            </label>
            <label>
              File type
              <input
                placeholder="markdown"
                value={draft.fileType}
                onChange={(event) => onChange({ ...draft, fileType: event.target.value })}
              />
            </label>
            <label>
              OKF type
              <input
                placeholder="Playbook"
                value={draft.okfType}
                onChange={(event) => onChange({ ...draft, okfType: event.target.value })}
              />
            </label>
            <label>
              Path allowlist (comma-separated prefixes)
              <input
                placeholder="docs, guides/ops"
                value={draft.pathAllowlist}
                onChange={(event) => onChange({ ...draft, pathAllowlist: event.target.value })}
              />
            </label>
            <label className="md:col-span-2">
              Frontmatter (key:value, comma-separated)
              <input
                placeholder="status:active, title:New*"
                value={draft.frontmatter}
                onChange={(event) => onChange({ ...draft, frontmatter: event.target.value })}
              />
            </label>
          </div>
          <div className="evukb-form-grid md:grid-cols-2">
            <fieldset>
              <legend>Source types</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2.5">
                {sourceTypeOptions.map((sourceType) => (
                  <span key={sourceType} className="evukb-checkbox">
                    <Switch
                      aria-label={sourceType}
                      checked={draft.sourceTypes.includes(sourceType)}
                      onCheckedChange={() =>
                        onChange({
                          ...draft,
                          sourceTypes: toggleValue(draft.sourceTypes, sourceType),
                        })
                      }
                    />
                    <span>{sourceType}</span>
                  </span>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Index status</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2.5">
                {indexStatusOptions.map((status) => (
                  <span key={status} className="evukb-checkbox">
                    <Switch
                      aria-label={status}
                      checked={draft.indexStatus.includes(status)}
                      onCheckedChange={() =>
                        onChange({
                          ...draft,
                          indexStatus: toggleValue(draft.indexStatus, status),
                        })
                      }
                    />
                    <span>{status}</span>
                  </span>
                ))}
              </div>
            </fieldset>
          </div>
        </>
      ) : null}
    </fieldset>
  );
}
