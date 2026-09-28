import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Opening SQLite creates a missing file without touching existing tables/data.
// This avoids Prisma 6's opaque missing-file migration error on this Windows host.
const prisma = new PrismaClient();
prisma
  .$connect()
  .then(() => console.log('SQLite file ready.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
