export type SecretRecord = {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: string;
};

export type CreatedSecret = SecretRecord & {
  value: string;
};

export type CreateSecretRequest = {
  name: string;
  value: string;
};

export type RotateSecretRequest = {
  value: string;
};
