import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { prepareObservations, type AnalysisReading } from './analysis.rules';
import { analyzeTemperature } from './temperature-analyzer';
import { analyzeGaps } from './gap-analyzer';

@Injectable()
export class AnalysisService {
  // Caller owns the transaction: import writes and derived findings commit together.
  async recomputeFridges(tx: Prisma.TransactionClient, fridgeIds: string[]) {
    const scope = [...new Set(fridgeIds)].sort();
    const rows = await tx.reading.findMany({
      where: { fridgeId: { in: scope } },
      include: { import: { include: { assignment: true } } },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    });
    const groups = new Map<string, {
      fridgeId: string; loggerId: string; assignmentId: string; assignmentEnded: boolean; readings: AnalysisReading[];
    }>();
    for (const row of rows) {
      const key = JSON.stringify([row.fridgeId, row.loggerId, row.import.assignmentId]);
      let group = groups.get(key);
      if (!group) {
        group = { fridgeId: row.fridgeId, loggerId: row.loggerId, assignmentId: row.import.assignmentId,
          assignmentEnded: row.import.assignment.validTo !== null, readings: [] };
        groups.set(key, group);
      }
      group.readings.push({ ...row, expectedIntervalMinutes: row.import.expectedIntervalMinutes });
    }
    const derived: Prisma.IncidentCreateManyInput[] = [];
    let temporarySpikes = 0;
    for (const group of groups.values()) {
      const { observations, invalidFindings } = prepareObservations(group.readings);
      const temperature = analyzeTemperature(observations, group.assignmentEnded);
      temporarySpikes += temperature.spikes.length;
      for (const finding of [...temperature.findings, ...analyzeGaps(observations), ...invalidFindings]) {
        derived.push({ ...finding, fridgeId: group.fridgeId, loggerId: group.loggerId,
          details: { ...finding.details, assignmentId: group.assignmentId } });
      }
    }
    await tx.incident.deleteMany({ where: { fridgeId: { in: scope } } });
    for (let offset = 0; offset < derived.length; offset += 100) {
      await tx.incident.createMany({ data: derived.slice(offset, offset + 100) });
    }
    return {
      fridgeIds: scope,
      temperatureIncidents: derived.filter(finding => finding.type === 'TEMPERATURE').length,
      dataGaps: derived.filter(finding => finding.type === 'DATA_GAP').length,
      invalidReadings: derived.filter(finding => finding.type === 'INVALID_READING').length,
      temporarySpikes,
    };
  }
}
