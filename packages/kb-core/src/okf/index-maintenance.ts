import { buildFilePath } from '../links/resolve.js';
import { parseFrontmatter } from '../markdown/frontmatter.js';
import { classifyOkfFile } from './validate.js';

export const OKF_INDEX_AUTO_BEGIN = '<!-- EVUKB:OKF_INDEX:AUTO:BEGIN -->';
export const OKF_INDEX_AUTO_END = '<!-- EVUKB:OKF_INDEX:AUTO:END -->';

export type OkfIndexConceptEntry = {
  name: string;
  title: string;
  description: string | null;
};

export type OkfIndexSubfolderEntry = {
  name: string;
  title: string;
};

export type OkfIndexNodeRef = {
  path: string;
  name: string;
  content?: string;
  metadata?: Record<string, unknown>;
};

export type OkfSynthesizedIndex = {
  folderPath: string;
  body: string;
};

export type OkfMaintenanceEventKind = 'create' | 'update' | 'delete' | 'move';

export type ParsedIndexSections = {
  prefix: string;
  autoBlock: string;
  suffix: string;
  hadMarkers: boolean;
};

export function parseIndexSections(content: string): ParsedIndexSections {
  const beginIdx = content.indexOf(OKF_INDEX_AUTO_BEGIN);
  const endIdx = content.indexOf(OKF_INDEX_AUTO_END);
  if (beginIdx >= 0 && endIdx > beginIdx) {
    const prefix = content.slice(0, beginIdx).trimEnd();
    const autoStart = beginIdx + OKF_INDEX_AUTO_BEGIN.length;
    const autoBlock = content.slice(autoStart, endIdx).trim();
    const suffix = content.slice(endIdx + OKF_INDEX_AUTO_END.length).trimStart();
    return { prefix, autoBlock, suffix, hadMarkers: true };
  }

  const headingMatch = /^#\s+(.+)$/m.exec(content);
  if (headingMatch) {
    const firstHeadingEnd = content.indexOf('\n', headingMatch.index ?? 0);
    const afterHeading =
      firstHeadingEnd >= 0 ? content.slice(firstHeadingEnd + 1).trim() : content.trim();
    const prefix = content.slice(0, (headingMatch.index ?? 0) + headingMatch[0].length).trim();
    return { prefix, autoBlock: afterHeading, suffix: '', hadMarkers: false };
  }

  return { prefix: '', autoBlock: content.trim(), suffix: '', hadMarkers: false };
}

export function assembleIndexBody(sections: ParsedIndexSections): string {
  const parts: string[] = [];
  if (sections.prefix.length > 0) {
    parts.push(sections.prefix);
    parts.push('');
  } else {
    parts.push('# Index');
    parts.push('');
  }
  parts.push(OKF_INDEX_AUTO_BEGIN);
  if (sections.autoBlock.length > 0) {
    parts.push(sections.autoBlock);
  }
  parts.push(OKF_INDEX_AUTO_END);
  if (sections.suffix.length > 0) {
    parts.push('');
    parts.push(sections.suffix.trim());
  }
  parts.push('');
  return parts.join('\n');
}

function autoBlockLines(autoBlock: string): string[] {
  return autoBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function bulletMatchesFile(line: string, fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\]\\(\\./${escaped}\\)|\\]\\(${escaped}\\)`);
  return pattern.test(line);
}

function bulletMatchesSubfolder(line: string, folderName: string): boolean {
  const escaped = folderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\]\\(${escaped}/\\)`);
  return pattern.test(line);
}

export function mergeIndexIncremental(args: {
  content: string;
  event: {
    kind: OkfMaintenanceEventKind;
    fileName: string;
    title: string;
    description: string | null;
    isSubfolder?: boolean;
  };
}): string {
  const sections = parseIndexSections(args.content);
  let lines = autoBlockLines(sections.autoBlock);
  const { event } = args;
  const newBullet = event.isSubfolder
    ? buildSubfolderBullet({ name: event.fileName, title: event.title })
    : buildConceptBullet({
        name: event.fileName,
        title: event.title,
        description: event.description,
      });

  if (event.kind === 'delete') {
    lines = lines.filter((line) =>
      event.isSubfolder
        ? !bulletMatchesSubfolder(line, event.fileName)
        : !bulletMatchesFile(line, event.fileName),
    );
  } else if (event.kind === 'create' || event.kind === 'move') {
    const exists = lines.some((line) =>
      event.isSubfolder
        ? bulletMatchesSubfolder(line, event.fileName)
        : bulletMatchesFile(line, event.fileName),
    );
    if (!exists) {
      lines.push(newBullet);
    } else if (event.kind === 'move') {
      lines = lines.map((line) =>
        event.isSubfolder
          ? bulletMatchesSubfolder(line, event.fileName)
            ? newBullet
            : line
          : bulletMatchesFile(line, event.fileName)
            ? newBullet
            : line,
      );
    }
  } else if (event.kind === 'update') {
    let found = false;
    lines = lines.map((line) => {
      if (bulletMatchesFile(line, event.fileName)) {
        found = true;
        return newBullet;
      }
      return line;
    });
    if (!found) {
      lines.push(newBullet);
    }
  }

  sections.autoBlock = lines.join('\n');
  if (!sections.hadMarkers && sections.prefix.length === 0) {
    sections.prefix = '# Index';
  }
  return assembleIndexBody(sections);
}

export function regenerateIndexAutoBlock(args: {
  content: string | null;
  concepts: OkfIndexConceptEntry[];
  subfolders: OkfIndexSubfolderEntry[];
}): string {
  if (!args.content || args.content.trim().length === 0) {
    return buildSynthesizedIndexBody(args.concepts, args.subfolders);
  }
  const sections = parseIndexSections(args.content);
  sections.autoBlock = buildAutoSectionLines(args.concepts, args.subfolders).join('\n');
  if (!sections.hadMarkers && sections.prefix.length === 0) {
    sections.prefix = '# Index';
  }
  return assembleIndexBody(sections);
}

export function parentFolderPathFromFilePath(filePath: string): string {
  if (!filePath.includes('/')) {
    return '';
  }
  return filePath.slice(0, filePath.lastIndexOf('/'));
}

export function folderPathsForMaintenanceEvent(args: {
  kind: OkfMaintenanceEventKind;
  filePath: string;
  previousFilePath?: string;
  nodeType?: 'file' | 'folder';
}): string[] {
  const folders = new Set<string>();
  if (args.kind === 'move' && args.previousFilePath) {
    folders.add(parentFolderPathFromFilePath(args.previousFilePath));
    folders.add(parentFolderPathFromFilePath(args.filePath));
  } else if (args.nodeType === 'folder') {
    folders.add(parentFolderPathFromFilePath(args.filePath));
  } else {
    folders.add(parentFolderPathFromFilePath(args.filePath));
  }
  return [...folders];
}

export function titleFromMarkdown(content: string, fileName: string): string {
  const frontmatter = parseFrontmatter(content);
  const title = frontmatter.parsed.title;
  if (typeof title === 'string' && title.trim().length > 0) {
    return title.trim();
  }
  return fileName.replace(/\.md$/i, '');
}

export function descriptionFromMarkdown(content: string): string | null {
  const frontmatter = parseFrontmatter(content);
  const description = frontmatter.parsed.description;
  return typeof description === 'string' && description.trim().length > 0
    ? description.trim()
    : null;
}

export function titleFromNodeRef(node: OkfIndexNodeRef): string {
  if (node.content) {
    return titleFromMarkdown(node.content, node.name);
  }
  const frontmatter = extractTitleFromMetadata(node.metadata);
  return frontmatter ?? node.name.replace(/\.md$/i, '');
}

function extractTitleFromMetadata(metadata?: Record<string, unknown>): string | null {
  const frontmatter = metadata?.frontmatter;
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return null;
  }
  const title = (frontmatter as Record<string, unknown>).title;
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : null;
}

function buildConceptBullet(entry: OkfIndexConceptEntry): string {
  const desc = entry.description ? ` — ${entry.description}` : '';
  return `- [${entry.title}](./${entry.name})${desc}`;
}

function buildSubfolderBullet(entry: OkfIndexSubfolderEntry): string {
  return `- [${entry.title}](${entry.name}/)`;
}

export function buildAutoSectionLines(
  concepts: OkfIndexConceptEntry[],
  subfolders: OkfIndexSubfolderEntry[],
): string[] {
  const lines: string[] = [];
  const sortedConcepts = [...concepts].sort((left, right) => left.title.localeCompare(right.title));
  const sortedSubfolders = [...subfolders].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
  for (const entry of sortedConcepts) {
    lines.push(buildConceptBullet(entry));
  }
  for (const entry of sortedSubfolders) {
    lines.push(buildSubfolderBullet(entry));
  }
  return lines;
}

export function buildSynthesizedIndexBody(
  concepts: OkfIndexConceptEntry[],
  subfolders: OkfIndexSubfolderEntry[],
): string {
  const autoLines = buildAutoSectionLines(concepts, subfolders);
  return ['# Index', '', OKF_INDEX_AUTO_BEGIN, ...autoLines, OKF_INDEX_AUTO_END, ''].join('\n');
}

function childFolderNames(nodes: OkfIndexNodeRef[], folderPath: string): OkfIndexSubfolderEntry[] {
  const prefix = folderPath.length > 0 ? `${folderPath}/` : '';
  const names = new Set<string>();
  for (const node of nodes) {
    if (node.name === 'index.md' || classifyOkfFile(node.name) !== 'concept') {
      continue;
    }
    if (folderPath.length === 0) {
      if (node.path.includes('/')) {
        names.add(node.path.split('/')[0] ?? '');
      }
      continue;
    }
    if (!node.path.startsWith(prefix)) {
      continue;
    }
    const remainder = node.path.slice(prefix.length);
    if (remainder.includes('/')) {
      names.add(remainder.split('/')[0] ?? '');
    }
  }
  return [...names]
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name, title: name }));
}

function conceptsInFolder(nodes: OkfIndexNodeRef[], folderPath: string): OkfIndexConceptEntry[] {
  return nodes
    .filter((node) => {
      if (classifyOkfFile(node.name) !== 'concept') {
        return false;
      }
      return node.path === folderPath;
    })
    .map((node) => ({
      name: node.name,
      title: titleFromNodeRef(node),
      description: node.content ? descriptionFromMarkdown(node.content) : null,
    }));
}

export function foldersNeedingIndex(nodes: OkfIndexNodeRef[]): string[] {
  const folderPaths = new Set<string>();
  const indexPaths = new Set<string>();

  for (const node of nodes) {
    if (classifyOkfFile(node.name) === 'index') {
      indexPaths.add(node.path);
    }
    if (classifyOkfFile(node.name) === 'concept') {
      folderPaths.add(node.path);
      if (node.path.includes('/')) {
        const parts = node.path.split('/');
        for (let index = 0; index < parts.length; index += 1) {
          folderPaths.add(parts.slice(0, index).join('/'));
        }
      }
    }
  }

  return [...folderPaths]
    .filter((folderPath) => conceptsInFolder(nodes, folderPath).length > 0)
    .filter((folderPath) => !indexPaths.has(folderPath))
    .sort((left, right) => left.localeCompare(right));
}

export function synthesizeMissingIndexes(nodes: OkfIndexNodeRef[]): OkfSynthesizedIndex[] {
  return foldersNeedingIndex(nodes).map((folderPath) => ({
    folderPath,
    body: buildSynthesizedIndexBody(
      conceptsInFolder(nodes, folderPath),
      childFolderNames(nodes, folderPath),
    ),
  }));
}

export function conceptFilePath(node: OkfIndexNodeRef): string {
  return buildFilePath(node.path, node.name);
}
