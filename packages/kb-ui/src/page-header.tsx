import type { ReactNode } from 'react';

import { cn } from './cn.js';

export type PageTab = {
  label: string;
  to: string;
  active?: boolean;
};

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: PageTab[];
  children?: ReactNode;
};

/**
 * Unified route header: exactly one `<h1>` per route, with optional
 * description text and an action-buttons slot aligned to the right.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  tabs,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="m-0 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs && tabs.length > 0 ? (
        <nav className="flex flex-wrap gap-6 border-b border-border" aria-label="Sections">
          {tabs.map((tab) => (
            <a
              key={tab.to}
              className={cn(
                'inline-flex items-center border-b-2 -mb-px px-1 pb-2.5 pt-0.5 text-sm font-medium transition-colors',
                tab.active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              href={tab.to}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      ) : null}
      {children}
    </header>
  );
}
