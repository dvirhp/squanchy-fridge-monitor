import { BadRequestException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { normalizeTimestamp } from '../imports/reading-normalizer';

export class HistoryQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsIn(['temperature', 'quality', 'clear', 'no-data']) status?: string;
}

export function dateBounds(query: HistoryQueryDto) {
  for (const date of [query.from, query.to]) {
    if (date && !normalizeTimestamp(`${date}T00:00:00`))
      throw new BadRequestException('Choose a valid calendar date.');
  }
  if (query.from && query.to && query.from > query.to)
    throw new BadRequestException('Start date must be on or before end date.');
  return {
    from: query.from ? `${query.from}T00:00:00` : undefined,
    to: query.to ? `${query.to}T23:59:59` : undefined,
  };
}
