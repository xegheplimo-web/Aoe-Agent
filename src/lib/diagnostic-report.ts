import { STATE_FIELDS, type AgentState, type DiagnosticSample } from '@/lib/agent-types';

type ObjectMap = Record<string, unknown>;

function isObject(value: unknown): value is ObjectMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeText(value: unknown, length: number): string {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

function safeState(value: unknown): AgentState {
  const input = isObject(value) ? value : {};
  return Object.fromEntries(
    STATE_FIELDS.map((field) => [field, finite(input[field])]),
  ) as AgentState;
}

export function normalizeDiagnostic(input: unknown) {
  if (!isObject(input) || !isObject(input.report)) {
    throw new Error('Chọn report.json hợp lệ từ diagnose.py.');
  }
  const report = input.report;
  if (!Array.isArray(report.samples) || report.samples.length > 100) {
    throw new Error('Báo cáo phải có samples (tối đa 100 mẫu).');
  }
  const config = isObject(report.config) ? report.config : {};
  const threshold = finite(config.template_threshold) ?? 0.97;
  const clientSize =
    Array.isArray(config.client_size) &&
    config.client_size.length === 2 &&
    config.client_size.every((part) => finite(part) !== null)
      ? (config.client_size as number[])
      : null;
  const samples: DiagnosticSample[] = report.samples.map((raw, index) => {
    const sample = isObject(raw) ? raw : {};
    const rawScores = isObject(sample.ui_scores) ? sample.ui_scores : {};
    const uiScores = Object.fromEntries(
      Object.entries(rawScores)
        .slice(0, 10)
        .filter((entry): entry is [string, number] => finite(entry[1]) !== null)
        .map(([key, value]) => [key.slice(0, 50), value as number]),
    );
    return {
      index: finite(sample.index) ?? index,
      directory: safeText(sample.directory, 100) || `sample_${String(index).padStart(3, '0')}`,
      ocr_seconds: finite(sample.ocr_seconds),
      frame_std: finite(sample.frame_std),
      state: safeState(sample.state),
      ui_scores: uiScores,
      ui_matches_threshold: sample.ui_matches_threshold === true,
    };
  });
  const scores = samples.flatMap((sample) => Object.values(sample.ui_scores));
  const ocrTimes = samples
    .map((sample) => sample.ocr_seconds)
    .filter((value): value is number => value !== null);
  const source = safeText(report.source, 255);

  return {
    label: safeText(input.label, 180) || 'Chẩn đoán chưa đặt tên',
    // Do not persist full local paths from the original report.
    source: source === 'live' ? 'live' : source.split(/[\\/]/).pop() || 'offline',
    status: safeText(report.status, 40) || 'unknown',
    error: safeText(report.error, 1000) || null,
    sampleCount: samples.length,
    uiFailures: samples.filter((sample) => !sample.ui_matches_threshold).length,
    unknownFields: samples.reduce(
      (sum, sample) => sum + STATE_FIELDS.filter((field) => sample.state[field] === null).length,
      0,
    ),
    meanOcrSeconds: ocrTimes.length ? ocrTimes.reduce((a, b) => a + b, 0) / ocrTimes.length : null,
    minUiScore: scores.length ? Math.min(...scores) : null,
    threshold,
    clientSize,
    samples,
  };
}
