import { buildFilePath, type FailedJobRecord } from '@evu/kb-core';
import type { NodeRepository } from '@evu/kb-db';

function readPayloadFolderPath(payload: Record<string, unknown>): string | null {
  const folderPath = payload.folderPath;
  return typeof folderPath === 'string' && folderPath.length > 0 ? folderPath : null;
}

function resolveFailedJobFilePath(
  job: FailedJobRecord,
  nodesByCorpus: Map<string, Map<string, { path: string; name: string }>>,
): string | null {
  const folderPath = readPayloadFolderPath(job.payload);
  if (folderPath) {
    return folderPath;
  }

  if (!job.corpusId || !job.nodeId) {
    return null;
  }

  const node = nodesByCorpus.get(job.corpusId)?.get(job.nodeId);
  return node ? buildFilePath(node.path, node.name) : null;
}

export async function enrichFailedJobsWithFilePaths(
  nodeRepository: NodeRepository,
  workspaceId: string,
  jobs: FailedJobRecord[],
): Promise<FailedJobRecord[]> {
  const jobsNeedingLookup = jobs.filter(
    (job) => job.corpusId && job.nodeId && !readPayloadFolderPath(job.payload),
  );

  const nodesByCorpus = new Map<string, Map<string, { path: string; name: string }>>();

  for (const corpusId of new Set(jobsNeedingLookup.map((job) => job.corpusId as string))) {
    const nodeIds = [
      ...new Set(
        jobsNeedingLookup
          .filter((job) => job.corpusId === corpusId && job.nodeId)
          .map((job) => job.nodeId as string),
      ),
    ];
    const nodes = await nodeRepository.listByIds(workspaceId, corpusId, nodeIds);
    nodesByCorpus.set(
      corpusId,
      new Map(nodes.map((node) => [node.id, { path: node.path, name: node.name }])),
    );
  }

  return jobs.map((job) => ({
    ...job,
    filePath: resolveFailedJobFilePath(job, nodesByCorpus),
  }));
}
