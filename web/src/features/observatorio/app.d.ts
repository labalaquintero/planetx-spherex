import type { ComparisonResponse } from '../viewer/types.ts';

export function startObservatory(services: {
  compare: (raDeg: number, decDeg: number, signal: AbortSignal) => Promise<ComparisonResponse>;
  mountExplorer: (host: HTMLElement) => () => void;
}): void;
