import { STATE_FIELDS, type AgentState, type RunEvent } from '@/lib/agent-types';

type ObjectMap = Record<string, unknown>;

function isObject(value: unknown): value is ObjectMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, limit = 400): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function count(value: unknown): number {
  const n = number(value);
  return n !== null && n >= 0 ? Math.min(Math.floor(n), 1000000) : 0;
}

function counts(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 30)
      .map(([key, val]) => [key.slice(0, 80), count(val)]),
  );
}

function state(value: unknown): AgentState {
  const input = isObject(value) ? value : {};
  return Object.fromEntries(
    STATE_FIELDS.map((field) => [field, number(input[field])]),
  ) as AgentState;
}

function safeFileName(value: unknown): string {
  return text(value, 255).split(/[\\/]/).pop() || '';
}

function normalizeEvent(value: ObjectMap): RunEvent {
  const event: RunEvent = { type: text(value.type, 60) || 'unknown' };
  const elapsed = number(value.elapsed);
  if (elapsed !== null && elapsed >= 0) event.elapsed = elapsed;
  if (typeof value.action === 'string') event.action = text(value.action, 100);
  if (typeof value.reason === 'string') event.reason = text(value.reason, 600);
  if (typeof value.image === 'string') event.image = safeFileName(value.image);
  if (typeof value.live === 'boolean') event.live = value.live;
  if (value.confirmed !== undefined) event.confirmed = count(value.confirmed);
  if (isObject(value.state)) event.state = state(value.state);
  if (isObject(value.ui_scores)) {
    event.ui_scores = Object.fromEntries(
      Object.entries(value.ui_scores)
        .slice(0, 10)
        .filter((entry): entry is [string, number] => number(entry[1]) !== null)
        .map(([key, val]) => [key.slice(0, 50), val as number]),
    );
  }
  return event;
}

export type RunInput = {
  label?: unknown;
  sourceName?: unknown;
  eventsJsonl?: unknown;
  summary?: unknown;
  exitReason?: unknown;
};

export function summarizeRun(input: RunInput) {
  const jsonl = typeof input.eventsJsonl === 'string' ? input.eventsJsonl : '';
  const summary = isObject(input.summary) ? input.summary : null;
  if (!jsonl.trim() && !summary) {
    throw new Error('Chọn events.jsonl hoặc summary.json để nhập phiên.');
  }
  if (jsonl.length > 2_000_000) {
    throw new Error('events.jsonl vượt giới hạn 2 MB.');
  }

  const events: RunEvent[] = [];
  const corruptLines: number[] = [];
  if (jsonl.trim()) {
    const lines = jsonl.split(/\r?\n/);
    if (lines.length > 10000) throw new Error('Nhật ký có quá 10.000 dòng.');
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!isObject(parsed)) throw new Error('Event không phải object.');
        events.push(normalizeEvent(parsed));
      } catch {
        corruptLines.push(index + 1);
      }
    });
  }

  const observations = events.filter((event) => event.type === 'observation');
  const issued = events.filter((event) => event.type === 'action_issued');
  const last = observations.at(-1);
  const times = observations
    .map((observation) => observation.elapsed)
    .filter((value): value is number => typeof value === 'number');
  const intervals = times
    .slice(1)
    .map((time, index) => time - times[index])
    .filter((n) => n >= 0);
  const decisions = observations.reduce<Record<string, number>>((acc, event) => {
    const name = event.action || 'UNKNOWN';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const commands = issued.reduce<Record<string, number>>((acc, event) => {
    const name = event.action || 'UNKNOWN';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const unknown = observations.reduce(
    (total, event) => total + STATE_FIELDS.filter((field) => event.state?.[field] == null).length,
    0,
  );
  const summaryState = summary?.last_state;
  const summaryUnknown = isObject(summary?.unknown_ocr_counts)
    ? Object.values(summary.unknown_ocr_counts).reduce<number>(
        (total, value) => total + count(value),
        0,
      )
    : 0;
  const useEvents = observations.length > 0 || issued.length > 0;
  const summaryCommands = counts(summary?.commands_issued);

  return {
    label: text(input.label, 180) || 'Phiên chưa đặt tên',
    sourceName: safeFileName(input.sourceName) || 'events.jsonl',
    live: useEvents
      ? (last?.live ?? null)
      : typeof summary?.live === 'boolean'
        ? summary.live
        : null,
    eventCount: events.length || count(summary?.event_count),
    observationCount: useEvents ? observations.length : count(summary?.observation_count),
    commandsIssued: useEvents
      ? issued.length
      : Object.values(summaryCommands).reduce((a, b) => a + b, 0),
    confirmed: useEvents
      ? observations.reduce((max, event) => Math.max(max, event.confirmed || 0), 0)
      : count(summary?.confirmed_by_policy),
    unknownOcr: useEvents ? unknown : summaryUnknown,
    meanInterval: useEvents
      ? intervals.length
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : null
      : number(summary?.mean_observation_interval_seconds),
    exitReason:
      text(input.exitReason, 1000) || text(summary?.exit_reason, 1000) || 'Chưa có exit.txt.',
    decisions: useEvents ? decisions : counts(summary?.decisions),
    commands: useEvents ? commands : summaryCommands,
    lastState: useEvents
      ? (last?.state ?? null)
      : isObject(summaryState)
        ? state(summaryState)
        : null,
    lastDecision: useEvents ? last?.action || null : text(summary?.last_decision, 100) || null,
    lastReason: useEvents ? last?.reason || null : text(summary?.last_decision_reason, 600) || null,
    corruptLines: jsonl.trim()
      ? corruptLines
      : Array.isArray(summary?.corrupt_jsonl_lines)
        ? summary.corrupt_jsonl_lines.map(count).slice(0, 1000)
        : [],
    events,
  };
}
