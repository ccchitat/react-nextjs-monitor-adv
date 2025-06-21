import { PrismaClient } from '@prisma/client';
import { processDailyEpcTrend } from '../lib/epcTrendAnalyzer';

const prisma = new PrismaClient();

async function main() {
  // 获取所有广告商
  const advertisers = await prisma.advertiser.findMany();
  const today = new Date();
  const days = 7; // 写入多少天

  // 三种类型：平稳、上升、下降
  const types = ['stable', 'upward', 'downward'] as const;

  for (const [idx, advertiser] of advertisers.entries()) {
    const entityId = advertiser.id;
    // 轮流分配类型
    const type = types[idx % types.length];
    console.log(`广告商 ${advertiser.advId} 类型: ${type}`);
    for (let i = 0; i < days; i++) {
      // i=0为最早，i=days-1为今天
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - i));
      let epcValue = 0.5; // 默认平稳
      if (type === 'upward') {
        epcValue = 0.1 + 0.1 * i; // 递增
      } else if (type === 'downward') {
        epcValue = 1 - 0.1 * i; // 递减
      }
      epcValue = Number(epcValue.toFixed(4));
      await prisma.dailyEpc.upsert({
        where: {
          entityId_date: {
            entityId: Number(entityId),
            date: date,
          },
        },
        update: { epcValue: epcValue },
        create: {
          entityId: Number(entityId),
          date: date,
          epcValue: epcValue,
        },
      });
      console.log(`写入 ${advertiser.advId} ${date.toISOString().slice(0, 10)} EPC=${epcValue}`);
    }
    // 写完一个广告商，触发趋势分析
    await processDailyEpcTrend(Number(entityId), 0, today);
    console.log(`已触发趋势分析 ${advertiser.advId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect()); 