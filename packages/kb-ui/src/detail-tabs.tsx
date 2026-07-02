import { NavLink } from 'react-router-dom';

import { TAB_CLASS } from './detail-tab-class.js';

export type DetailTabItem = {
  end?: boolean;
  label: string;
  to: string;
};

export type DetailTabsProps = {
  'aria-label': string;
  items: DetailTabItem[];
};

export function DetailTabs({ items, 'aria-label': ariaLabel }: DetailTabsProps) {
  return (
    <nav className="flex flex-wrap gap-6 border-b border-border" aria-label={ariaLabel}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          className={TAB_CLASS}
          {...(item.end !== undefined ? { end: item.end } : {})}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
