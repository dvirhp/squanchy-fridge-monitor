import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { AnalysisService } from '../src/analysis/analysis.service';

const prisma = new PrismaClient();

async function main() {
  const service = new AnalysisService();
  const result = await prisma.$transaction(
    async (tx) => {
      const fridges = await tx.fridge.findMany({ select: { id: true } });
      return service.recomputeFridges(
        tx,
        fridges.map((fridge) => fridge.id),
      );
    },
    { maxWait: 5000, timeout: 20000 },
  );
  console.log('Historical analysis complete:', JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
