import type { OkfConvertResult } from '@evu/kb-sdk';
import { Button, Card } from '@evu/kb-ui';

interface DiagnosticsCardProps {
  isOkfCorpus: boolean;
  okfBusy: boolean;
  reindexing: boolean;
  validatingCitations: boolean;
  needingAttentionCount: number;
  actionError: string | null;
  actionMessage: string | null;
  convertResult: OkfConvertResult | null;
  runConvertToOkf: () => void;
  runExportOkf: () => Promise<void>;
  runValidateCitations: () => Promise<void>;
  runReindexAll: () => Promise<void>;
  runReindexNeedingAttention: () => Promise<void>;
}

export function DiagnosticsCard({
  isOkfCorpus,
  okfBusy,
  reindexing,
  validatingCitations,
  needingAttentionCount,
  actionError,
  actionMessage,
  convertResult,
  runConvertToOkf,
  runExportOkf,
  runValidateCitations,
  runReindexAll,
  runReindexNeedingAttention,
}: DiagnosticsCardProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold leading-none">Diagnostics</h2>
      <div className="evukb-diagnostics-actions">
        {!isOkfCorpus ? (
          <Button disabled={okfBusy || reindexing} variant="primary" onClick={runConvertToOkf}>
            {okfBusy ? 'Converting…' : 'Convert to OKF'}
          </Button>
        ) : (
          <>
            <Button disabled={okfBusy || reindexing} variant="primary" onClick={runConvertToOkf}>
              {okfBusy ? 'Converting…' : 'Re-run OKF convert'}
            </Button>
            <Button
              disabled={okfBusy || reindexing || validatingCitations}
              variant="quiet"
              onClick={() => void runExportOkf()}
            >
              {okfBusy ? 'Exporting…' : 'Export OKF zip'}
            </Button>
            <Button
              disabled={okfBusy || reindexing || validatingCitations}
              variant="quiet"
              onClick={() => void runValidateCitations()}
            >
              {validatingCitations ? 'Validating…' : 'Validate citations'}
            </Button>
          </>
        )}
        <Button disabled={reindexing} variant="primary" onClick={() => void runReindexAll()}>
          {reindexing ? 'Reindexing…' : 'Reindex all'}
        </Button>
        {needingAttentionCount > 0 ? (
          <Button
            disabled={reindexing}
            variant="quiet"
            onClick={() => void runReindexNeedingAttention()}
          >
            Reindex needing attention ({needingAttentionCount})
          </Button>
        ) : null}
      </div>
      {actionError ? <p className="evukb-error">{actionError}</p> : null}
      {actionMessage ? <p className="evukb-success">{actionMessage}</p> : null}
      {convertResult && convertResult.warnings.length > 0 ? (
        <ul className="evukb-warnings-list">
          {convertResult.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
