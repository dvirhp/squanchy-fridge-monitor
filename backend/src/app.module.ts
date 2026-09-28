import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ImportsModule } from './imports/imports.module';

@Module({ imports: [PrismaModule, HealthModule, ImportsModule] })
export class AppModule {}
