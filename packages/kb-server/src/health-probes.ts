import { mkdirSync } from 'node:fs';

import {
  type BlobStore,
  type ChatProvider,
  type EmbeddingProvider,
  LocalFilesystemBlobStore,
} from '@evu/kb-core';
import { checkMigrationStatus, createDb, type DbHandle } from '@evu/kb-db';

import { resolveChatProvider } from './adapters/openai-chat.js';
import { resolveEmbeddingProvider } from './adapters/openai-embedding.js';

export type DatabaseHealth = {
  status: 'ok' | 'error' | 'not-configured';
  migrationsApplied?: number;
};

export type BlobStoreHealth = {
  status: 'ok' | 'error' | 'not-configured';
  root?: string;
};

export type ProviderHealthSummary = {
  embedding: {
    status: 'ok' | 'not-configured' | 'error';
    model?: string;
    message?: string;
  };
  chat: {
    status: 'ok' | 'not-configured' | 'error';
    model?: string;
    message?: string;
  };
};

export async function probeDatabase(connectionString?: string): Promise<DatabaseHealth> {
  if (!connectionString) {
    return { status: 'not-configured' };
  }

  let handle: DbHandle | undefined;
  try {
    handle = createDb({ connectionString });
    await handle.pool.query('SELECT 1');
    const migrationStatus = await checkMigrationStatus(handle);
    return {
      status: migrationStatus.ready ? 'ok' : 'error',
      migrationsApplied: migrationStatus.appliedCount,
    };
  } catch {
    return { status: 'error' };
  } finally {
    await handle?.close();
  }
}

export function probeBlobStore(blobRoot?: string): {
  store: BlobStore | null;
  health: BlobStoreHealth;
} {
  if (!blobRoot) {
    return {
      store: null,
      health: { status: 'not-configured' },
    };
  }

  try {
    mkdirSync(blobRoot, { recursive: true });
    return {
      store: new LocalFilesystemBlobStore({ rootDir: blobRoot }),
      health: {
        status: 'ok',
        root: blobRoot,
      },
    };
  } catch {
    return {
      store: null,
      health: { status: 'error', root: blobRoot },
    };
  }
}

export async function probeProviders(input?: {
  embeddingProvider?: EmbeddingProvider | null;
  chatProvider?: ChatProvider | null;
}): Promise<ProviderHealthSummary> {
  const embedding = input?.embeddingProvider ?? resolveEmbeddingProvider();
  const chat = input?.chatProvider ?? resolveChatProvider();

  const embeddingHealth = embedding
    ? await embedding.health()
    : {
        status: 'not-configured' as const,
        model: 'none',
        message: 'Embedding provider is not configured.',
      };
  const chatHealth = chat
    ? await chat.health()
    : {
        status: 'not-configured' as const,
        model: 'none',
        message: 'Chat provider is not configured.',
      };

  return {
    embedding: {
      status: embeddingHealth.status,
      ...(embeddingHealth.model ? { model: embeddingHealth.model } : {}),
      ...(embeddingHealth.message ? { message: embeddingHealth.message } : {}),
    },
    chat: {
      status: chatHealth.status,
      ...(chatHealth.model ? { model: chatHealth.model } : {}),
      ...(chatHealth.message ? { message: chatHealth.message } : {}),
    },
  };
}
