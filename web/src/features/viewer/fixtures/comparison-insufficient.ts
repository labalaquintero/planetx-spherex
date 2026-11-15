import type { ComparisonResponse } from '../types.ts';
import { TEST_FRAME_SINGLE } from './test-images.ts';

/** Fixture insufficient: solo una época válida. */
export const insufficientFixture: ComparisonResponse = {
  schema_version: '1',
  status: 'insufficient',
  reason: 'single_epoch',
  mode: 'fixture',
  query: { ra_deg: 50.0, dec_deg: 70.0, frame: 'ICRS', fov_deg: 0.1 },
  band: { center_um: 1.25, tolerance_um: 0.02 },
  checked_at: '2026-11-14T12:00:00Z',
  science_version: 'v1',
  warnings: [],
  frames: [
    {
      id: 'fixture-single',
      observed_at: '2026-03-15T08:30:00Z',
      release: 'fixture',
      observation_id: 'fixture-obs-single',
      source_url: 'https://irsa.ipac.caltech.edu/data/SPHEREx/overview_dr1.html',
      image_url: !import.meta.env.PROD ? TEST_FRAME_SINGLE : '/api/v1/images/fixture-single',
      quality_flags: [],
    },
  ],
};
