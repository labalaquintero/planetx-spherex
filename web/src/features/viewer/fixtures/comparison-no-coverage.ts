import type { ComparisonResponse } from '../types.ts';

/** Fixture no_coverage: sin observaciones en la región consultada. */
export const noCoverageFixture: ComparisonResponse = {
  schema_version: '1',
  status: 'no_coverage',
  reason: 'no_observations',
  mode: 'fixture',
  query: { ra_deg: 200.0, dec_deg: 89.0, frame: 'ICRS', fov_deg: 0.1 },
  band: null,
  checked_at: '2026-11-14T12:00:00Z',
  science_version: 'v1',
  warnings: [],
  frames: [],
};
