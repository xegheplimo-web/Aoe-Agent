import { agentRuns, diagnosticReports } from '@/db/schema';
import type { DiagnosticRecord, RunRecord } from '@/lib/agent-types';

type RunRow = typeof agentRuns.$inferSelect;
type DiagnosticRow = typeof diagnosticReports.$inferSelect;

export function serializeRun(row: RunRow, includeEvents = false): RunRecord {
  return {
    id: row.id,
    label: row.label,
    sourceName: row.sourceName,
    live: row.live,
    eventCount: row.eventCount,
    observationCount: row.observationCount,
    commandsIssued: row.commandsIssued,
    confirmed: row.confirmed,
    unknownOcr: row.unknownOcr,
    meanInterval: row.meanInterval,
    exitReason: row.exitReason,
    decisions: row.decisions,
    commands: row.commands,
    lastState: row.lastState,
    lastDecision: row.lastDecision,
    lastReason: row.lastReason,
    corruptLines: row.corruptLines,
    createdAt: row.createdAt.toISOString(),
    ...(includeEvents ? { events: row.events } : {}),
  };
}

export function serializeDiagnostic(row: DiagnosticRow): DiagnosticRecord {
  return {
    id: row.id,
    label: row.label,
    source: row.source,
    status: row.status,
    error: row.error,
    sampleCount: row.sampleCount,
    uiFailures: row.uiFailures,
    unknownFields: row.unknownFields,
    meanOcrSeconds: row.meanOcrSeconds,
    minUiScore: row.minUiScore,
    threshold: row.threshold,
    clientSize: row.clientSize,
    samples: row.samples,
    createdAt: row.createdAt.toISOString(),
  };
}
