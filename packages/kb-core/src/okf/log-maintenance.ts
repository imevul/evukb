export const OKF_LOG_HEADING = '# Directory Update Log';

export type OkfLogMaintenanceActor =
  | { kind: 'agent'; agentId: string; runId: string; agentName?: string }
  | { kind: 'admin'; userId?: string };

export function buildInitialLogBody(): string {
  return `${OKF_LOG_HEADING}\n\n`;
}

export function formatLogEntry(args: {
  kind: 'create' | 'update' | 'delete';
  filePath: string;
  title?: string;
  actor: OkfLogMaintenanceActor;
}): string {
  const displayTitle =
    args.title ?? args.filePath.split('/').pop()?.replace(/\.md$/i, '') ?? args.filePath;
  const relLink = args.filePath.includes('/')
    ? `./${args.filePath.slice(args.filePath.lastIndexOf('/') + 1)}`
    : `./${args.filePath}`;

  let actionLabel: string;
  let body: string;
  if (args.kind === 'create') {
    actionLabel = 'Creation';
    body = `Added [${displayTitle}](${relLink})`;
  } else if (args.kind === 'update') {
    actionLabel = 'Update';
    body = `Revised [${displayTitle}](${relLink})`;
  } else {
    actionLabel = 'Deletion';
    body = `Removed \`${args.filePath}\``;
  }

  const attribution =
    args.actor.kind === 'agent'
      ? `(agent \`${args.actor.agentName ?? args.actor.agentId}\`, run \`${args.actor.runId}\`)`
      : '(admin UI)';

  return `* **${actionLabel}**: ${body} ${attribution}.`;
}

export function appendLogEntryToContent(args: {
  content: string;
  entryLine: string;
  dateUtc: string;
}): string {
  const dateHeading = `## ${args.dateUtc}`;
  const trimmed = args.content.trimEnd();

  if (trimmed.length === 0) {
    return `${OKF_LOG_HEADING}\n\n${dateHeading}\n${args.entryLine}\n`;
  }

  if (!trimmed.startsWith(OKF_LOG_HEADING)) {
    const withHeading = `${OKF_LOG_HEADING}\n\n${trimmed}`;
    return appendLogEntryToContent({ ...args, content: withHeading });
  }

  const dateIdx = trimmed.indexOf(dateHeading);
  if (dateIdx >= 0) {
    const afterDate = dateIdx + dateHeading.length;
    const rest = trimmed.slice(afterDate);
    const nextDateMatch = /\n## \d{4}-\d{2}-\d{2}/.exec(rest);
    const sectionEnd = nextDateMatch ? afterDate + (nextDateMatch.index ?? 0) : trimmed.length;
    const before = trimmed.slice(0, sectionEnd).trimEnd();
    const after = trimmed.slice(sectionEnd);
    return `${before}\n${args.entryLine}${after.length > 0 ? `\n${after.trimStart()}` : '\n'}`;
  }

  const afterHeading = trimmed.slice(OKF_LOG_HEADING.length).trimStart();
  return `${OKF_LOG_HEADING}\n\n${dateHeading}\n${args.entryLine}\n${afterHeading.length > 0 ? `\n${afterHeading}` : ''}`;
}

export function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
