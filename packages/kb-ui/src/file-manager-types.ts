export type FileTreeNodeType = 'folder' | 'file';

export type FileTreeNode = {
  fullPath: string;
  id: string;
  name: string;
  nodeType: FileTreeNodeType;
  parentId: string | null;
  path: string;
  sizeBytes?: number;
};

export type FileTreeBreadcrumb = {
  id: string | null;
  label: string;
};

export type FileTreeListEntry =
  | { kind: 'parent' }
  | { kind: 'node'; node: FileTreeNode; selectableIndex: number };

export const FILE_TREE_NODE_DRAG_MIME = 'application/x-evukb-file-tree-node-id';
