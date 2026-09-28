import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({ imports: [PrismaModule, AnalysisModule], controllers: [ImportsController], providers: [ImportsService] })
export class ImportsModule {}
