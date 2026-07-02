import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from './cn.js';

export type AppNavItem = {
  end?: boolean;
  label: string;
  to: string;
};

export type AppShellProps = {
  brand: string;
  children: ReactNode;
  footer?: ReactNode;
  headerMeta?: ReactNode;
  navItems: AppNavItem[];
  tagline?: string;
};

export function AppShell({
  brand,
  tagline,
  headerMeta,
  navItems,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <aside
        className="flex w-56 shrink-0 flex-col border-r border-border bg-card"
        aria-label="Primary"
      >
        <div className="border-b border-border px-4 py-4">
          <p className="text-base font-semibold tracking-tight">{brand}</p>
          {tagline ? <p className="mt-0.5 text-xs text-muted-foreground">{tagline}</p> : null}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              {...(item.end !== undefined ? { end: item.end } : {})}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {headerMeta ? (
          <div className="space-y-2 border-t border-border p-3">{headerMeta}</div>
        ) : null}
        {footer ? (
          <div className="border-t border-border p-3 text-xs text-muted-foreground">{footer}</div>
        ) : null}
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6 [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  );
}

export type AppContentProps = {
  children: ReactNode;
  wide?: boolean;
};

export function AppContent({ children, wide = false }: AppContentProps) {
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6', wide ? 'max-w-none' : 'max-w-6xl')}>
      {children}
    </div>
  );
}
