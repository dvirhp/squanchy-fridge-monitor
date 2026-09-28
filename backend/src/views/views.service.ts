import { Injectable, NotFoundException } from '@nestjs/common';
import type { Incident } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dateBounds, HistoryQueryDto } from './history-query.dto';

type Bounds = ReturnType<typeof dateBounds>;
export function overlaps(finding: Incident, bounds: Bounds): boolean {
  if (!finding.startedAt) return true;
  const details = finding.details as Record<string, unknown> | null;
  const end = finding.endedAt ?? (typeof details?.lastObservedHighAt === 'string' ? details.lastObservedHighAt : finding.startedAt);
  return (!bounds.to || finding.startedAt <= bounds.to) && (!bounds.from || end >= bounds.from);
}

@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async options() {
    const [branches, loggers] = await Promise.all([
      this.prisma.branch.findMany({ select: { id: true, name: true, fridges: { select: { id: true, name: true }, orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } }),
      this.prisma.logger.findMany({ select: { id: true, externalId: true, temperatureUnit: true, expectedIntervalMinutes: true,
        assignments: { select: { id: true, fridgeId: true, validFrom: true, validTo: true }, orderBy: { validFrom: 'asc' } } }, orderBy: { externalId: 'asc' } }),
    ]);
    return { branches, loggers };
  }

  async dashboard(query: HistoryQueryDto) {
    const bounds = dateBounds(query);
    const periodSelected = Boolean(bounds.from || bounds.to);
    const fridges = await this.prisma.fridge.findMany({ where: query.branchId ? { branchId: query.branchId } : {},
      include: { branch: true, incidents: true,
        readings: { where: { status: 'VALID', recordedAt: { not: null, gte: bounds.from, lte: bounds.to } }, orderBy: { recordedAt: 'desc' }, take: 1 },
        imports: { orderBy: { importedAt: 'desc' }, take: 1, select: { importedAt: true } } } });
    const rows = fridges.map(fridge => {
      const findings = fridge.incidents.filter(finding => overlaps(finding, bounds));
      const temperatureCount = findings.filter(f => f.type === 'TEMPERATURE').length;
      // Unknown-date evidence cannot establish a problem inside a selected period.
      const qualityCount = findings.filter(f => f.type !== 'TEMPERATURE' && (!periodSelected || f.startedAt !== null)).length;
      const undatedCount = findings.filter(f => f.startedAt === null).length;
      const latest = fridge.readings[0];
      const status = temperatureCount ? 'temperature' : qualityCount ? 'quality' : latest ? 'clear' : 'no-data';
      return { id: fridge.id, name: fridge.name, branch: { id: fridge.branch.id, name: fridge.branch.name }, status,
        temperatureCount, qualityCount, undatedCount,
        latestReading: latest ? { recordedAt: latest.recordedAt, temperatureCelsius: latest.temperatureCelsius } : null,
        latestUploadedAt: fridge.imports[0]?.importedAt ?? null };
    });
    const counts = { total: rows.length, temperature: rows.filter(r => r.temperatureCount > 0).length,
      quality: rows.filter(r => r.qualityCount > 0).length, clear: rows.filter(r => r.status === 'clear').length,
      noData: rows.filter(r => r.status === 'no-data').length };
    const order = ['temperature', 'quality', 'clear', 'no-data'];
    return { counts, fridges: rows.filter(r => !query.status || (query.status === 'quality' ? r.qualityCount > 0 : r.status === query.status))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.branch.name.localeCompare(b.branch.name) || a.name.localeCompare(b.name)) };
  }

  async fridge(id: string, query: HistoryQueryDto) {
    const bounds = dateBounds(query);
    const fridge = await this.prisma.fridge.findUnique({ where: { id }, include: { branch: true } });
    if (!fridge) throw new NotFoundException('Fridge not found.');
    const [readings, findings] = await Promise.all([
      this.prisma.reading.findMany({ where: { fridgeId: id, recordedAt: { not: null, gte: bounds.from, lte: bounds.to } },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }], select: { id: true, recordedAt: true, temperatureCelsius: true, status: true,
          validationError: true, loggerId: true, logger: { select: { externalId: true } },
          import: { select: { assignmentId: true, expectedIntervalMinutes: true } } } }),
      this.prisma.incident.findMany({ where: { fridgeId: id }, orderBy: { startedAt: 'asc' } }),
    ]);
    const matching = findings.filter(f => overlaps(f, bounds));
    return { id: fridge.id, name: fridge.name, branch: { id: fridge.branch.id, name: fridge.branch.name },
      readings: readings.map(({ import: source, logger, ...row }) => ({ ...row, loggerExternalId: logger.externalId, ...source })),
      temperatureIncidents: matching.filter(f => f.type === 'TEMPERATURE'),
      dataQuality: matching.filter(f => f.type !== 'TEMPERATURE' && f.startedAt !== null),
      undatedQuality: matching.filter(f => f.startedAt === null) };
  }
}
