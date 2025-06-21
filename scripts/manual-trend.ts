import { PrismaClient } from '@prisma/client';
import { processDailyEpcTrend } from '../lib/epcTrendAnalyzer';

const prisma = new PrismaClient();

async function main() {
  const advId = '146629'; // 你的广告商ID
  const advertiser = await prisma.advertiser.findUnique({ where: { advId } });
  if (!advertiser) {
    console.log('未找到广告商');
    return;
  }
  const entityId = advertiser.id;
  // 你可以指定日期，这里用今天
  const today = new Date();
  // EPC值随便填，趋势分析只看历史
  await processDailyEpcTrend(Number(entityId), 0, today);
  console.log('已手动触发趋势分析');
}

main().catch(console.error).finally(() => prisma.$disconnect()); 