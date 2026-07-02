import type { KbAuthScope } from '@evu/kb-sdk';
import { Label, Switch } from '@evu/kb-ui';

export type KbAuthScopeArea = {
  id: KbAuthScope;
  label: string;
  description: string;
};

export const KB_AUTH_SCOPE_AREAS: KbAuthScopeArea[] = [
  {
    id: 'kb:read',
    label: 'Read',
    description: 'Search, list corpora, get documents, read chunks, and follow links.',
  },
  {
    id: 'kb:write',
    label: 'Write',
    description: 'Create, append, update, and delete agent-notes via tools/kb and MCP.',
  },
];

export type KbAuthScopePickerProps = {
  areas?: KbAuthScopeArea[];
  idPrefix: string;
  onChange: (next: Set<KbAuthScope>) => void;
  selected: Set<KbAuthScope>;
};

export function KbAuthScopePicker({
  areas = KB_AUTH_SCOPE_AREAS,
  idPrefix,
  onChange,
  selected,
}: KbAuthScopePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {areas.map((area) => {
        const checked = selected.has(area.id);
        const controlId = `${idPrefix}-scope-${area.id}`;
        return (
          <div
            key={area.id}
            className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3 dark:bg-background/20"
          >
            <Switch
              aria-label={`${area.label} scope`}
              checked={checked}
              id={controlId}
              onCheckedChange={(enabled) => {
                const next = new Set(selected);
                if (enabled) {
                  next.add(area.id);
                } else {
                  next.delete(area.id);
                }
                onChange(next);
              }}
            />
            <label className="min-w-0 cursor-pointer" htmlFor={controlId}>
              <span className="block font-mono text-sm font-medium">{area.id}</span>
              <span className="block text-xs text-muted-foreground">{area.description}</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function kbAuthScopesFromSelection(selected: Set<KbAuthScope>): KbAuthScope[] {
  const scopes: KbAuthScope[] = [];
  if (selected.has('kb:read')) {
    scopes.push('kb:read');
  }
  if (selected.has('kb:write')) {
    scopes.push('kb:write');
  }
  return scopes;
}

export function kbAuthScopeSelectionLabel(selected: Set<KbAuthScope>): string {
  return kbAuthScopesFromSelection(selected).join(', ') || 'none';
}

type KbAuthScopeFieldProps = {
  areas?: KbAuthScopeArea[];
  error?: string | null;
  hint?: string;
  idPrefix: string;
  label?: string;
  onChange: (next: Set<KbAuthScope>) => void;
  selected: Set<KbAuthScope>;
};

export function KbAuthScopeField({
  areas,
  error,
  hint,
  idPrefix,
  label = 'Scopes',
  onChange,
  selected,
}: KbAuthScopeFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {hint ? <p className="evukb-form-hint">{hint}</p> : null}
      {error ? <p className="evukb-error">{error}</p> : null}
      <KbAuthScopePicker
        {...(areas ? { areas } : {})}
        idPrefix={idPrefix}
        onChange={onChange}
        selected={selected}
      />
    </div>
  );
}
