import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseLoggerCsv } from './csv-parser';
import { normalizeReading } from './reading-normalizer';
import { validateReading } from './reading-validator';
import { readingIdentity } from './reading-identity';
import { resolveAssignment } from './assignment-resolver';
import type { ImportDto } from './import.dto';
import type { ImportSummary } from './import.types';

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(bytes: Buffer, filename: string, metadata: ImportDto): Promise<ImportSummary> {
    let rawRows;
    try { rawRows = parseLoggerCsv(bytes); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid CSV.'); }

    try {
      return await this.prisma.$transaction(async tx => {
        let logger = await tx.logger.findUnique({ where: { externalId: metadata.loggerExternalId } });
        if (!logger) {
          if (!metadata.temperatureUnit) throw new BadRequestException('A new logger requires explicit temperatureUnit: CELSIUS or FAHRENHEIT.');
          logger = await tx.logger.create({ data: { externalId: metadata.loggerExternalId,
            temperatureUnit: metadata.temperatureUnit, expectedIntervalMinutes: metadata.expectedIntervalMinutes ?? 15 } });
        } else if ((metadata.temperatureUnit && metadata.temperatureUnit !== logger.temperatureUnit)
          || (metadata.expectedIntervalMinutes !== undefined && metadata.expectedIntervalMinutes !== logger.expectedIntervalMinutes)) {
          throw new ConflictException('Provided configuration differs from the existing logger. Import does not change logger configuration.');
        }
        const branch = await tx.branch.upsert({ where: { normalizedName: metadata.branch.toLowerCase() },
          create: { name: metadata.branch, normalizedName: metadata.branch.toLowerCase() }, update: {} });
        const fridge = await tx.fridge.upsert({
          where: { branchId_normalizedName: { branchId: branch.id, normalizedName: metadata.fridge.toLowerCase() } },
          create: { branchId: branch.id, name: metadata.fridge, normalizedName: metadata.fridge.toLowerCase() }, update: {},
        });
        const rows = rawRows.map(row => validateReading(normalizeReading(row, logger.temperatureUnit)))
          .sort((a, b) => (a.recordedAt ?? '\uffff').localeCompare(b.recordedAt ?? '\uffff') || a.sourceRowNumber - b.sourceRowNumber);
        const assignment = await resolveAssignment(tx, metadata, logger.id, fridge.id, rows);
        const context = { loggerId: logger.id, fridgeId: fridge.id, temperatureUnit: logger.temperatureUnit };
        const keyed = rows.map(row => ({ ...row, deduplicationKey: readingIdentity(row, context) }));
        const existing = new Map<string, string>();
        // Bound SQL parameter counts for SQLite.
        for (let offset = 0; offset < keyed.length; offset += 400) {
          const stored = await tx.reading.findMany({ where: { deduplicationKey: { in: keyed.slice(offset, offset + 400).map(r => r.deduplicationKey) } },
            select: { deduplicationKey: true, fridgeId: true } });
          for (const reading of stored) existing.set(reading.deduplicationKey, reading.fridgeId);
        }
        const fresh = [];
        let duplicateRows = 0;
        for (const row of keyed) {
          const owner = existing.get(row.deduplicationKey);
          if (owner !== undefined) {
            if (owner !== fridge.id) throw new ConflictException('A duplicate reading already belongs to a different fridge.');
            duplicateRows++;
          } else {
            existing.set(row.deduplicationKey, fridge.id);
            fresh.push(row);
          }
        }
        const invalidRows = fresh.filter(row => row.status === 'INVALID').length;
        const acceptedRows = fresh.length - invalidRows;
        const imported = await tx.import.create({ data: {
          ...context, assignmentId: assignment.id, expectedIntervalMinutes: logger.expectedIntervalMinutes,
          originalFilename: filename, totalRows: rows.length, acceptedRows, invalidRows, duplicateRows,
        } });
        for (let offset = 0; offset < fresh.length; offset += 100) {
          await tx.reading.createMany({ data: fresh.slice(offset, offset + 100).map(row => ({
            ...row, importId: imported.id, loggerId: logger.id, fridgeId: fridge.id,
          })) });
        }
        return { importId: imported.id, assignmentId: assignment.id, totalRows: rows.length, acceptedRows, invalidRows, duplicateRows };
      }, { maxWait: 5000, timeout: 20000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        throw new ConflictException('Concurrent import changed this context. No partial import was saved; retry the request.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2028') {
        throw new ServiceUnavailableException('Import transaction timed out. No partial import was saved; retry the request.');
      }
      throw error;
    }
  }
}
