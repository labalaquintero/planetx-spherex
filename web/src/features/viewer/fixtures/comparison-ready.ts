import type { ComparisonResponse } from '../types.ts';
import { TEST_FRAME_A, TEST_FRAME_B } from './test-images.ts';

/** Fixture ready: dos épocas comparables (datos sintéticos). */
export const readyFixture: ComparisonResponse = {
  schema_version: '1',
  status: 'ready',
  reason: null,
  mode: 'fixture',
  query: { ra_deg: 10.25, dec_deg: -12.5, frame: 'ICRS', fov_deg: 0.1 },
  band: { center_um: 1.25, tolerance_um: 0.02 },
  checked_at: '2026-11-14T12:00:00Z',
  science_version: 'v1',
  warnings: [],
  frames: [
    {
      id: 'fixture-a',
      observed_at: '2026-01-05T00:00:00Z',
      release: 'fixture',
      observation_id: 'fixture-obs-a',
      source_url: 'https://irsa.ipac.caltech.edu/data/SPHEREx/overview_dr1.html',
      image_url: !import.meta.env.PROD ? TEST_FRAME_A : '/api/v1/images/fixture-a',
      quality_flags: [],
    },
    {
      id: 'fixture-b',
      observed_at: '2026-07-05T00:00:00Z',
      release: 'fixture',
      observation_id: 'fixture-obs-b',
      source_url: 'https://irsa.ipac.caltech.edu/data/SPHEREx/overview_dr1.html',
      image_url: !import.meta.env.PROD ? TEST_FRAME_B : '/api/v1/images/fixture-b',
      quality_flags: [],
    },
  ],
};
