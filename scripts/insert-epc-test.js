const { PrismaClient } = require('@prisma/client');
const { processDailyEpcTrend } = require('../lib/epcTrendAnalyzer');
const prisma = new PrismaClient();

async function main() {
  const advId = '146629'; // 你的广告商ID
  // 查找advertiser的数据库id
  const advertiser = await prisma.advertiser.findUnique({ where: { advId } });
  if (!advertiser) {
    console.log('未找到广告商');
    return;
  }
  const entityId = advertiser.id;

  // 插入近7天EPC=0的数据，并触发趋势分析
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    await prisma.dailyEpc.upsert({
      where: {
        entityId_date: {
          entityId: Number(entityId),
          date: date,
        },
      },
      update: { epcValue: 0 },
      create: {
        entityId: Number(entityId),
        date: date,
        epcValue: 0,
      },
    });
    console.log(`写入 ${advId} ${date.toISOString().slice(0, 10)} EPC=0`);
    // 触发趋势分析
    await processDailyEpcTrend(Number(entityId), 0, date);
    console.log(`已触发趋势分析 ${advId} ${date.toISOString().slice(0, 10)}`);
  }
}

main().catch(e => {
  console.error(e);
}).finally(async () => {
  await prisma.$disconnect();
}); 