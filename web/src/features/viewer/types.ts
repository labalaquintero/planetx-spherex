/** Contrato v0.1 — tipos del JSON de /api/v1/comparisons */

export interface ComparisonQuery {
  ra_deg: number;
  dec_deg: number;
  frame: string;
  fov_deg: number;
}

export interface Band {
  center_um: number;
  tolerance_um: number;
}

export interface Frame {
  id: string;
  observed_at: string;
  release: string;
  observation_id: string;
  source_url: string | null;
  image_url: string;
  quality_flags: string[];
}

export type ComparisonStatus = 'ready' | 'insufficient' | 'no_coverage';

export type InsufficientReason =
  | 'single_epoch'
  | 'no_common_band'
  | 'no_usable_frames'
  | 'search_limit_reached';

export type Reason = InsufficientReason | 'no_observations' | null;

export type ComparisonMode = 'live' | 'prepared' | 'fixture';

export interface ComparisonResponse {
  schema_version: string;
  status: ComparisonStatus;
  reason: Reason;
  mode: ComparisonMode;
  query: ComparisonQuery;
  band: Band | null;
  checked_at: string;
  science_version: string;
  warnings: string[];
  frames: Frame[];
}

export interface ComparisonApiError {
  error: {
    code: string;
    message: string;
  };
}

/** Estados del hook useComparison */
export type ViewerState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: ComparisonResponse }
  | {
      kind: 'error';
      message: string;
      retryable: boolean;
      statusCode?: number;
      code?: string;
    };
