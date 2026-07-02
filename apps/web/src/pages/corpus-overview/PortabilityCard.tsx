import { Button, Card } from '@evu/kb-ui';
import { ARCHIVE_IMPORT_ACCEPT } from '../../lib/archive-import-normalize.js';

interface PortabilityCardProps {
  portableBusy: boolean;
  reindexing: boolean;
  runExportPortable: () => Promise<void>;
  runImportPortable: (file: File) => Promise<void>;
}

export function PortabilityCard({
  portableBusy,
  reindexing,
  runExportPortable,
  runImportPortable,
}: PortabilityCardProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold leading-none">Portability</h2>
      <div className="evukb-diagnostics-actions">
        <Button
          disabled={portableBusy || reindexing}
          onClick={() => void runExportPortable()}
          type="button"
          variant="quiet"
        >
          {portableBusy ? 'Working…' : 'Export portable (.evukb)'}
        </Button>
        <label className="evukb-file-input-label">
          <input
            accept={ARCHIVE_IMPORT_ACCEPT}
            disabled={portableBusy || reindexing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                void runImportPortable(file);
              }
            }}
            type="file"
          />
          Import archive
        </label>
      </div>
    </Card>
  );
}
