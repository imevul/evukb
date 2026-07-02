import { lookup } from 'node:dns/promises';
import type { BlobStore } from '@evu/kb-core';
import {
  asCorpusId,
  asWorkspaceId,
  type CitationValidationEntry,
  type CitationValidationMetadata,
  createBlobRef,
  evaluateCitationUrlPolicy,
  extractOkfCitationUrlsFromBody,
  isCitationValidationEnabled,
  isOkfCorpus,
  mergeCitationValidationMetadata,
} from '@evu/kb-core';
import type { CorpusRepository, NodeRepository } from '@evu/kb-db';

import { ApiError } from '../errors.js';
import type { JobQueueService } from '../jobs/job-queue-service.js';
import type { CitationValidateJob } from '../jobs/types.js';

export type CitationValidateServiceDeps = {
  blobStore: BlobStore;
  corpora: CorpusRepository;
  jobQueue?: JobQueueService;
  nodes: NodeRepository;
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;

function isPrivateIpv4(part: number[]): boolean {
  if (part.length !== 4) {
    return false;
  }
  const [a = -1, b = -1] = part;
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const parsed = Number.parseInt(part, 10);
    if (parsed < 0 || parsed > 255) {
      return null;
    }
    numbers.push(parsed);
  }
  return numbers;
}

function isBlockedResolvedAddress(address: string): boolean {
  if (address.includes(':')) {
    const lower = address.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:')
    );
  }
  const ipv4 = parseIpv4(address);
  return ipv4 ? isPrivateIpv4(ipv4) : false;
}

async function assertResolvableHostAllowed(
  url: URL,
): Promise<{ allowed: boolean; reason?: string }> {
  const policy = evaluateCitationUrlPolicy(url.toString());
  if (!policy.allowed) {
    return policy;
  }

  try {
    const records = await lookup(url.hostname, { all: true });
    for (const record of records) {
      if (isBlockedResolvedAddress(record.address)) {
        return { allowed: false, reason: 'resolved address is blocked' };
      }
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'hostname could not be resolved' };
  }
}

async function readResponseSnippet(response: Response): Promise<void> {
  if (!response.body) {
    return;
  }
  const reader = response.body.getReader();
  let total = 0;
  while (total < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
  }
  await reader.cancel();
}

async function probeCitationUrl(rawUrl: string): Promise<CitationValidationEntry> {
  const policy = evaluateCitationUrlPolicy(rawUrl);
  if (!policy.allowed) {
    return {
      url: rawUrl,
      status: policy.reason === 'invalid URL' ? 'invalid' : 'blocked',
      ...(policy.reason ? { message: policy.reason } : {}),
    };
  }

  let currentUrl = new URL(rawUrl);
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const hostPolicy = await assertResolvableHostAllowed(currentUrl);
    if (!hostPolicy.allowed) {
      return {
        url: rawUrl,
        status: 'blocked',
        ...(hostPolicy.reason ? { message: hostPolicy.reason } : {}),
      };
    }

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'user-agent': 'EvuKB-CitationValidator/1.0',
        },
      });
      await readResponseSnippet(response);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            url: rawUrl,
            status: 'unreachable',
            httpStatus: response.status,
            message: 'redirect response missing location header',
          };
        }
        currentUrl = new URL(location, currentUrl);
        continue;
      }

      if (response.status >= 200 && response.status < 400) {
        return {
          url: rawUrl,
          status: 'valid',
          httpStatus: response.status,
        };
      }

      return {
        url: rawUrl,
        status: 'unreachable',
        httpStatus: response.status,
        message: `HTTP ${response.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed';
      return {
        url: rawUrl,
        status: 'unreachable',
        message,
      };
    }
  }

  return {
    url: rawUrl,
    status: 'unreachable',
    message: 'too many redirects',
  };
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export class CitationValidateService {
  readonly #blobStore: BlobStore;
  readonly #corpora: CorpusRepository;
  readonly #jobQueue: JobQueueService | undefined;
  readonly #nodes: NodeRepository;

  constructor(deps: CitationValidateServiceDeps) {
    this.#blobStore = deps.blobStore;
    this.#corpora = deps.corpora;
    this.#jobQueue = deps.jobQueue;
    this.#nodes = deps.nodes;
  }

  async scheduleValidationIfNeeded(
    workspaceId: string,
    corpusId: string,
    nodeId: string,
  ): Promise<void> {
    if (!this.#jobQueue) {
      return;
    }

    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus || !isOkfCorpus(corpus.settings) || !isCitationValidationEnabled(corpus.settings)) {
      return;
    }

    const node = await this.#nodes.getById(workspaceId, corpusId, nodeId);
    if (!node?.storageRelPath || node.nodeType !== 'file') {
      return;
    }

    const blobRef = createBlobRef(
      asWorkspaceId(workspaceId),
      asCorpusId(corpusId),
      node.storageRelPath,
    );
    const stream = await this.#blobStore.get(blobRef);
    const content = (await streamToBuffer(stream)).toString('utf8');
    const urls = extractOkfCitationUrlsFromBody(content);
    if (urls.length === 0) {
      return;
    }

    await this.#jobQueue.enqueueCitationValidate({ workspaceId, corpusId, nodeId });
  }

  async validateNode(job: CitationValidateJob): Promise<CitationValidationMetadata> {
    const corpus = await this.#corpora.getById(job.workspaceId, job.corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(job.corpusId);
    }
    if (!isOkfCorpus(corpus.settings) || !isCitationValidationEnabled(corpus.settings)) {
      return { validatedAt: new Date().toISOString(), entries: [] };
    }

    const node = await this.#nodes.getById(job.workspaceId, job.corpusId, job.nodeId);
    if (!node?.storageRelPath) {
      throw ApiError.nodeNotFound(job.nodeId);
    }

    const blobRef = createBlobRef(
      asWorkspaceId(job.workspaceId),
      asCorpusId(job.corpusId),
      node.storageRelPath,
    );
    const stream = await this.#blobStore.get(blobRef);
    const content = (await streamToBuffer(stream)).toString('utf8');
    const urls = extractOkfCitationUrlsFromBody(content);

    const entries: CitationValidationEntry[] = [];
    for (const url of urls) {
      entries.push(await probeCitationUrl(url));
    }

    const citationValidation: CitationValidationMetadata = {
      validatedAt: new Date().toISOString(),
      entries,
    };

    await this.#nodes.updateIndexStatus(job.workspaceId, job.corpusId, job.nodeId, {
      indexStatus: node.indexStatus,
      metadata: mergeCitationValidationMetadata(node.metadata, citationValidation),
    });

    return citationValidation;
  }

  async enqueueCorpusValidation(workspaceId: string, corpusId: string): Promise<number> {
    if (!this.#jobQueue) {
      return 0;
    }

    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus || !isOkfCorpus(corpus.settings) || !isCitationValidationEnabled(corpus.settings)) {
      return 0;
    }

    const nodes = await this.#nodes.listByCorpus(workspaceId, corpusId);
    let enqueued = 0;
    for (const node of nodes) {
      if (node.nodeType !== 'file' || !node.name.toLowerCase().endsWith('.md')) {
        continue;
      }
      const id = await this.#jobQueue.enqueueCitationValidate({
        workspaceId,
        corpusId,
        nodeId: node.id,
      });
      if (id) {
        enqueued += 1;
      }
    }
    return enqueued;
  }

  async validateCorpusCitations(
    workspaceId: string,
    corpusId: string,
  ): Promise<{ enqueued: number }> {
    const corpus = await this.#corpora.getById(workspaceId, corpusId);
    if (!corpus) {
      throw ApiError.corpusNotFound(corpusId);
    }
    const enqueued = await this.enqueueCorpusValidation(workspaceId, corpusId);
    return { enqueued };
  }
}
