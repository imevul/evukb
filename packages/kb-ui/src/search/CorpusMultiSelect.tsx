import { useFormatDateTime } from '../display/DisplayPreferencesProvider.js';
import { formatFileTreeBytes } from '../file-manager-utils.js';
import type { WorkspaceCorpusOption } from '../hooks/useWorkspaceCorpora.js';
import { Switch } from '../switch.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table.js';

export type CorpusMultiSelectProps = {
  availableCorpora: WorkspaceCorpusOption[];
  corpusIds: string[];
  onToggle: (corpusId: string) => void;
  setCorpusIds: (ids: string[]) => void;
};

export function CorpusMultiSelect({
  availableCorpora,
  corpusIds,
  onToggle,
  setCorpusIds,
}: CorpusMultiSelectProps) {
  const formatDateTime = useFormatDateTime();
  const selectedCount = availableCorpora.filter((corpus) => corpusIds.includes(corpus.id)).length;
  const allSelected = availableCorpora.length > 0 && selectedCount === availableCorpora.length;

  function handleSelectAllToggle(checked: boolean): void {
    setCorpusIds(checked ? availableCorpora.map((corpus) => corpus.id) : []);
  }

  return (
    <fieldset>
      <legend>
        Corpora
        {availableCorpora.length > 0 ? (
          <span className="ml-2 font-normal text-muted-foreground">
            ({selectedCount} of {availableCorpora.length} selected)
          </span>
        ) : null}
      </legend>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">
              <Switch
                aria-label={allSelected ? 'Deselect all corpora' : 'Select all corpora'}
                checked={allSelected}
                onCheckedChange={handleSelectAllToggle}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Notes</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {availableCorpora.map((corpus) => (
            <TableRow key={corpus.id}>
              <TableCell>
                <Switch
                  aria-label={corpus.name}
                  checked={corpusIds.includes(corpus.id)}
                  onCheckedChange={() => onToggle(corpus.id)}
                />
              </TableCell>
              <TableCell className="font-medium">{corpus.name}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {corpus.fileCount.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatFileTreeBytes(corpus.totalBytes)}
              </TableCell>
              <TableCell
                className="text-right text-muted-foreground"
                title={new Date(corpus.updatedAt).toISOString()}
              >
                {formatDateTime(corpus.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </fieldset>
  );
}
