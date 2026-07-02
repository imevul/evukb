import type { ReactNode } from 'react';

export type EmptyStateProps = {
  title: string;
  hint?: ReactNode;
};

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 px-5 py-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint ? <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
