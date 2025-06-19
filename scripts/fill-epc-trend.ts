import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const periods = [7, 14, 30];

function calcTrend(history: number[]): 'up' | 'down' | 'flat' {
  if (!history || history.length < 2) return 'flat';
  const valid = history.filter(x => typeof x === 'number' && !isNaN(x));
  if (valid.length < 2) return 'flat';
  const first = valid[0];
  const last = valid[valid.length - 1];
  const change = ((last - first) / (first || 1)) * 100;
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'flat';
}

async function main() {
  // 获取所有广告商
  const allAdvertisers = await prisma.advertiser.findMany({ select: { advId: true, id: true } });
  // 获取所有快照日期
  const allDates = await prisma.advertiserSnapshot.findMany({
    select: { snapshotDate: true },
    distinct: ['snapshotDate'],
    orderBy: { snapshotDate: 'asc' }
  });

  for (const adv of allAdvertisers) {
    for (const dateObj of allDates) {
      const date = dateObj.snapshotDate;
      const trendData: any = {};
      for (const period of periods) {
        // 查找该广告商在date往前period天的快照
        const startDate = new Date(date);
        startDate.setDate(startDate.getDate() - period + 1);
        const history = await prisma.advertiserSnapshot.findMany({
          where: {
            advertiserId: adv.id,
            snapshotDate: {
              gte: startDate,
              lte: date,
            },
          },
          orderBy: { snapshotDate: 'asc' },
          select: { epc30: true, snapshotDate: true },
        });
        // 补0填满周期
        const epcHistory: number[] = [];
        const labels: string[] = [];
        for (let i = 0; i < period; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const snap = history.find(h => h.snapshotDate.toDateString() === d.toDateString());
          epcHistory.push(snap ? Number(snap.epc30 ?? 0) : 0);
          labels.push(`${d.getMonth() + 1}-${d.getDate()}`);
        }
        trendData[`epc${period}History`] = epcHistory;
        trendData[`epc${period}Labels`] = labels;
        trendData[`epc${period}Trend`] = calcTrend(epcHistory);
      }
      await prisma.ePCTrendSnapshot.upsert({
        where: { advId_date: { advId: adv.advId, date } },
        update: trendData,
        create: { advId: adv.advId, date, ...trendData },
      });
    }
    console.log(`广告商 ${adv.advId} 补齐历史趋势快照完成`);
  }
  console.log('全部历史趋势快照补齐完成');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect()); 