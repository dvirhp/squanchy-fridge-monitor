import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { normalizeTimestamp } from './reading-normalizer';
import type { ImportDto } from './import.dto';
import type { ValidatedReading } from './import.types';

export async function resolveAssignment(
  tx: Prisma.TransactionClient,
  metadata: ImportDto,
  loggerId: string,
  fridgeId: string,
  rows: ValidatedReading[],
): Promise<{
  assignment: Prisma.LoggerAssignmentGetPayload<object>;
  closedAssignmentId?: string;
}> {
  const assignments = await tx.loggerAssignment.findMany({
    where: { loggerId },
    orderBy: { validFrom: 'asc' },
  });
  const times = rows.flatMap((row) => (row.recordedAt === null ? [] : [row.recordedAt])).sort();
  const containsAll = (a: { validFrom: string; validTo: string | null }) =>
    times.every((time) => time >= a.validFrom && (a.validTo === null || time < a.validTo));
  for (let i = 1; i < assignments.length; i++) {
    if (
      assignments[i - 1].validTo === null ||
      assignments[i - 1].validTo! > assignments[i].validFrom
    ) {
      throw new ConflictException(
        'Logger assignment history overlaps; resolve it before importing.',
      );
    }
  }
  if (metadata.assignmentId && metadata.assignmentValidFrom) {
    throw new BadRequestException('Supply assignmentId or assignmentValidFrom, not both.');
  }
  if (metadata.assignmentId) {
    const selected = assignments.find(
      (a) => a.id === metadata.assignmentId && a.fridgeId === fridgeId,
    );
    if (!selected || !containsAll(selected))
      throw new ConflictException(
        'Selected assignment does not match the logger, fridge, or reading times.',
      );
    return { assignment: selected };
  }
  if (!times.length)
    throw new BadRequestException(
      'All timestamps are invalid. Supply an existing assignmentId to establish context.',
    );
  const matching = assignments.filter((a) => a.fridgeId === fridgeId && containsAll(a));
  if (matching.length === 1) {
    if (
      metadata.assignmentValidFrom &&
      normalizeTimestamp(metadata.assignmentValidFrom) !== matching[0].validFrom
    ) {
      throw new ConflictException(
        'assignmentValidFrom differs from the existing matching assignment.',
      );
    }
    return { assignment: matching[0] };
  }
  if (!metadata.assignmentValidFrom) {
    throw new ConflictException(
      'No assignment covers this file. Supply an explicit assignmentValidFrom for a first assignment or forward move; split files spanning assignments.',
    );
  }
  const start = normalizeTimestamp(metadata.assignmentValidFrom);
  if (!start || times[0] < start)
    throw new BadRequestException(
      'assignmentValidFrom must be a valid local timestamp at or before every dated row.',
    );
  const latest = assignments.at(-1);
  // Only append history. Backdated changes and automatic interval splitting are deliberately excluded.
  if (
    latest &&
    (start <= latest.validFrom || (latest.validTo !== null && start < latest.validTo))
  ) {
    throw new ConflictException(
      'New assignments must follow existing history without overlapping closed intervals.',
    );
  }
  if (latest?.validTo === null) {
    const conflict = await tx.reading.findFirst({
      where: {
        import: { assignmentId: latest.id },
        OR: [{ recordedAt: { gte: start } }, { recordedAt: null }],
      },
    });
    if (conflict)
      throw new ConflictException(
        'Move would contradict existing readings, including readings whose times are unknown.',
      );
    await tx.loggerAssignment.update({ where: { id: latest.id }, data: { validTo: start } });
  }
  const assignment = await tx.loggerAssignment.create({
    data: { loggerId, fridgeId, validFrom: start },
  });
  return { assignment, closedAssignmentId: latest?.validTo === null ? latest.id : undefined };
}
