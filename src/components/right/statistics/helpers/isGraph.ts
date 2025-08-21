import type { TypeStatisticsGraph } from '../../../../api/types';

export function isGraph(obj: unknown): obj is TypeStatisticsGraph {
  // eslint-disable-next-line no-null/no-null
  return typeof obj === 'object' && obj !== null && 'graphType' in obj;
}
