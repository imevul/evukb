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

/**
 * Sidebar operator shell (Evu `evu-shell--sidebar`). Neutral chrome; signature
 * primary only on the active nav pill.
 */
export function AppShell({
  brand,
  tagline,
  headerMeta,
  navItems,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <aside
        className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
        aria-label="Primary"
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <span
            aria-hidden
            className="h-7 w-7 shrink-0 rounded-[0.4rem] bg-gradient-to-br from-primary to-secondary"
          />
          <div className="min-w-0">
            <p className="truncate text-[1.05rem] font-semibold tracking-tight">{brand}</p>
            {tagline ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{tagline}</p>
            ) : null}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              {...(item.end !== undefined ? { end: item.end } : {})}
              className={({ isActive }) =>
                cn(
                  'block rounded-md px-2.5 py-[0.45rem] text-sm font-medium no-underline transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground hover:bg-primary hover:brightness-105 hover:no-underline'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:no-underline',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {headerMeta ? (
          <div className="space-y-2 border-t border-sidebar-border p-3">{headerMeta}</div>
        ) : null}
        {footer ? (
          <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-5 [scrollbar-gutter:stable]">
        {children}
      </main>
    </div>
  );
}

export type AppContentProps = {
  children: ReactNode;
  wide?: boolean;
};

export function AppContent({ children, wide = true }: AppContentProps) {
  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6', wide ? 'max-w-none' : 'max-w-6xl')}>
      {children}
    </div>
  );
}
