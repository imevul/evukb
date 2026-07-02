import { describe, expect, it } from 'vitest';

import { layoutNeighborhood } from '../src/graph/GraphNeighborhoodView.js';

describe('layoutNeighborhood', () => {
  it('places the center node at the canvas midpoint', () => {
    const layouts = layoutNeighborhood(
      {
        centerNodeId: 'center',
        truncated: false,
        nodes: [
          { nodeId: 'center', filePath: 'a.md', label: 'A', hasValidationIssues: false },
          { nodeId: 'neighbor', filePath: 'b.md', label: 'B', hasValidationIssues: false },
        ],
        edges: [],
      },
      400,
      400,
    );

    const center = layouts.find((node) => node.nodeId === 'center');
    expect(center?.x).toBe(200);
    expect(center?.y).toBe(200);
    expect(center?.isCenter).toBe(true);
  });
});
