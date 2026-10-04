import { db } from '@/db';
import { agentRuns, diagnosticReports } from '@/db/schema';
import { serializeDiagnostic, serializeRun } from '@/lib/serialize';
import AgentDashboard from '@/components/agent-dashboard';
import { desc } from 'drizzle-orm';
import type { DiagnosticRecord, RunRecord } from '@/lib/agent-types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let runs: RunRecord[] = [];
  let diagnostics: DiagnosticRecord[] = [];
  let storageReady = true;
  try {
    const [runRows, diagnosticRows] = await Promise.all([
      db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(100),
      db.select().from(diagnosticReports).orderBy(desc(diagnosticReports.createdAt)).limit(100),
    ]);
    runs = runRows.map((row) => serializeRun(row));
    diagnostics = diagnosticRows.map(serializeDiagnostic);
  } catch {
    storageReady = false;
  }
  return (
    <AgentDashboard
      initialRuns={runs}
      initialDiagnostics={diagnostics}
      storageReady={storageReady}
    />
  );
}
