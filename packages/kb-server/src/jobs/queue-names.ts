export const JOB_QUEUE_INDEX = 'evu-kb-index';
export const JOB_QUEUE_OKF_MAINTAIN = 'evu-kb-okf-maintain';
export const JOB_QUEUE_CITATION_VALIDATE = 'evu-kb-citation-validate';

/** Registered for future mount/git sync sprints; no handlers in v1. */
export const JOB_QUEUE_MOUNT_SYNC = 'evu-kb-mount-sync';
export const JOB_QUEUE_MOUNT_SYNC_SCHEDULE = 'evu-kb-mount-sync-schedule';
export const JOB_QUEUE_GIT_SYNC = 'evu-kb-git-sync';
export const JOB_QUEUE_CORPUS_REINDEX = 'evu-kb-corpus-reindex';

export const ACTIVE_JOB_QUEUES = [
  JOB_QUEUE_INDEX,
  JOB_QUEUE_OKF_MAINTAIN,
  JOB_QUEUE_CITATION_VALIDATE,
  JOB_QUEUE_MOUNT_SYNC,
  JOB_QUEUE_GIT_SYNC,
  JOB_QUEUE_CORPUS_REINDEX,
] as const;

export const REGISTERED_JOB_QUEUES = [
  ...ACTIVE_JOB_QUEUES,
  JOB_QUEUE_MOUNT_SYNC,
  JOB_QUEUE_MOUNT_SYNC_SCHEDULE,
  JOB_QUEUE_GIT_SYNC,
  JOB_QUEUE_CORPUS_REINDEX,
] as const;
