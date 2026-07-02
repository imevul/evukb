import { Card } from '@evu/kb-ui';

interface WarningsCardProps {
  warnings: string[];
}

export function WarningsCard({ warnings }: WarningsCardProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold leading-none">Warnings</h2>
      {warnings.length > 0 ? (
        <ul className="evukb-warnings-list">
          {warnings.map((warning) => (
            <li key={warning}>
              {warning}
              {warning.includes('need reindexing') ? (
                <span className="evukb-muted">
                  {' '}
                  Run Reindex needing attention in the Diagnostics section below.
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="evukb-muted">No warnings.</p>
      )}
    </Card>
  );
}
