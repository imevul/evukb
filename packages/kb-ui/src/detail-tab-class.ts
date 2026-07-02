import { cn } from './cn.js';

/** NavLink `className` callback for underline detail-layout tabs (see DESIGN.md). */
export const TAB_CLASS = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'inline-flex items-center border-b-2 -mb-px px-1 pb-2.5 pt-0.5 text-sm font-medium transition-colors',
    isActive
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  );

/** Boolean active flag for non-NavLink tab buttons. */
export function tabClassName(active: boolean): string {
  return TAB_CLASS({ isActive: active });
}
