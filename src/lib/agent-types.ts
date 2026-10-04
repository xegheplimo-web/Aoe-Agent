export const STATE_FIELDS = ['food', 'wood', 'gold', 'stone', 'pop_used', 'pop_cap'] as const;

export type StateField = (typeof STATE_FIELDS)[number];
export type AgentState = Record<StateField, number | null>;

export type RunEvent = {
  type: string;
  elapsed?: number;
  image?: string;
  state?: AgentState;
  action?: string;
  reason?: string;
  confirmed?: number;
  live?: boolean;
  ui_scores?: Record<string, number>;
};

export type DiagnosticSample = {
  index: number;
  directory: string;
  ocr_seconds: number | null;
  frame_std: number | null;
  state: AgentState;
  ui_scores: Record<string, number>;
  ui_matches_threshold: boolean;
};

export type RunRecord = {
  id: string;
  label: string;
  sourceName: string;
  live: boolean | null;
  eventCount: number;
  observationCount: number;
  commandsIssued: number;
  confirmed: number;
  unknownOcr: number;
  meanInterval: number | null;
  exitReason: string;
  decisions: Record<string, number>;
  commands: Record<string, number>;
  lastState: AgentState | null;
  lastDecision: string | null;
  lastReason: string | null;
  corruptLines: number[];
  createdAt: string;
  events?: RunEvent[];
};

export type DiagnosticRecord = {
  id: string;
  label: string;
  source: string;
  status: string;
  error: string | null;
  sampleCount: number;
  uiFailures: number;
  unknownFields: number;
  meanOcrSeconds: number | null;
  minUiScore: number | null;
  threshold: number;
  clientSize: number[] | null;
  samples: DiagnosticSample[];
  createdAt: string;
};
