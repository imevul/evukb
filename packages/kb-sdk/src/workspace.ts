export type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: string;
};

export type CreateWorkspaceRequest = {
  slug: string;
  name: string;
};

export type DeleteWorkspaceResult = {
  deleted: true;
  id: string;
  slug: string;
};
